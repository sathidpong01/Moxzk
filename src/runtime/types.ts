import type { AppSettings, AppStep, BrushStroke, ImageEntry, TextRegion } from '../types'
import type { OllamaModelTag, OllamaOptions, OllamaPullOptions, OllamaPullProgress, OllamaStatus } from '../services/ollama'
import type { PanelCleanerOptions, PanelCleanerStatus } from '../services/panelcleaner-api'

export type RuntimeKind = 'web' | 'electron'

export interface RuntimeExportFile {
  name: string
  blob: Blob
}

export type RuntimeExportDestination = 'zip' | 'folder'
export type RuntimeExportResult = 'folder' | 'zip'

export interface RuntimeSaveExportOptions {
  destination?: RuntimeExportDestination
}

export interface RuntimeActionResult {
  ok: boolean
  error?: string
  logs?: string[]
}

export type LocalServiceName = 'panelcleaner' | 'ollama'

export type PanelCleanerDependencyState = 'missing' | 'ready' | 'broken' | 'installing'
export type PanelCleanerDependencySource = 'explicit' | 'managed' | 'dev' | 'path'
export type PythonDependencyState = 'missing' | 'ready' | 'unsupported'

export interface PythonDependencyStatus {
  state: PythonDependencyState
  version?: string
  command?: string
  downloadUrl: string
  error?: string
  actionHint?: string
}

export interface PanelCleanerDependencyStatus {
  state: PanelCleanerDependencyState
  source?: PanelCleanerDependencySource
  version?: string
  command?: string
  installPath?: string
  packageName: string
  packageVersion: string
  licenseName: string
  projectUrl: string
  error?: string
  actionHint?: string
  logs?: string[]
  python: PythonDependencyStatus
}

export interface RuntimePathPickResult {
  ok: boolean
  path?: string
  error?: string
}

export interface ManagedServiceStatus {
  running: boolean
  ownedByApp: boolean
  inFlightCount: number
  idleTimeoutMs: number | null
  idleDeadlineAt: number | null
  command: string | null
  lastError: string | null
}

export interface RuntimeWindowState {
  isMaximized: boolean
}

export type RuntimeUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'disabled'
  | 'error'

export interface RuntimeUpdateStatus {
  state: RuntimeUpdateState
  currentVersion: string
  version?: string
  releaseName?: string | null
  releaseDate?: string
  releaseNotes?: string | null
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
  checkedAt?: number
  downloadedAt?: number
  canInstall: boolean
  manualUrl: string
}

export interface RuntimeProjectDraft {
  version: 1
  savedAt: number
  currentStep: AppStep
  activeImageId: string | null
  imageEntries: ImageEntry[]
  regions: TextRegion[]
  brushStrokes: BrushStroke[]
  cleanedImageUrl: string | null
  originalImageUrl: string | null
  settings: AppSettings
}

export interface AppRuntime {
  kind: RuntimeKind
  capabilities: {
    canStartLocalServices: boolean
    canPickNativeFolders: boolean
    canSecureStoreSecrets: boolean
    canUseCustomProtocolAuth: boolean
    canUseCustomWindowControls: boolean
  }
  ollama: {
    getServerStatus(options: OllamaOptions): Promise<OllamaStatus>
    listModels(options: OllamaOptions): Promise<OllamaModelTag[]>
    pullModel(options: OllamaPullOptions): Promise<OllamaPullProgress>
  }
  panelCleaner: {
    getStatus(options: PanelCleanerOptions): Promise<PanelCleanerStatus>
  }
  files: {
    saveFile(file: RuntimeExportFile): Promise<void>
    saveExportFiles(
      files: RuntimeExportFile[],
      archiveName: string,
      options?: RuntimeSaveExportOptions,
    ): Promise<RuntimeExportResult>
  }
  projectDraft: {
    save(draft: RuntimeProjectDraft): Promise<void>
    load(): Promise<RuntimeProjectDraft | null>
    clear(): Promise<void>
  }
  localServices: {
    beginUsage(service: LocalServiceName): Promise<void>
    endUsage(service: LocalServiceName): Promise<void>
    getManagedStatus(): Promise<Record<LocalServiceName, ManagedServiceStatus>>
    getPanelCleanerDependencyStatus(): Promise<PanelCleanerDependencyStatus>
    installPython(): Promise<RuntimeActionResult>
    installOllama(): Promise<RuntimeActionResult>
    installPanelCleaner(): Promise<RuntimeActionResult>
    repairPanelCleaner(): Promise<RuntimeActionResult>
    pickPanelCleanerExecutable(): Promise<RuntimePathPickResult>
    stopOwnedServices(): Promise<RuntimeActionResult>
    startOllama(): Promise<RuntimeActionResult>
    startPanelCleanerBridge(): Promise<RuntimeActionResult>
  }
  auth: {
    signInWithGoogle(): Promise<RuntimeActionResult>
  }
  app: {
    getVersion(): Promise<string>
    openLogs(): Promise<RuntimeActionResult>
    openSettingsFolder(): Promise<RuntimeActionResult>
    openDraftsFolder(): Promise<RuntimeActionResult>
  }
  updates: {
    getStatus(): Promise<RuntimeUpdateStatus>
    checkForUpdates(): Promise<RuntimeUpdateStatus>
    installDownloadedUpdate(): Promise<RuntimeActionResult>
    openReleases(): Promise<RuntimeActionResult>
    onStatusChange(callback: (status: RuntimeUpdateStatus) => void): () => void
  }
  secureStore: {
    getSecret(key: string): Promise<string | null>
    setSecret(key: string, value: string): Promise<RuntimeActionResult>
    deleteSecret(key: string): Promise<RuntimeActionResult>
  }
  customProtocolAuth: {
    getCallbackUrl(path: string): Promise<string | null>
  }
  windowControls: {
    minimize(): Promise<RuntimeActionResult>
    toggleMaximize(): Promise<RuntimeWindowState>
    close(): Promise<RuntimeActionResult>
    getState(): Promise<RuntimeWindowState>
    onStateChange(callback: (state: RuntimeWindowState) => void): () => void
  }
}
