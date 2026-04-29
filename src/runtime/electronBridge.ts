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
}

export interface NativeWindowState {
  isMaximized: boolean
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
