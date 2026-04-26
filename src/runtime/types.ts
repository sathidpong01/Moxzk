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
    startOllama(): Promise<RuntimeActionResult>
    startPanelCleanerBridge(): Promise<RuntimeActionResult>
  }
  auth: {
    signInWithGoogle(): Promise<RuntimeActionResult>
  }
  secureStore: {
    getSecret(key: string): Promise<string | null>
    setSecret(key: string, value: string): Promise<RuntimeActionResult>
    deleteSecret(key: string): Promise<RuntimeActionResult>
  }
  customProtocolAuth: {
    getCallbackUrl(path: string): Promise<string | null>
  }
}
