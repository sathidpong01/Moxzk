import {
  defaultOllamaClient,
} from '../services/ollama'
import JSZip from 'jszip'
import * as FileSaver from 'file-saver'
import { defaultPanelCleanerClient } from '../services/panelcleaner-api'
import { clearProjectDraft, loadProjectDraft, saveProjectDraft } from '../services/projectDraftStorage'
import { getGoogleRedirectUrl } from '../services/cloudflareApi'
import type {
  AppRuntime,
  LocalServiceName,
  ManagedServiceStatus,
  RuntimeActionResult,
  RuntimeExportFile,
  RuntimeSaveExportOptions,
  RuntimeWindowState,
} from './types'

export class WebRuntime implements AppRuntime {
  readonly kind = 'web'

  readonly capabilities = {
    canStartLocalServices: false,
    canPickNativeFolders: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    canSecureStoreSecrets: false,
    canUseCustomProtocolAuth: false,
    canUseCustomWindowControls: false,
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
    saveFile,
    saveExportFiles,
  }

  readonly projectDraft = {
    save: saveProjectDraft,
    load: loadProjectDraft,
    clear: clearProjectDraft,
  }

  readonly localServices = {
    beginUsage: async (_service: LocalServiceName) => {},
    endUsage: async (_service: LocalServiceName) => {},
    getManagedStatus: async (): Promise<Record<LocalServiceName, ManagedServiceStatus>> => ({
      panelcleaner: {
        running: false,
        ownedByApp: false,
        inFlightCount: 0,
        idleTimeoutMs: null,
        idleDeadlineAt: null,
        command: null,
        lastError: null,
      },
      ollama: {
        running: false,
        ownedByApp: false,
        inFlightCount: 0,
        idleTimeoutMs: null,
        idleDeadlineAt: null,
        command: null,
        lastError: null,
      },
    }),
    getPanelCleanerDependencyStatus: async () => ({
      state: 'missing' as const,
      packageName: 'pcleaner-cli',
      packageVersion: '2.11.9',
      licenseName: 'GPLv3',
      projectUrl: 'https://pypi.org/project/pcleaner-cli/',
      actionHint: 'Electron runtime is required to install PanelCleaner from inside Moxzk.',
    }),
    installPanelCleaner: () => unsupportedRuntimeAction('Web runtime cannot install PanelCleaner.'),
    repairPanelCleaner: () => unsupportedRuntimeAction('Web runtime cannot repair PanelCleaner.'),
    pickPanelCleanerExecutable: async () => ({ ok: false, error: 'Web runtime cannot pick native executable paths.' }),
    stopOwnedServices: () => unsupportedRuntimeAction('Web runtime cannot stop local services.'),
    startOllama: () => unsupportedRuntimeAction('Web runtime cannot start Ollama.'),
    startPanelCleanerBridge: () => unsupportedRuntimeAction('Web runtime cannot start PanelCleaner bridge.'),
  }

  readonly auth = {
    signInWithGoogle: signInWithGoogleInBrowser,
  }

  readonly app = {
    getVersion: async (): Promise<string> => 'web',
    openLogs: () => unsupportedRuntimeAction('Web runtime does not expose native app logs.'),
    openSettingsFolder: () => unsupportedRuntimeAction('Web runtime does not expose native settings folders.'),
    openDraftsFolder: () => unsupportedRuntimeAction('Web runtime does not expose native draft folders.'),
  }

  readonly secureStore = {
    getSecret: async () => null,
    setSecret: () => unsupportedRuntimeAction('Web runtime does not provide secure secret storage.'),
    deleteSecret: () => unsupportedRuntimeAction('Web runtime does not provide secure secret storage.'),
  }

  readonly customProtocolAuth = {
    getCallbackUrl: async () => null,
  }

  readonly windowControls = {
    minimize: () => unsupportedRuntimeAction('Web runtime cannot control native windows.'),
    toggleMaximize: async (): Promise<RuntimeWindowState> => ({ isMaximized: false }),
    close: () => unsupportedRuntimeAction('Web runtime cannot control native windows.'),
    getState: async (): Promise<RuntimeWindowState> => ({ isMaximized: false }),
    onStateChange: (_callback: (state: RuntimeWindowState) => void) => () => {},
  }
}

export const webRuntime: AppRuntime = new WebRuntime()

type DirectoryPicker = () => Promise<{
  getFileHandle: (name: string, options: { create: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}>

async function saveFile(file: RuntimeExportFile): Promise<void> {
  FileSaver.saveAs(file.blob, file.name)
}

async function saveExportFiles(
  files: RuntimeExportFile[],
  archiveName: string,
  options: RuntimeSaveExportOptions = {},
): Promise<'folder' | 'zip'> {
  if (files.length === 0) throw new Error('ไม่มีไฟล์สำหรับ export')

  const directoryPicker = getDirectoryPicker()
  if (options.destination === 'folder' && directoryPicker) {
    try {
      const dir = await directoryPicker()
      for (const file of files) {
        const handle = await dir.getFileHandle(file.name, { create: true })
        const writable = await handle.createWritable()
        await writable.write(file.blob)
        await writable.close()
      }
      return 'folder'
    } catch (error) {
      if (isAbortError(error)) throw error
      console.warn('[runtime:web] folder export failed, falling back to zip:', error)
    }
  }

  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  FileSaver.saveAs(content, `${safeArchiveName(archiveName)}.zip`)
  return 'zip'
}

async function unsupportedRuntimeAction(error: string): Promise<RuntimeActionResult> {
  return { ok: false, error }
}

async function signInWithGoogleInBrowser(): Promise<RuntimeActionResult> {
  const bridge = window.moxzkRuntime
  if (bridge?.auth) {
    const result = await bridge.auth.signInWithGoogle()
    if (!result.ok) return { ok: false, error: result.error }
    return result.data ?? { ok: true }
  }

  if (isElectronUserAgent()) {
    return {
      ok: false,
      error: 'Electron auth bridge is not available. Restart npm run electron:dev so preload can expose system-browser Google login.',
    }
  }

  window.location.href = await getGoogleRedirectUrl()
  return { ok: true }
}

function isElectronUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /\bElectron\b/i.test(navigator.userAgent)
}

function getDirectoryPicker(): DirectoryPicker | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  return typeof candidate === 'function' ? candidate.bind(window) : null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function safeArchiveName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'manga'
}
