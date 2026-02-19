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
  strokeWidth: number
  strokeColor: string
}

export interface TranslatorConfig {
  translator: {
    translator: 'none'
    target_lang: string
    no_text_lang_skip: boolean
  }
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

export type ProcessingMode = 'full' | 'clean_only' | 'ocr_only'

export type TranslationEngine = 'gemini' | 'libretranslate' | 'ollama'

export type GeminiModelId =
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-3-flash-preview'
  | 'gemini-3-pro-preview'

export type ExportFormat = 'png' | 'jpg' | 'webp'

export interface ExportOptions {
  format: ExportFormat
  quality: number
  scale: number
}

export type AppStep = 'upload' | 'edit' | 'export'

export type ActiveTool = 'select' | 'pan' | 'brush' | 'eraser' | 'eyedropper'

export interface BrushStroke {
  id: string
  points: number[]
  color: string
  width: number
  opacity: number
  shadowBlur: number
  tool: 'brush' | 'eraser'
}

export type ImageEntryStatus = 'pending' | 'processing' | 'done' | 'error'

export interface ImageEntry {
  id: string
  file: File
  originalUrl: string
  cleanedImageUrl: string | null
  regions: TextRegion[]
  brushStrokes: BrushStroke[]
  status: ImageEntryStatus
  error?: string
}

export interface FloatingPanelPosition {
  x: number
  y: number
  visible: boolean
}

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
  sourceLang: 'auto' | 'ja' | 'zh' | 'en'
  fontMoodMap: FontMoodMap
  theme: string
  geminiModel: GeminiModelId
  translationEngine: TranslationEngine
  ollamaUrl: string
  ollamaModel: string
  libreTranslateUrl: string
}
