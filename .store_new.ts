import { create } from 'zustand'
import type { AppStep, TextRegion, AppSettings, ExportFormat, ActiveTool, BrushStroke, ImageEntry } from '../types'
import type { AlbumPage } from '../types/database'
import { DEFAULT_MOOD_MAP, restoreCustomFont } from '../config/fonts'
import { loadSettings, saveSettings } from '../services/settingsStorage'
import { getAllFonts } from '../services/fontStorage'
import { downloadImage } from '../services/storageService'
import { parseApiError } from '../utils/parseApiError'
import { toast } from 'sonner'

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
  translatorApiUrl: import.meta.env.VITE_TRANSLATOR_API_URL ?? 'http://localhost:5003',
  sourceLang: 'auto',
  fontMoodMap: DEFAULT_MOOD_MAP,
  theme: 'dark',
  geminiModel: 'gemini-2.5-flash',
  translationEngine: 'gemini',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'typhoon2:8b',
  libreTranslateUrl: 'http://localhost:5004',
}

export type PanelId = 'brush' | 'properties' | 'resource' | 'quota' | 'logs'

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
  processError: string | null
  setProcessError: (e: string | null) => void

  // Actions
  goToEdit: () => void
  switchImage: (id: string) => void
  resetToUpload: () => void
  startProcess: () => void
  completeProcess: (regions: TextRegion[], cleanedUrl: string) => void
  loadAlbumPages: (pages: AlbumPage[], activePageId: string) => Promise<void>

  // Init
  init: () => Promise<void>
}

let _nextEntryId = 1
function generateEntryId(): string {
  return `img-${Date.now()}-${_nextEntryId++}`
}

const DEFAULT_PANELS: Record<PanelId, boolean> = {
  brush: false,
  properties: true,
  resource: false,
  quota: true,
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
    const newEntries: ImageEntry[] = files.map((file) => ({
      id: generateEntryId(),
      file,
      originalUrl: URL.createObjectURL(file),
      cleanedImageUrl: null,
      regions: [],
      brushStrokes: [],
      status: 'pending',
    }))
    set((state) => {
      const entries = [...state.imageEntries, ...newEntries]
      return {
        imageEntries: entries,
        activeImageId: state.activeImageId ?? newEntries[0]?.id ?? null,
        images: [...state.images, ...files],
      }
    })
  },
  removeImageEntry: (id) =>
    set((state) => {
      const entry = state.imageEntries.find((e) => e.id === id)
      if (entry) URL.revokeObjectURL(entry.originalUrl)
      const entries = state.imageEntries.filter((e) => e.id !== id)
      return {
        imageEntries: entries,
        activeImageId: state.activeImageId === id ? (entries[0]?.id ?? null) : state.activeImageId,
      }
    }),
  reorderImages: (fromIndex, toIndex) =>
    set((state) => {
      const entries = [...state.imageEntries]
      const [moved] = entries.splice(fromIndex, 1)
      entries.splice(toIndex, 0, moved)
      return { imageEntries: entries }
    }),
  updateImageEntry: (id, updates) =>
    set((state) => ({
      imageEntries: state.imageEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  // Regions
  regions: [],
  setRegions: (regions) => set({ regions }),
  updateRegion: (id, updates) =>
    set((state) => ({
      regions: state.regions.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  deleteRegion: (id) =>
    set((state) => ({
      regions: state.regions.filter((r) => r.id !== id),
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
  processError: null,
  setProcessError: (e) => {
    if (e) {
      const parsed = parseApiError(e)
      set({ processError: parsed.shortMessage, isProcessing: false })
      toast.error(parsed.shortMessage)
    } else {
      set({ processError: null, isProcessing: false })
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
      set({ isProcessing: true })
      ;(async () => {
        try {
          const originalUrl = await downloadImage(target.originalR2Key!)
          let cleanedUrl: string | null = null
          if (target.cleanedR2Key) {
            cleanedUrl = await downloadImage(target.cleanedR2Key)
          }
          // Update entry with full image
          set((state) => {
            const entries = state.imageEntries.map((e) =>
              e.id === id
                ? {
                    ...e,
                    originalUrl: cleanedUrl ?? originalUrl,
                    cleanedImageUrl: cleanedUrl,
                    imageLoaded: true,
                  }
                : e,
            )
            const isStillActive = state.activeImageId === id
            return {
              imageEntries: entries,
              isProcessing: false,
              ...(isStillActive
                ? {
                    originalImageUrl: cleanedUrl ?? originalUrl,
                    cleanedImageUrl: cleanedUrl,
                  }
                : {}),
            }
          })
        } catch (err) {
          console.error('[switchImage] lazy download failed:', err)
          set({ isProcessing: false })
          toast.error('โหลดรูปจาก R2 ล้มเหลว')
        }
      })()
    }
  },

  resetToUpload: () => {
    const { imageEntries, originalImageUrl } = get()
    // Revoke all object URLs
    imageEntries.forEach((e) => URL.revokeObjectURL(e.originalUrl))
    if (originalImageUrl) URL.revokeObjectURL(originalImageUrl)
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
      activeTool: 'select',
    })
  },

  startProcess: () => {
    set({ processError: null, logs: [], isProcessing: true })
    toast.info('เริ่มประมวลผล AI...')
  },

  completeProcess: (regions, cleanedUrl) => {
    const { activeImageId } = get()
    set({
      regions,
      cleanedImageUrl: cleanedUrl,
      isProcessing: false,
      brushStrokes: [],
      _brushRedoStack: [],
    })
    if (activeImageId) {
      get().updateImageEntry(activeImageId, {
        cleanedImageUrl: cleanedUrl,
        regions,
        status: 'done',
      })
    }
    toast.success(`แปลเสร็จ! พบ ${regions.length} regions`)
  },

  // ── Load album pages into editor with lazy loading ──
  loadAlbumPages: async (pages, activePageId) => {
    if (pages.length === 0) return

    // Reset state
    const { imageEntries: oldEntries, originalImageUrl: oldUrl } = get()
    oldEntries.forEach((e) => { if (e.originalUrl) URL.revokeObjectURL(e.originalUrl) })
    if (oldUrl) URL.revokeObjectURL(oldUrl)

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
        status: page.status === 'translated' ? 'done' : 'pending',
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
      activeTool: 'select',
    })

    // Download full image for active page
    try {
      let originalUrl = activeEntry.originalUrl
      let cleanedUrl: string | null = null

      if (activeEntry.originalR2Key) {
        originalUrl = await downloadImage(activeEntry.originalR2Key)
      }
      if (activeEntry.cleanedR2Key) {
        cleanedUrl = await downloadImage(activeEntry.cleanedR2Key)
      }

      // Update active entry
      set((state) => ({
        imageEntries: state.imageEntries.map((e) =>
          e.id === activeEntry.id
            ? { ...e, originalUrl: cleanedUrl ?? originalUrl, cleanedImageUrl: cleanedUrl, imageLoaded: true }
            : e,
        ),
        originalImageUrl: cleanedUrl ?? originalUrl,
        cleanedImageUrl: cleanedUrl,
        isProcessing: false,
      }))
    } catch (err) {
      console.error('[loadAlbumPages] download failed:', err)
      set({ isProcessing: false })
      toast.error('โหลดรูปจาก R2 ล้มเหลว')
    }
  },

  // Init — restore custom fonts from IndexedDB + apply saved theme
  init: async () => {
    // Apply saved theme
    const { settings } = get()
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
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
