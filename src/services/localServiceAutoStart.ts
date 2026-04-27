import type { ProcessingMode, AppSettings } from '../types'
import type { AppRuntime, RuntimeActionResult } from '../runtime'

type ServiceKind = 'panelcleaner' | 'ollama'

interface LocalServiceAutoStartReporter {
  onLoading?: (service: ServiceKind, message: string) => void
  onSuccess?: (service: ServiceKind, message: string) => void
  onError?: (service: ServiceKind, message: string) => void
  onLog?: (message: string) => void
}

interface LocalServiceAutoStartRequest {
  runtime: AppRuntime
  settings: Pick<AppSettings, 'panelCleanerBridgeUrl' | 'ollamaUrl'>
  mode: ProcessingMode
  needsCleanup?: boolean
  reporter?: LocalServiceAutoStartReporter
}

export function isLocalServiceUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

export async function autoStartRequiredLocalServices({
  runtime,
  settings,
  mode,
  needsCleanup = mode === 'clean_only' || mode === 'gemma_vision_full',
  reporter,
}: LocalServiceAutoStartRequest): Promise<RuntimeActionResult> {
  if (!runtime.capabilities.canStartLocalServices) return { ok: true }

  if (needsCleanup && isLocalServiceUrl(settings.panelCleanerBridgeUrl)) {
    const panelCleanerResult = await startService({
      service: 'panelcleaner',
      loadingMessage: 'กำลังเริ่ม PanelCleaner bridge…',
      successMessage: 'PanelCleaner bridge พร้อมใช้งาน',
      failurePrefix: 'PanelCleaner',
      start: () => runtime.localServices.startPanelCleanerBridge(),
      reporter,
    })
    if (!panelCleanerResult.ok) return panelCleanerResult
  }

  if (mode !== 'clean_only' && isLocalServiceUrl(settings.ollamaUrl)) {
    const ollamaResult = await startService({
      service: 'ollama',
      loadingMessage: 'กำลังเริ่ม Ollama…',
      successMessage: 'Ollama พร้อมใช้งาน',
      failurePrefix: 'Ollama',
      start: () => runtime.localServices.startOllama(),
      reporter,
    })
    if (!ollamaResult.ok) return ollamaResult
  }

  return { ok: true }
}

interface StartServiceRequest {
  service: ServiceKind
  loadingMessage: string
  successMessage: string
  failurePrefix: string
  start: () => Promise<RuntimeActionResult>
  reporter?: LocalServiceAutoStartReporter
}

async function startService({
  service,
  loadingMessage,
  successMessage,
  failurePrefix,
  start,
  reporter,
}: StartServiceRequest): Promise<RuntimeActionResult> {
  reporter?.onLoading?.(service, loadingMessage)
  const result = await start()
  if (result.ok) {
    reporter?.onSuccess?.(service, successMessage)
    reporter?.onLog?.(`Auto-start: ${successMessage}`)
    return { ok: true }
  }

  const error = result.error ?? 'เริ่มไม่ได้'
  reporter?.onError?.(service, `${failurePrefix}: ${error}`)
  reporter?.onLog?.(`Auto-start: ${failurePrefix} ล้มเหลว — ${error}`)
  return { ok: false, error }
}
