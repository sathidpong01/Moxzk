import { create } from 'zustand'
import { toast } from 'sonner'
import {
  createAlbum as createCloudflareAlbum,
  createPage as createCloudflarePage,
  deleteAlbum as deleteCloudflareAlbum,
  deletePage as deleteCloudflarePage,
  fetchAlbums as fetchCloudflareAlbums,
  fetchPageSummaries as fetchCloudflarePageSummaries,
  fetchPages as fetchCloudflarePages,
  reorderPages as reorderCloudflarePages,
  updateAlbum as updateCloudflareAlbum,
  updatePage as updateCloudflarePage,
} from '../services/cloudflareApi'
import type { Album, AlbumPage } from '../types/database'
import { useAuthStore } from './authStore'

// Cloudflare API errors are cryptic for end users; keep the raw text in the
// console and show the user a consistent next step instead.
function notifyAlbumError(action: string, error: unknown): void {
  console.error(`[album] ${action} error:`, error)
  toast.error(`${action}ไม่สำเร็จ — ตรวจการเชื่อมต่อเน็ตแล้วลองอีกครั้ง`)
}

interface AlbumStore {
  albums: Album[]
  currentAlbum: Album | null
  currentPages: AlbumPage[]
  loading: boolean
  showAlbumModal: boolean
  saveMode: boolean
  pendingOpenAlbumId: string | null

  setShowAlbumModal: (show: boolean) => void
  setSaveMode: (save: boolean) => void
  openForSave: () => void
  openForBrowse: () => void
  openAlbumById: (albumId: string) => void
  consumePendingOpenAlbumId: () => string | null
  setCurrentAlbum: (album: Album | null) => void

  fetchAlbums: () => Promise<void>
  createAlbum: (title: string, description?: string, sourceLang?: string) => Promise<Album | null>
  updateAlbum: (id: string, updates: Partial<Pick<Album, 'title' | 'description' | 'cover_key' | 'source_lang'>>) => Promise<void>
  deleteAlbum: (id: string) => Promise<void>

  fetchPages: (albumId: string, detail?: 'summary' | 'full') => Promise<AlbumPage[]>
  createPage: (albumId: string, pageNumber: number) => Promise<AlbumPage | null>
  updatePage: (pageId: string, updates: Partial<Pick<AlbumPage, 'page_number' | 'original_key' | 'cleaned_key' | 'thumbnail_key' | 'artboard_x' | 'artboard_y' | 'regions' | 'brush_strokes' | 'status' | 'processing_mode' | 'error_message'>>) => Promise<void>
  deletePage: (pageId: string) => Promise<boolean>
  reorderPages: (albumId: string, pageIds: string[]) => Promise<void>

  saveCurrentToPage: (albumId: string, pageNumber: number, data: {
    regions: unknown
    brushStrokes: unknown
    status: AlbumPage['status']
    processingMode?: AlbumPage['processing_mode']
    artboardX?: number | null
    artboardY?: number | null
    originalKey?: string | null
    cleanedKey?: string | null
    thumbnailKey?: string | null
  }) => Promise<AlbumPage | null>
}

export const useAlbumStore = create<AlbumStore>((set, get) => ({
  albums: [],
  currentAlbum: null,
  currentPages: [],
  loading: false,
  showAlbumModal: false,
  saveMode: false,
  pendingOpenAlbumId: null,

  setShowAlbumModal: (show) => set({ showAlbumModal: show }),
  setSaveMode: (save) => set({ saveMode: save }),
  openForSave: () => set({ showAlbumModal: true, saveMode: true, pendingOpenAlbumId: null }),
  openForBrowse: () => set({ showAlbumModal: true, saveMode: false, pendingOpenAlbumId: null }),
  openAlbumById: (albumId) => set({ showAlbumModal: true, saveMode: false, pendingOpenAlbumId: albumId }),
  consumePendingOpenAlbumId: () => {
    const albumId = get().pendingOpenAlbumId
    set({ pendingOpenAlbumId: null })
    return albumId
  },
  setCurrentAlbum: (album) => set({ currentAlbum: album }),

  fetchAlbums: async () => {
    const user = useAuthStore.getState().user
    if (!user) return

    set({ loading: true })
    try {
      const albums = await fetchCloudflareAlbums()
      set({ albums, loading: false })
    } catch (error) {
      notifyAlbumError('โหลดอัลบั้ม', error)
      set({ loading: false })
    }
  },

  createAlbum: async (title, description, sourceLang) => {
    const user = useAuthStore.getState().user
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบก่อน')
      return null
    }

    try {
      const album = await createCloudflareAlbum({ title, description, sourceLang })
      set((state) => ({ albums: [album, ...state.albums] }))
      toast.success(`สร้างอัลบั้ม "${title}" แล้ว`)
      return album
    } catch (error) {
      notifyAlbumError('สร้างอัลบั้ม', error)
      return null
    }
  },

  updateAlbum: async (id, updates) => {
    try {
      await updateCloudflareAlbum(id, updates)
    } catch (error) {
      notifyAlbumError('แก้ไขอัลบั้ม', error)
      return
    }

    set((state) => ({
      albums: state.albums.map((a) =>
        a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a,
      ),
      currentAlbum: state.currentAlbum?.id === id
        ? { ...state.currentAlbum, ...updates, updated_at: new Date().toISOString() }
        : state.currentAlbum,
    }))
    toast.success('อัปเดตอัลบั้มแล้ว')
  },

  deleteAlbum: async (id) => {
    try {
      await deleteCloudflareAlbum(id)
    } catch (error) {
      notifyAlbumError('ลบอัลบั้ม', error)
      return
    }

    set((state) => ({
      albums: state.albums.filter((a) => a.id !== id),
      currentAlbum: state.currentAlbum?.id === id ? null : state.currentAlbum,
      currentPages: state.currentAlbum?.id === id ? [] : state.currentPages,
    }))
    toast.success('ลบอัลบั้มแล้ว')
  },

  fetchPages: async (albumId, detail = 'full') => {
    set({ loading: true, currentPages: [] })
    try {
      const pages = detail === 'summary'
        ? await fetchCloudflarePageSummaries(albumId)
        : await fetchCloudflarePages(albumId)
      set({ currentPages: pages, loading: false })
      return pages
    } catch (error) {
      notifyAlbumError('โหลดหน้า', error)
      set({ loading: false })
      throw error instanceof Error ? error : new Error('Failed to load album pages')
    }
  },

  createPage: async (albumId, pageNumber) => {
    try {
      const page = await createCloudflarePage(albumId, { pageNumber })
      set((state) => ({
        currentPages: [...state.currentPages, page].sort((a, b) => a.page_number - b.page_number),
      }))
      return page
    } catch (error) {
      notifyAlbumError('สร้างหน้า', error)
      return null
    }
  },

  updatePage: async (pageId, updates) => {
    try {
      await updateCloudflarePage(pageId, updates)
    } catch (error) {
      notifyAlbumError('อัปเดตหน้า', error)
      return
    }

    set((state) => ({
      currentPages: state.currentPages.map((p) =>
        p.id === pageId ? { ...p, ...updates, updated_at: new Date().toISOString() } : p,
      ),
    }))
  },

  deletePage: async (pageId) => {
    try {
      await deleteCloudflarePage(pageId)
    } catch (error) {
      notifyAlbumError('ลบหน้า', error)
      return false
    }

    const state = get()
    const hadPage = state.currentPages.some((p) => p.id === pageId)
    const remaining = state.currentPages
      .filter((p) => p.id !== pageId)
      .sort((a, b) => a.page_number - b.page_number)

    if (hadPage && state.currentAlbum && remaining.length > 0) {
      try {
        await reorderCloudflarePages(state.currentAlbum.id, remaining.map((p) => p.id))
      } catch (error) {
        console.error('[album] reorder after delete error:', error)
        toast.warning('ลบหน้าแล้ว แต่เรียงเลขหน้าใหม่ไม่สำเร็จ')
      }
    }

    set({
      currentPages: remaining.map((p, i) => ({
        ...p,
        page_number: i + 1,
      })),
    })

    toast.success('ลบหน้าแล้ว')
    return true
  },

  reorderPages: async (albumId, pageIds) => {
    const previousPages = get().currentPages
    const updates = pageIds.map((id, index) => ({ id, page_number: index + 1 }))

    set((state) => ({
      currentPages: state.currentPages
        .map((p) => {
          const newOrder = updates.find((u) => u.id === p.id)
          return newOrder ? { ...p, page_number: newOrder.page_number } : p
        })
        .sort((a, b) => a.page_number - b.page_number),
    }))

    try {
      await reorderCloudflarePages(albumId, pageIds)
    } catch (error) {
      set({ currentPages: previousPages })
      notifyAlbumError('เรียงหน้า', error)
    }
  },

  saveCurrentToPage: async (albumId, pageNumber, data) => {
    const existing = get().currentPages.find(
      (p) => p.album_id === albumId && p.page_number === pageNumber,
    )

    const patch = {
      regions: data.regions,
      brush_strokes: data.brushStrokes,
      status: data.status,
      processing_mode: data.processingMode || 'full',
      artboard_x: data.artboardX,
      artboard_y: data.artboardY,
      ...(data.originalKey !== undefined ? { original_key: data.originalKey } : {}),
      ...(data.cleanedKey !== undefined ? { cleaned_key: data.cleanedKey } : {}),
      ...(data.thumbnailKey !== undefined ? { thumbnail_key: data.thumbnailKey } : {}),
    }

    if (existing) {
      await get().updatePage(existing.id, patch)
      const updated = {
        ...existing,
        ...patch,
        processing_mode: patch.processing_mode || existing.processing_mode,
        artboard_x: patch.artboard_x ?? existing.artboard_x,
        artboard_y: patch.artboard_y ?? existing.artboard_y,
        updated_at: new Date().toISOString(),
      } as AlbumPage
      set((state) => ({
        currentPages: state.currentPages.map((p) => (p.id === existing.id ? updated : p)),
      }))
      toast.success(`บันทึกหน้า ${pageNumber} แล้ว`)
      return updated
    }

    try {
      const newPage = await createCloudflarePage(albumId, { pageNumber })
      await updateCloudflarePage(newPage.id, patch)
      const page = {
        ...newPage,
        ...patch,
        artboard_x: patch.artboard_x ?? null,
        artboard_y: patch.artboard_y ?? null,
        updated_at: new Date().toISOString(),
      } as AlbumPage
      set((state) => ({
        currentPages: [...state.currentPages, page].sort((a, b) => a.page_number - b.page_number),
      }))
      toast.success(`บันทึกหน้า ${pageNumber} แล้ว`)
      return page
    } catch (error) {
      notifyAlbumError('สร้างหน้า', error)
      return null
    }
  },
}))
