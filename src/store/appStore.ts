import { create } from 'zustand'
import type { AppStep, TextRegion, AppSettings, ExportFormat, ActiveTool, BrushStroke, ImageEntry } from '../types'
import type { AlbumPage } from '../types/database'
import { DEFAULT_MOOD_MAP, restoreCustomFont } from '../config/fonts'
import { loadSettings, saveSettings } from '../services/settingsStorage'
import { DEFAULT_TRANSLATION_STYLE_GUIDE } from '../services/story-context'
import { getAllFonts } from '../services/fontStorage'
import { downloadImage } from '../services/storageService'
import { resolveHydratedAlbumImageUrls } from '../services/albumImageUrls'
import { parseApiError } from '../utils/parseApiError'
import { toast } from 'sonner'

const DEFAULT_SETTINGS: AppSettings = {
  cleanupBackend: 'panelcleaner',
  translatorApiUrl: import.meta.env.VITE_TRANSLATOR_API_URL ?? 'http://localhost:5003',
  panelCleanerBridgeUrl: import.meta.env.VITE_PANELCLEANER_BRIDGE_URL ?? 'http://localhost:5055',
  panelCleanerExecutablePath: '',
  panelCleanerUseOcrFallback: true,
  sourceLang: 'auto',
  fontMoodMap: DEFAULT_MOOD_MAP,
  theme: 'studio-dark',
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL ?? 'http://localhost:11434',
  ollamaModel: import.meta.env.VITE_OLLAMA_MODEL ?? 'gemma4',
  ollamaApiKey: '',
  translationContextEnabled: true,
  translationStyleGuide: DEFAULT_TRANSLATION_STYLE_GUIDE,
}

export type PanelId = 'brush' | 'properties' | 'resource' | 'logs'
type ProcessKind = 'ai' | 'loading' | null

interface AppStore {
  // Navigation
  currentStep: AppStep
  setStep: (step: AppStep) => void

  // Images
  images: File[]
  setImages: (files: File[]) => void
  cleanedImageUrl: string | null
  originalImageUrl: string | null
  translatedImageUrl: string | null
  setTranslatedImageUrl: (url: string | null) => void

  // Multi-image
  imageEntries: ImageEntry[]
  activeImageId: string | null
  setActiveImage: (id: string) => void
  addImageEntries: (files: File[]) => void
  removeImageEntry: (id: string) => void
  reorderImages: (fromIndex: number, toIndex: number) => void
  updateImageEntry: (id: string, updates: Partial<ImageEntry>) => void
  saveActiveEntryState: () => void
  updateArtboardPosition: (id: string, x: number, y: number) => void
  moveArtboardAndReorder: (id: string, x: number, y: number) => ImageEntry[]
  resetArtboardLayout: () => void

  // Regions
  regions: TextRegion[]
  setRegions: (regions: TextRegion[]) => void
  updateRegion: (id: string, updates: Partial<TextRegion>) => void
  deleteRegion: (id: string) => void
  selectedRegionId: string | null
  selectRegion: (id: string | null) => void

  // Active tool
  activeTool: ActiveTool
  setActiveTool: (tool: ActiveTool) => void

  // Brush / Paint
  brushColor: string
  brushSize: number
  brushOpacity: number
  brushShadowBlur: number
  setBrushColor: (color: string) => void
  setBrushSize: (size: number) => void
  setBrushOpacity: (opacity: number) => void
  setBrushShadowBlur: (blur: number) => void
  brushStrokes: BrushStroke[]
  addBrushStroke: (stroke: BrushStroke) => void
  undoBrushStroke: () => void
  redoBrushStroke: () => void
  _brushRedoStack: BrushStroke[]
  clearBrushStrokes: () => void

  // Text overlay visibility
  showTextOverlay: boolean
  toggleTextOverlay: (show?: boolean) => void

  // Panels
  panels: Record<PanelId, boolean>
  togglePanel: (id: PanelId, show?: boolean) => void

  // Settings
  settings: AppSettings
  setSettings: (s: AppSettings) => void
  showSettings: boolean
  showFontConfig: boolean
  toggleSettings: (show?: boolean) => void
  toggleFontConfig: (show?: boolean) => void

  // Logs
  logs: string[]
  addLog: (msg: string) => void
  clearLogs: () => void

  // Export
  exportFormat: ExportFormat
  exportQuality: number
  setExportFormat: (f: ExportFormat) => void
  setExportQuality: (q: number) => void

  // Process
  isProcessing: boolean
  processKind: ProcessKind
  processRunId: number
  processAbortController: AbortController | null
  processError: string | null
  setProcessError: (e: string | null, runId?: number) => void

  // Actions
  goToEdit: () => void
  switchImage: (id: string) => void
  resetToUpload: () => void
  startProcess: () => number
  cancelProcess: () => void
  completeProcess: (regions: TextRegion[], cleanedUrl: string, runId?: number) => void
  loadAlbumPages: (pages: AlbumPage[], activePageId: string) => Promise<void>

  // Init
  init: () => Promise<void>
}

let _nextEntryId = 1
function generateEntryId(): string {
  return `img-${Date.now()}-${_nextEntryId++}`
}

async function hydrateAlbumEntryImage(entry: ImageEntry): Promise<{
  originalUrl: string
  cleanedUrl: string | null
  file: File | null
}> {
  let originalUrl = entry.originalUrl
  let cleanedUrl: string | null = null
  let file: File | null = null

  if (entry.originalR2Key) {
    originalUrl = await downloadImage(entry.originalR2Key)
    const res = await fetch(originalUrl)
    const blob = await res.blob()
    file = new File([blob], `page-${entry.pageNumber ?? entry.id}.webp`, { type: blob.type || 'image/webp' })
  }
  if (entry.cleanedR2Key) {
    cleanedUrl = await downloadImage(entry.cleanedR2Key)
  }

  return {
    ...resolveHydratedAlbumImageUrls(originalUrl, cleanedUrl),
    file,
  }
}

export const ARTBOARD_COLUMNS = 5
export const ARTBOARD_GAP_X = 96
export const ARTBOARD_GAP_Y = 112
export const ARTBOARD_MAX_PREVIEW_WIDTH = 300
export const ARTBOARD_HEADER_HEIGHT = 34
export const ARTBOARD_ROW_HEIGHT = ARTBOARD_MAX_PREVIEW_WIDTH * 1.45 + ARTBOARD_HEADER_HEIGHT + ARTBOARD_GAP_Y

export function getDefaultArtboardPosition(index: number) {
  return {
    x: 40 + (index % ARTBOARD_COLUMNS) * (ARTBOARD_MAX_PREVIEW_WIDTH + ARTBOARD_GAP_X),
    y: 48 + Math.floor(index / ARTBOARD_COLUMNS) * ARTBOARD_ROW_HEIGHT,
  }
}

function compareArtboardOrder(a: ImageEntry, b: ImageEntry): number {
  const fallbackA = getDefaultArtboardPosition((a.pageNumber ?? 1) - 1)
  const fallbackB = getDefaultArtboardPosition((b.pageNumber ?? 1) - 1)
  const ax = a.artboardX ?? fallbackA.x
  const ay = a.artboardY ?? fallbackA.y
  const bx = b.artboardX ?? fallbackB.x
  const by = b.artboardY ?? fallbackB.y
  const rowA = Math.round(ay / ARTBOARD_ROW_HEIGHT)
  const rowB = Math.round(by / ARTBOARD_ROW_HEIGHT)
  if (rowA !== rowB) return rowA - rowB
  if (Math.abs(ax - bx) > 1) return ax - bx
  return (a.pageNumber ?? 0) - (b.pageNumber ?? 0)
}

const DEFAULT_PANELS: Record<PanelId, boolean> = {
  brush: false,
  properties: true,
  resource: false,
  logs: false,
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Navigation
  currentStep: 'upload',
  setStep: (step) => set({ currentStep: step }),

  // Images
  images: [],
  setImages: (files) => set({ images: files }),
  cleanedImageUrl: null,
  originalImageUrl: null,
  translatedImageUrl: null,
  setTranslatedImageUrl: (url) => set({ translatedImageUrl: url }),

  // Multi-image
  imageEntries: [],
  activeImageId: null,
  setActiveImage: (id) => set({ activeImageId: id }),
  addImageEntries: (files) => {
    set((state) => {
      const newEntries: ImageEntry[] = files.map((file, index) => ({
        id: generateEntryId(),
        file,
        originalUrl: URL.createObjectURL(file),
        cleanedImageUrl: null,
        regions: [],
        brushStrokes: [],
        status: 'pending',
        pageNumber: state.imageEntries.length + index + 1,
        ...getDefaultArtboardPosition(state.imageEntries.length + index),
      }))
      const entries = [...state.imageEntries, ...newEntries]
      return {
        imageEntries: entries,
        activeImageId: state.activeImageId ?? newEntries[0]?.id ?? null,
        images: [...state.images, ...files],
      }
    })
  },
  removeImageEntry: (id) => {
    let nextActiveToLoad: string | null = null
    set((state) => {
      const entry = state.imageEntries.find((e) => e.id === id)
      if (entry?.originalUrl?.startsWith('blob:')) URL.revokeObjectURL(entry.originalUrl)
      const entries = state.imageEntries
        .filter((e) => e.id !== id)
        .map((e, index) => ({ ...e, pageNumber: index + 1, ...getDefaultArtboardPosition(index) }))
      const nextActiveId = state.activeImageId === id ? (entries[0]?.id ?? null) : state.activeImageId
      const nextActive = entries.find((e) => e.id === nextActiveId) ?? null
      if (state.activeImageId === id && nextActive?.imageLoaded === false && nextActive.originalR2Key) {
        nextActiveToLoad = nextActive.id
      }
      return {
        imageEntries: entries,
        images: entries.map((e) => e.file).filter((file): file is File => Boolean(file)),
        activeImageId: nextActiveId,
        ...(state.activeImageId === id
          ? {
              originalImageUrl: nextActive ? (nextActive.cleanedImageUrl ?? nextActive.originalUrl) : null,
              cleanedImageUrl: nextActive?.cleanedImageUrl ?? null,
              regions: nextActive?.regions ?? [],
              brushStrokes: nextActive?.brushStrokes ?? [],
              selectedRegionId: null,
              _brushRedoStack: [],
            }
          : {}),
      }
    })
    if (nextActiveToLoad) queueMicrotask(() => get().switchImage(nextActiveToLoad!))
  },
  reorderImages: (fromIndex, toIndex) =>
    set((state) => {
      const entries = [...state.imageEntries]
      const [moved] = entries.splice(fromIndex, 1)
      entries.splice(toIndex, 0, moved)
      return {
        imageEntries: entries.map((entry, index) => ({
          ...entry,
          pageNumber: index + 1,
          ...getDefaultArtboardPosition(index),
        })),
      }
    }),
  updateImageEntry: (id, updates) =>
    set((state) => ({
      imageEntries: state.imageEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      ...(state.activeImageId === id
        ? {
            regions: updates.regions ?? state.regions,
            brushStrokes: updates.brushStrokes ?? state.brushStrokes,
            cleanedImageUrl: updates.cleanedImageUrl !== undefined ? updates.cleanedImageUrl : state.cleanedImageUrl,
          }
        : {}),
    })),
  saveActiveEntryState: () => {
    const { activeImageId, regions, brushStrokes } = get()
    if (!activeImageId) return
    set((state) => ({
      imageEntries: state.imageEntries.map((entry) =>
        entry.id === activeImageId ? { ...entry, regions, brushStrokes } : entry,
      ),
    }))
  },
  updateArtboardPosition: (id, x, y) =>
    set((state) => ({
      imageEntries: state.imageEntries.map((entry) =>
        entry.id === id ? { ...entry, artboardX: Math.round(x), artboardY: Math.round(y) } : entry,
      ),
    })),
  moveArtboardAndReorder: (id, x, y) => {
    let nextEntries: ImageEntry[] = []
    set((state) => {
      const moved = state.imageEntries.map((entry) =>
        entry.id === id ? { ...entry, artboardX: Math.round(x), artboardY: Math.round(y) } : entry,
      )
      nextEntries = [...moved]
        .sort(compareArtboardOrder)
        .map((entry, index) => ({ ...entry, pageNumber: index + 1 }))
      return { imageEntries: nextEntries }
    })
    return nextEntries
  },
  resetArtboardLayout: () =>
    set((state) => ({
      imageEntries: state.imageEntries.map((entry, index) => ({
        ...entry,
        ...getDefaultArtboardPosition(index),
      })),
    })),

  // Regions
  regions: [],
  setRegions: (regions) => set({ regions }),
  updateRegion: (id, updates) =>
    set((state) => ({
      regions: state.regions.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      imageEntries: state.activeImageId
        ? state.imageEntries.map((entry) =>
            entry.id === state.activeImageId
              ? {
                  ...entry,
                  regions: entry.regions.map((region) =>
                    region.id === id ? { ...region, ...updates } : region,
                  ),
                }
              : entry,
          )
        : state.imageEntries,
    })),
  deleteRegion: (id) =>
    set((state) => ({
      regions: state.regions.filter((r) => r.id !== id),
      imageEntries: state.activeImageId
        ? state.imageEntries.map((entry) =>
            entry.id === state.activeImageId
              ? { ...entry, regions: entry.regions.filter((region) => region.id !== id) }
              : entry,
          )
        : state.imageEntries,
      selectedRegionId: state.selectedRegionId === id ? null : state.selectedRegionId,
    })),
  selectedRegionId: null,
  selectRegion: (id) => set({ selectedRegionId: id }),

  // Active tool
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Brush / Paint
  brushColor: '#ffffff',
  brushSize: 10,
  brushOpacity: 1,
  brushShadowBlur: 0,
  setBrushColor: (color) => set({ brushColor: color }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(50, size)) }),
  setBrushOpacity: (opacity) => set({ brushOpacity: Math.max(0, Math.min(1, opacity)) }),
  setBrushShadowBlur: (blur) => set({ brushShadowBlur: Math.max(0, Math.min(20, blur)) }),
  brushStrokes: [],
  _brushRedoStack: [],
  addBrushStroke: (stroke) =>
    set((state) => ({ brushStrokes: [...state.brushStrokes, stroke], _brushRedoStack: [] })),
  undoBrushStroke: () =>
    set((state) => {
      if (state.brushStrokes.length === 0) return state
      const strokes = [...state.brushStrokes]
      const removed = strokes.pop()!
      return { brushStrokes: strokes, _brushRedoStack: [...state._brushRedoStack, removed] }
    }),
  redoBrushStroke: () =>
    set((state) => {
      if (state._brushRedoStack.length === 0) return state
      const redo = [...state._brushRedoStack]
      const restored = redo.pop()!
      return { brushStrokes: [...state.brushStrokes, restored], _brushRedoStack: redo }
    }),
  clearBrushStrokes: () => set({ brushStrokes: [], _brushRedoStack: [] }),

  // Text overlay visibility
  showTextOverlay: true,
  toggleTextOverlay: (show) => set((state) => ({ showTextOverlay: show ?? !state.showTextOverlay })),

  // Panels
  panels: { ...DEFAULT_PANELS },
  togglePanel: (id, show) =>
    set((state) => ({
      panels: { ...state.panels, [id]: show ?? !state.panels[id] },
    })),

  // Settings
  settings: loadSettings(DEFAULT_SETTINGS),
  setSettings: (s) => {
    set({ settings: s })
    saveSettings(s)
  },
  showSettings: false,
  showFontConfig: false,
  toggleSettings: (show) =>
    set((state) => ({ showSettings: show ?? !state.showSettings })),
  toggleFontConfig: (show) =>
    set((state) => ({ showFontConfig: show ?? !state.showFontConfig })),

  // Logs
  logs: [],
  addLog: (msg) => set((state) => ({ logs: [...state.logs.slice(-200), msg] })),
  clearLogs: () => set({ logs: [] }),

  // Export
  exportFormat: 'webp',
  exportQuality: 95,
  setExportFormat: (f) => set({ exportFormat: f }),
  setExportQuality: (q) => set({ exportQuality: q }),

  // Process
  isProcessing: false,
  processKind: null,
  processRunId: 0,
  processAbortController: null,
  processError: null,
  setProcessError: (e, runId) => {
    const current = get()
    if (runId !== undefined && runId !== current.processRunId) return
    if (e) {
      const parsed = parseApiError(e)
      set((state) => ({
        processError: parsed.shortMessage,
        isProcessing: false,
        processKind: null,
        processRunId: state.processRunId + 1,
        processAbortController: null,
        imageEntries: state.activeImageId
          ? state.imageEntries.map((entry) =>
              entry.id === state.activeImageId
                ? { ...entry, status: 'error', error: parsed.shortMessage }
                : entry,
            )
          : state.imageEntries,
      }))
      toast.error(parsed.shortMessage)
    } else {
      set((state) => ({
        processError: null,
        isProcessing: false,
        processKind: null,
        processRunId: state.processRunId + 1,
        processAbortController: null,
      }))
    }
  },

  // Actions
  goToEdit: () => {
    const { images, imageEntries } = get()
    if (images.length === 0) return
    const firstEntry = imageEntries[0]
    const url = firstEntry?.originalUrl ?? URL.createObjectURL(images[0])
    set({
      currentStep: 'edit',
      originalImageUrl: url,
      activeImageId: firstEntry?.id ?? null,
      regions: firstEntry?.regions ?? [],
      brushStrokes: firstEntry?.brushStrokes ?? [],
      cleanedImageUrl: firstEntry?.cleanedImageUrl ?? null,
      processError: null,
    })
  },

  switchImage: (id: string) => {
    const { activeImageId, regions, brushStrokes, imageEntries } = get()
    // Save current image state
    const updated = [...imageEntries]
    if (activeImageId) {
      const idx = updated.findIndex((e) => e.id === activeImageId)
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], regions, brushStrokes }
      }
    }

    const target = updated.find((e) => e.id === id)
    if (!target) return

    // Apply switch immediately (show thumbnail/cached image)
    set({
      imageEntries: updated,
      activeImageId: id,
      originalImageUrl: target.cleanedImageUrl ?? target.originalUrl,
      cleanedImageUrl: target.cleanedImageUrl,
      regions: target.regions,
      brushStrokes: target.brushStrokes,
      selectedRegionId: null,
      _brushRedoStack: [],
    })

    // Lazy load full image from R2 if not yet loaded
    if (target.imageLoaded === false && target.originalR2Key) {
      set({ isProcessing: true, processKind: 'loading' })
      ;(async () => {
        try {
          const hydrated = await hydrateAlbumEntryImage(target)

          // Update entry with full image
          set((state) => {
            const entries = state.imageEntries.map((e) =>
              e.id === id
                ? {
                    ...e,
                    originalUrl: hydrated.originalUrl,
                    cleanedImageUrl: hydrated.cleanedUrl,
                    imageLoaded: true,
                    file: hydrated.file ?? e.file,
                  }
                : e,
            )
            const isStillActive = state.activeImageId === id
            return {
              imageEntries: entries,
              isProcessing: false,
              processKind: null,
              ...(isStillActive
                ? {
                    originalImageUrl: hydrated.originalUrl,
                    cleanedImageUrl: hydrated.cleanedUrl,
                  }
                : {}),
            }
          })
        } catch (err) {
          console.error('[switchImage] lazy download failed:', err)
          set({ isProcessing: false, processKind: null })
          toast.error('โหลดรูปจาก R2 ล้มเหลว')
        }
      })()
    }
  },

  resetToUpload: () => {
    const { imageEntries, originalImageUrl } = get()
    // Revoke all object URLs
    imageEntries.forEach((e) => {
      if (e.originalUrl?.startsWith('blob:')) URL.revokeObjectURL(e.originalUrl)
    })
    if (originalImageUrl?.startsWith('blob:')) URL.revokeObjectURL(originalImageUrl)
    set({
      currentStep: 'upload',
      images: [],
      imageEntries: [],
      activeImageId: null,
      cleanedImageUrl: null,
      originalImageUrl: null,
      translatedImageUrl: null,
      regions: [],
      selectedRegionId: null,
      brushStrokes: [],
      _brushRedoStack: [],
      logs: [],
      processError: null,
      isProcessing: false,
      processKind: null,
      processRunId: 0,
      processAbortController: null,
      activeTool: 'select',
    })
  },

  startProcess: () => {
    let nextRunId = 0
    const abortController = new AbortController()
    set((state) => ({
      processRunId: (nextRunId = state.processRunId + 1),
      processAbortController: abortController,
      processError: null,
      logs: [],
      isProcessing: true,
      processKind: 'ai',
      imageEntries: state.activeImageId
        ? state.imageEntries.map((entry) =>
            entry.id === state.activeImageId
              ? { ...entry, status: 'processing', error: undefined }
              : entry,
          )
        : state.imageEntries,
    }))
    toast.info('เริ่มประมวลผล AI...')
    return nextRunId
  },

  cancelProcess: () => {
    get().processAbortController?.abort()
    set((state) => ({
      isProcessing: false,
      processKind: null,
      processError: null,
      processRunId: state.processRunId + 1,
      processAbortController: null,
      imageEntries: state.activeImageId
        ? state.imageEntries.map((entry) =>
            entry.id === state.activeImageId && entry.status === 'processing'
              ? { ...entry, status: entry.cleanedImageUrl ? 'done' : 'pending', error: undefined }
              : entry,
          )
        : state.imageEntries,
    }))
    toast.info('ยกเลิกงาน AI แล้ว')
  },

  completeProcess: (regions, cleanedUrl, runId) => {
    const { activeImageId, isProcessing, processKind, processRunId } = get()
    if (runId !== undefined && runId !== processRunId) return
    if (!isProcessing || processKind !== 'ai') return
    set({
      regions,
      cleanedImageUrl: cleanedUrl,
      isProcessing: false,
      processKind: null,
      processRunId: processRunId + 1,
      processAbortController: null,
      brushStrokes: [],
      _brushRedoStack: [],
    })
    if (activeImageId) {
      get().updateImageEntry(activeImageId, {
        cleanedImageUrl: cleanedUrl,
        regions,
        status: 'done',
        progress: 100,
      })
    }
    toast.success(`แปลเสร็จ! พบ ${regions.length} regions`)
  },

  // ── Load album pages into editor with lazy loading ──
  loadAlbumPages: async (pages, activePageId) => {
    if (pages.length === 0) return

    // Reset state
    const { imageEntries: oldEntries, originalImageUrl: oldUrl } = get()
    oldEntries.forEach((e) => {
      if (e.originalUrl?.startsWith('blob:')) URL.revokeObjectURL(e.originalUrl)
    })
    if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl)

    // Build entries from album pages
    const activePage = pages.find((p) => p.id === activePageId) ?? pages[0]
    let nextId = 1

    const entries: ImageEntry[] = pages.map((page) => {
      // Use thumbnail as placeholder (data URL or empty)
      const thumbUrl =
        page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:')
          ? (page.thumbnail_key as string)
          : ''

      return {
        id: `album-${Date.now()}-${nextId++}`,
        file: null,
        originalUrl: thumbUrl,
        cleanedImageUrl: null,
        regions: Array.isArray(page.regions) ? (page.regions as TextRegion[]) : [],
        brushStrokes: Array.isArray(page.brush_strokes) ? (page.brush_strokes as BrushStroke[]) : [],
        status: page.status === 'translated'
          ? 'done'
          : page.status === 'clean_done'
            ? 'clean_done'
            : page.status === 'error'
              ? 'error'
              : 'pending',
        pageNumber: page.page_number,
        ...getDefaultArtboardPosition(page.page_number - 1),
        albumPageId: page.id,
        originalR2Key: (page.original_key as string) ?? undefined,
        cleanedR2Key: (page.cleaned_key as string) ?? undefined,
        imageLoaded: false,
      }
    })

    // Find active entry
    const activeEntry = entries.find((e) => e.albumPageId === activePage.id) ?? entries[0]

    // Set initial state with thumbnails
    set({
      currentStep: 'edit',
      images: [],
      imageEntries: entries,
      activeImageId: activeEntry.id,
      originalImageUrl: activeEntry.originalUrl,
      cleanedImageUrl: null,
      regions: activeEntry.regions,
      brushStrokes: activeEntry.brushStrokes,
      selectedRegionId: null,
      _brushRedoStack: [],
      logs: [],
      processError: null,
      isProcessing: true,
      processKind: 'loading',
      activeTool: 'select',
    })

    // Download full image for active page
    try {
      const hydrated = await hydrateAlbumEntryImage(activeEntry)

      // Update active entry
      set((state) => ({
        imageEntries: state.imageEntries.map((e) =>
          e.id === activeEntry.id
            ? {
                ...e,
                originalUrl: hydrated.originalUrl,
                cleanedImageUrl: hydrated.cleanedUrl,
                imageLoaded: true,
                file: hydrated.file ?? e.file,
              }
            : e,
        ),
        originalImageUrl: hydrated.originalUrl,
        cleanedImageUrl: hydrated.cleanedUrl,
        isProcessing: false,
        processKind: null,
      }))
    } catch (err) {
      console.error('[loadAlbumPages] download failed:', err)
      set({ isProcessing: false, processKind: null })
      toast.error('โหลดรูปจาก R2 ล้มเหลว')
    }

    void (async () => {
      for (const entry of entries) {
        if (entry.id === activeEntry.id || entry.imageLoaded !== false || !entry.originalR2Key) continue
        try {
          const hydrated = await hydrateAlbumEntryImage(entry)
          set((state) => ({
            imageEntries: state.imageEntries.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    originalUrl: hydrated.originalUrl,
                    cleanedImageUrl: hydrated.cleanedUrl,
                    imageLoaded: true,
                    file: hydrated.file ?? e.file,
                  }
                : e,
            ),
          }))
        } catch (error) {
          console.warn('[loadAlbumPages] background download failed:', entry.id, error)
        }
      }
    })()
  },

  // Init — restore custom fonts from IndexedDB
  init: async () => {
    try {
      const storedFonts = await getAllFonts()
      for (const sf of storedFonts) {
        try {
          await restoreCustomFont(sf)
        } catch {
          // font already registered or invalid
        }
      }
    } catch (err) {
      console.error('Failed to restore cached fonts:', err)
    }
  },
}))
