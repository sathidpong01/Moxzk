export type MoodType = 'normal' | 'shouting' | 'whisper' | 'comedy' | 'narration' | 'sfx'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface TextRegion {
  id: string
  bbox: BoundingBox
  originalText: string
  translatedText: string
  mood: MoodType
  suggestedFont: string
  fontSize: number
  fontColor: string
  rotation: number
}

export interface TranslatorConfig {
  translator: { translator: 'none' }
  detector: { detector: 'ctd'; detection_size: number }
  inpainter: { inpainter: 'lama_large'; inpainting_size: number }
  ocr: { ocr: '48px' }
}

export interface FontDefinition {
  name: string
  family: string
  weight: number
  style: 'normal' | 'italic'
  isCustom: boolean
  url?: string
}

export type FontMoodMap = Record<MoodType, FontDefinition>

export interface ProcessingState {
  status: 'idle' | 'detecting' | 'ocr' | 'inpainting' | 'translating' | 'done' | 'error'
  progress: number
  message: string
  queuePosition?: number
}

export interface TranslationResult {
  regions: TextRegion[]
  cleanedImageUrl: string
  originalImageUrl: string
}

export type ExportFormat = 'png' | 'jpg' | 'webp'

export interface ExportOptions {
  format: ExportFormat
  quality: number
  scale: number
}

export type AppStep = 'upload' | 'process' | 'edit' | 'export'

export interface AppState {
  currentStep: AppStep
  images: File[]
  processingState: ProcessingState
  translationResult: TranslationResult | null
  settings: AppSettings
}

export interface AppSettings {
  geminiApiKey: string
  translatorApiUrl: string
  sourceLang: 'ja' | 'zh' | 'en'
  fontMoodMap: FontMoodMap
}
