export type MoodType =
  | "normal"
  | "shouting"
  | "whisper"
  | "comedy"
  | "narration"
  | "sfx";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TextLayoutMode = "balloon_fit" | "artistic";
export type TextAlign = "left" | "center" | "right";
export type TextStrokeJoin = "round" | "bevel" | "miter";
export type TextBalloonShape = "round" | "cloud" | "box";
export type TextArtisticFit = "free" | "bubble_guided";

export interface TextRegion {
  id: string;
  bbox: BoundingBox;
  originalText: string;
  translatedText: string;
  mood: MoodType;
  suggestedFont: string;
  fontId?: string;
  fontSize: number;
  fontColor: string;
  rotation: number;
  strokeWidth: number;
  strokeColor: string;
  strokeJoin?: TextStrokeJoin;
  textLayoutMode?: TextLayoutMode;
  textAlign?: TextAlign;
  balloonShape?: TextBalloonShape;
  artisticFit?: TextArtisticFit;
  textScaleX?: number;
  textScaleY?: number;
  confidence?: number;
}

export interface TranslatorConfig {
  translator: {
    translator: "none";
    target_lang: string;
    no_text_lang_skip: boolean;
  };
  detector: { detector: "ctd"; detection_size: number };
  inpainter: { inpainter: "lama_large"; inpainting_size: number };
  ocr: { ocr: "48px" };
}

export interface FontDefinition {
  name: string;
  family: string;
  weight: number;
  style: "normal" | "italic";
  isCustom: boolean;
  url?: string;
}

export type FontMoodMap = Record<MoodType, FontDefinition>;

export interface ProcessingState {
  status:
    | "idle"
    | "detecting"
    | "ocr"
    | "inpainting"
    | "translating"
    | "done"
    | "error";
  progress: number;
  message: string;
  queuePosition?: number;
}

export interface TranslationResult {
  regions: TextRegion[];
  cleanedImageUrl: string;
  originalImageUrl: string;
}

export type ProcessingMode = "gemma_vision_full" | "clean_only";

export type ExportFormat = "png" | "jpg" | "webp";

export interface ExportOptions {
  format: ExportFormat;
  quality: number;
  scale: number;
}

export type AppStep = "upload" | "edit";

export type ActiveTool = "select" | "pan" | "brush" | "eraser" | "eyedropper";

export interface BrushStroke {
  id: string;
  points: number[];
  color: string;
  width: number;
  opacity: number;
  shadowBlur: number;
  tool: "brush" | "eraser";
}

export type ImageEntryStatus =
  | "pending"
  | "clean_queued"
  | "cleaning"
  | "clean_done"
  | "translate_queued"
  | "translating"
  | "processing"
  | "done"
  | "error";

export interface ImageEntry {
  id: string;
  file: File | null;
  originalUrl: string;
  cleanedImageUrl: string | null;
  regions: TextRegion[];
  brushStrokes: BrushStroke[];
  status: ImageEntryStatus;
  error?: string;
  lastErrorStage?: "clean" | "translate";
  pageNumber?: number;
  progress?: number;
  artboardX?: number;
  artboardY?: number;
  // Album metadata for lazy loading
  albumPageId?: string;
  originalR2Key?: string;
  cleanedR2Key?: string;
  originalHash?: string;
  cleanedHash?: string;
  thumbnailHash?: string;
  imageLoaded?: boolean;
}

export interface FloatingPanelPosition {
  x: number;
  y: number;
  visible: boolean;
}

export interface AppState {
  currentStep: AppStep;
  images: File[];
  processingState: ProcessingState;
  translationResult: TranslationResult | null;
  settings: AppSettings;
}

export interface AppSettings {
  panelCleanerBridgeUrl: string;
  panelCleanerExecutablePath: string;
  sourceLang: "auto" | "ja" | "zh" | "en";
  fontMoodMap: FontMoodMap;
  theme: string;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaApiKey: string;
  translationContextEnabled: boolean;
  translationStyleGuide: string;
}
