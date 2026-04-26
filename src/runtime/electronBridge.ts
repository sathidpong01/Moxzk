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
}

export interface MgRuntimeBridge {
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
    startPanelCleanerBridge(): Promise<NativeResult<NativeServiceActionResult>>
    startOllama(): Promise<NativeResult<NativeServiceActionResult>>
  }
}

declare global {
  interface Window {
    mgRuntime?: MgRuntimeBridge
  }
}
