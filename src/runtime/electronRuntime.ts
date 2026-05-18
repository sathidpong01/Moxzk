import JSZip from 'jszip'
import { defaultOllamaClient } from '../services/ollama'
import { defaultPanelCleanerClient } from '../services/panelcleaner-api'
import { decodeDesktopProjectDraft, encodeDesktopProjectDraft } from './desktopDraftCodec'
import type { MoxzkRuntimeBridge, NativeFilePayload, NativeResult } from './electronBridge'
import type {
  AppRuntime,
  LocalServiceName,
  ManagedServiceStatus,
  OllamaInstallStatus,
  PanelCleanerDependencyStatus,
  RuntimeActionResult,
  RuntimeExportFile,
  RuntimePathPickResult,
  RuntimeProjectDraft,
  RuntimeSaveExportOptions,
  RuntimeUpdateStatus,
  RuntimeWindowState,
} from './types'
import { setAppRuntime } from './index'

export class ElectronRuntime implements AppRuntime {
  readonly kind = 'electron'

  readonly capabilities = {
    canStartLocalServices: true,
    canPickNativeFolders: true,
    canSecureStoreSecrets: true,
    canUseCustomProtocolAuth: true,
    canUseCustomWindowControls: true,
  }

  readonly ollama = {
    getServerStatus: defaultOllamaClient.getStatus.bind(defaultOllamaClient),
    listModels: defaultOllamaClient.listModels.bind(defaultOllamaClient),
    pullModel: defaultOllamaClient.pullModel.bind(defaultOllamaClient),
  }

  readonly panelCleaner = {
    getStatus: defaultPanelCleanerClient.getStatus.bind(defaultPanelCleanerClient),
  }

  readonly files = {
    saveFile: async (file: RuntimeExportFile) => {
      await unwrapNativeResult(await this.bridge.files.saveFile(await toNativeFilePayload(file)))
    },
    saveExportFiles: async (
      files: RuntimeExportFile[],
      archiveName: string,
      options: RuntimeSaveExportOptions = {},
    ) => {
      if (files.length === 0) throw new Error('ไม่มีไฟล์สำหรับ export')
      if (options.destination === 'folder') {
        const nativeFiles = await Promise.all(files.map(toNativeFilePayload))
        const result = await this.bridge.files.saveExportFiles(nativeFiles, archiveName, options)
        if (result.ok) return 'folder'
        if (result.error === 'USER_CANCELLED') throw new DOMException('ยกเลิก export', 'AbortError')
        console.warn('[runtime:electron] folder export failed, falling back to zip:', result.error)
      }
      await saveZip(this.bridge, files, archiveName)
      return 'zip'
    },
  }

  readonly projectDraft = {
    save: async (draft: RuntimeProjectDraft) => {
      const payload = await encodeDesktopProjectDraft(draft)
      await unwrapNativeResult(await this.bridge.projectDraft.save(payload))
    },
    load: async () => {
      const result = await unwrapNativeResult(await this.bridge.projectDraft.load())
      return result ? decodeDesktopProjectDraft(result) : null
    },
    clear: async () => {
      await unwrapNativeResult(await this.bridge.projectDraft.clear())
    },
  }

  readonly localServices = {
    beginUsage: async (service: LocalServiceName): Promise<void> => {
      await unwrapNativeResult(await this.bridge.localServices.beginUsage(service))
    },
    endUsage: async (service: LocalServiceName): Promise<void> => {
      await unwrapNativeResult(await this.bridge.localServices.endUsage(service))
    },
    getManagedStatus: async (): Promise<Record<LocalServiceName, ManagedServiceStatus>> => {
      return unwrapNativeResult(await this.bridge.localServices.getManagedStatus())
    },
    getPanelCleanerDependencyStatus: async (): Promise<PanelCleanerDependencyStatus> => {
      return unwrapNativeResult(await this.bridge.localServices.getPanelCleanerDependencyStatus())
    },
    installPython: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.installPython()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    installOllama: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.installOllama()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    getOllamaInstallStatus: async (): Promise<OllamaInstallStatus> => {
      return unwrapNativeResult(await this.bridge.localServices.getOllamaInstallStatus())
    },
    installPanelCleaner: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.installPanelCleaner()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    repairPanelCleaner: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.repairPanelCleaner()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    pickPanelCleanerExecutable: async (): Promise<RuntimePathPickResult> => {
      const result = await this.bridge.localServices.pickPanelCleanerExecutable()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: false, error: 'No file selected.' }
    },
    stopOwnedServices: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.stopOwnedServices()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    startOllama: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.startOllama()
      if (!result.ok) return { ok: false, error: result.error }
      const inner = result.data
      return inner ?? { ok: true }
    },
    startPanelCleanerBridge: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.localServices.startPanelCleanerBridge()
      if (!result.ok) return { ok: false, error: result.error }
      const inner = result.data
      return inner ?? { ok: true }
    },
  }

  readonly auth = {
    signInWithGoogle: async () => unwrapNativeResult(await this.bridge.auth.signInWithGoogle()),
  }

  readonly app = {
    getVersion: async (): Promise<string> => unwrapNativeResult(await this.bridge.app.getVersion()),
    openLogs: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.app.openLogs()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    openSettingsFolder: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.app.openSettingsFolder()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    openDraftsFolder: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.app.openDraftsFolder()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
  }

  readonly updates = {
    getStatus: async (): Promise<RuntimeUpdateStatus> => unwrapNativeResult(await this.bridge.updates.getStatus()),
    checkForUpdates: async (): Promise<RuntimeUpdateStatus> => unwrapNativeResult(await this.bridge.updates.checkForUpdates()),
    installDownloadedUpdate: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.updates.installDownloadedUpdate()
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    },
    openReleases: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.updates.openReleases()
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    onStatusChange: (callback: (status: RuntimeUpdateStatus) => void) => {
      return this.bridge.updates.onStatusChange(callback)
    },
  }

  readonly secureStore = {
    getSecret: async (key: string) => unwrapNativeResult(await this.bridge.secureStore.getSecret(key)),
    setSecret: async (key: string, value: string): Promise<RuntimeActionResult> => {
      const result = await this.bridge.secureStore.setSecret(key, value)
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
    deleteSecret: async (key: string): Promise<RuntimeActionResult> => {
      const result = await this.bridge.secureStore.deleteSecret(key)
      if (!result.ok) return { ok: false, error: result.error }
      return result.data ?? { ok: true }
    },
  }

  readonly customProtocolAuth = {
    getCallbackUrl: async (callbackPath: string) => unwrapNativeResult(await this.bridge.customProtocolAuth.getCallbackUrl(callbackPath)),
  }

  readonly windowControls = {
    minimize: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.windowControls.minimize()
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    },
    toggleMaximize: async (): Promise<RuntimeWindowState> => {
      return unwrapNativeResult(await this.bridge.windowControls.toggleMaximize())
    },
    close: async (): Promise<RuntimeActionResult> => {
      const result = await this.bridge.windowControls.close()
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    },
    getState: async (): Promise<RuntimeWindowState> => {
      return unwrapNativeResult(await this.bridge.windowControls.getState())
    },
    onStateChange: (callback: (state: RuntimeWindowState) => void) => {
      return this.bridge.windowControls.onStateChange(callback)
    },
  }

  constructor(private readonly bridge: MoxzkRuntimeBridge) {}
}

export function installElectronRuntime(): void {
  const bridge = typeof window === 'undefined' ? undefined : window.moxzkRuntime
  if (!bridge) {
    throw new Error('Moxzk runtime bridge is unavailable. The app must run inside the Electron shell.')
  }
  setAppRuntime(new ElectronRuntime(bridge))
}

async function saveZip(
  bridge: MoxzkRuntimeBridge,
  files: RuntimeExportFile[],
  archiveName: string,
): Promise<void> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  await unwrapNativeResult(await bridge.files.saveFile({
    name: `${safeArchiveName(archiveName)}.zip`,
    type: 'application/zip',
    data: await content.arrayBuffer(),
  }))
}

async function toNativeFilePayload(file: RuntimeExportFile): Promise<NativeFilePayload> {
  return {
    name: file.name,
    type: file.blob.type || 'application/octet-stream',
    data: await file.blob.arrayBuffer(),
  }
}

async function unwrapNativeResult<T>(result: NativeResult<T>): Promise<T> {
  if (result.ok) return result.data as T
  if (result.error === 'USER_CANCELLED') throw new DOMException('Operation cancelled', 'AbortError')
  throw new Error(result.error || 'Native runtime action failed')
}

function safeArchiveName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'manga'
}
