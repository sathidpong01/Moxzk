import type { AppSettings, ProcessingMode } from '../types'
import type { StreamProgress, TranslatorResponse } from './translator-api'
import { processImageWithPanelCleaner } from './panelcleaner-api'

export interface CleanupProviderRequest {
  file: File
  mode: ProcessingMode
  settings: AppSettings
  runOcr: boolean
  signal?: AbortSignal
  onProgress?: (progress: StreamProgress) => void
}

export async function processImageWithCleanupProvider({
  file,
  settings,
  runOcr,
  signal,
  onProgress,
}: CleanupProviderRequest): Promise<TranslatorResponse> {
  onProgress?.({ status: 'progress', message: 'PanelCleaner: starting cleanup' })
  return processImageWithPanelCleaner(
    file,
    {
      bridgeUrl: settings.panelCleanerBridgeUrl,
      executablePath: settings.panelCleanerExecutablePath,
      runOcr,
      signal,
    },
    onProgress,
  )
}
