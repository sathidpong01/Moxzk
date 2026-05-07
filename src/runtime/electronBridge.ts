export interface NativeResult<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface NativeFilePayload {
  name: string
  type: string
  data: ArrayBuffer
}

export interface NativeSaveExportOptions {
  destination?: 'zip' | 'folder'
}

export interface NativeDraftAsset {
  id: string
  name: string
  type: string
  data: ArrayBuffer
}

export interface NativeProjectDraftPayload {
  manifest: unknown
  assets: NativeDraftAsset[]
}

export interface NativeServiceActionResult {
  ok: boolean
  error?: string
  logs?: string[]
}

export type NativeLocalServiceName = 'panelcleaner' | 'ollama'

export type NativePanelCleanerDependencyState = 'missing' | 'ready' | 'broken' | 'installing'
export type NativePanelCleanerDependencySource = 'explicit' | 'managed' | 'dev' | 'path'
export type NativePythonDependencyState = 'missing' | 'ready' | 'unsupported'

export interface NativePythonDependencyStatus {
  state: NativePythonDependencyState
  version?: string
  command?: string
  downloadUrl: string
  error?: string
  actionHint?: string
}

export interface NativePanelCleanerDependencyStatus {
  state: NativePanelCleanerDependencyState
  source?: NativePanelCleanerDependencySource
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
  python: NativePythonDependencyStatus
}

export interface NativePathPickResult {
  ok: boolean
  path?: string
  error?: string
}

export interface NativeManagedServiceStatus {
  running: boolean
  ownedByApp: boolean
  inFlightCount: number
  idleTimeoutMs: number | null
  idleDeadlineAt: number | null
  command: string | null
  lastError: string | null
}

export interface NativeWindowState {
  isMaximized: boolean
}

export type NativeUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'disabled'
  | 'error'

export interface NativeUpdateStatus {
  state: NativeUpdateState
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

export interface MoxzkRuntimeBridge {
  files: {
    saveFile(file: NativeFilePayload): Promise<NativeResult<string>>
    saveExportFiles(
      files: NativeFilePayload[],
      archiveName: string,
      options?: NativeSaveExportOptions,
    ): Promise<NativeResult<'folder'>>
  }
  projectDraft: {
    save(payload: NativeProjectDraftPayload): Promise<NativeResult<void>>
    load(): Promise<NativeResult<NativeProjectDraftPayload | null>>
    clear(): Promise<NativeResult<void>>
  }
  localServices: {
    beginUsage(service: NativeLocalServiceName): Promise<NativeResult<void>>
    endUsage(service: NativeLocalServiceName): Promise<NativeResult<void>>
    getManagedStatus(): Promise<NativeResult<Record<NativeLocalServiceName, NativeManagedServiceStatus>>>
    getPanelCleanerDependencyStatus(): Promise<NativeResult<NativePanelCleanerDependencyStatus>>
    installPython(): Promise<NativeResult<NativeServiceActionResult>>
    installOllama(): Promise<NativeResult<NativeServiceActionResult>>
    installPanelCleaner(): Promise<NativeResult<NativeServiceActionResult>>
    repairPanelCleaner(): Promise<NativeResult<NativeServiceActionResult>>
    pickPanelCleanerExecutable(): Promise<NativeResult<NativePathPickResult>>
    stopOwnedServices(): Promise<NativeResult<NativeServiceActionResult>>
    startPanelCleanerBridge(): Promise<NativeResult<NativeServiceActionResult>>
    startOllama(): Promise<NativeResult<NativeServiceActionResult>>
  }
  auth: {
    signInWithGoogle(): Promise<NativeResult<NativeServiceActionResult>>
  }
  app: {
    getVersion(): Promise<NativeResult<string>>
    openLogs(): Promise<NativeResult<NativeServiceActionResult>>
    openSettingsFolder(): Promise<NativeResult<NativeServiceActionResult>>
    openDraftsFolder(): Promise<NativeResult<NativeServiceActionResult>>
  }
  updates: {
    getStatus(): Promise<NativeResult<NativeUpdateStatus>>
    checkForUpdates(): Promise<NativeResult<NativeUpdateStatus>>
    installDownloadedUpdate(): Promise<NativeResult<void>>
    openReleases(): Promise<NativeResult<NativeServiceActionResult>>
    onStatusChange(callback: (status: NativeUpdateStatus) => void): () => void
  }
  secureStore: {
    getSecret(key: string): Promise<NativeResult<string | null>>
    setSecret(key: string, value: string): Promise<NativeResult<NativeServiceActionResult>>
    deleteSecret(key: string): Promise<NativeResult<NativeServiceActionResult>>
  }
  customProtocolAuth: {
    getCallbackUrl(path: string): Promise<NativeResult<string | null>>
  }
  windowControls: {
    minimize(): Promise<NativeResult<void>>
    toggleMaximize(): Promise<NativeResult<NativeWindowState>>
    close(): Promise<NativeResult<void>>
    getState(): Promise<NativeResult<NativeWindowState>>
    onStateChange(callback: (state: NativeWindowState) => void): () => void
  }
}

declare global {
  interface Window {
    moxzkRuntime?: MoxzkRuntimeBridge
  }
}
