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

interface AlbumStore {
  albums: Album[]
  currentAlbum: Album | null
  currentPages: AlbumPage[]
  loading: boolean
  showAlbumModal: boolean
  saveMode: boolean

  setShowAlbumModal: (show: boolean) => void
  setSaveMode: (save: boolean) => void
  openForSave: () => void
  openForBrowse: () => void
  setCurrentAlbum: (album: Album | null) => void

  fetchAlbums: () => Promise<void>
  createAlbum: (title: string, description?: string, sourceLang?: string) => Promise<Album | null>
  updateAlbum: (id: string, updates: Partial<Pick<Album, 'title' | 'description' | 'cover_key' | 'source_lang'>>) => Promise<void>
  deleteAlbum: (id: string) => Promise<void>

  fetchPages: (albumId: string, detail?: 'summary' | 'full') => Promise<void>
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
  }) => Promise<AlbumPage | null>
}

export const useAlbumStore = create<AlbumStore>((set, get) => ({
  albums: [],
  currentAlbum: null,
  currentPages: [],
  loading: false,
  showAlbumModal: false,
  saveMode: false,

  setShowAlbumModal: (show) => set({ showAlbumModal: show }),
  setSaveMode: (save) => set({ saveMode: save }),
  openForSave: () => set({ showAlbumModal: true, saveMode: true }),
  openForBrowse: () => set({ showAlbumModal: true, saveMode: false }),
  setCurrentAlbum: (album) => set({ currentAlbum: album }),

  fetchAlbums: async () => {
    const user = useAuthStore.getState().user
    if (!user) return

    set({ loading: true })
    try {
      const albums = await fetchCloudflareAlbums()
      set({ albums, loading: false })
    } catch (error) {
      console.error('[album] fetchAlbums error:', error)
      toast.error('โหลดอัลบั้มล้มเหลว')
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
      console.error('[album] createAlbum error:', error)
      toast.error(error instanceof Error ? `สร้างอัลบั้มล้มเหลว: ${error.message}` : 'สร้างอัลบั้มล้มเหลว')
      return null
    }
  },

  updateAlbum: async (id, updates) => {
    try {
      await updateCloudflareAlbum(id, updates)
    } catch (error) {
      toast.error(error instanceof Error ? `แก้ไขอัลบั้มล้มเหลว: ${error.message}` : 'แก้ไขอัลบั้มล้มเหลว')
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
      toast.error(error instanceof Error ? `ลบอัลบั้มล้มเหลว: ${error.message}` : 'ลบอัลบั้มล้มเหลว')
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
    set({ loading: true })
    try {
      const pages = detail === 'summary'
        ? await fetchCloudflarePageSummaries(albumId)
        : await fetchCloudflarePages(albumId)
      set({ currentPages: pages, loading: false })
    } catch (error) {
      console.error('[album] fetchPages error:', error)
      toast.error('โหลดหน้าล้มเหลว')
      set({ loading: false })
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
      toast.error(error instanceof Error ? `สร้างหน้าล้มเหลว: ${error.message}` : 'สร้างหน้าล้มเหลว')
      return null
    }
  },

  updatePage: async (pageId, updates) => {
    try {
      await updateCloudflarePage(pageId, updates)
    } catch (error) {
      toast.error(error instanceof Error ? `อัปเดตหน้าล้มเหลว: ${error.message}` : 'อัปเดตหน้าล้มเหลว')
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
      toast.error(error instanceof Error ? `ลบหน้าล้มเหลว: ${error.message}` : 'ลบหน้าล้มเหลว')
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
      toast.error(error instanceof Error ? `เรียงหน้าล้มเหลว: ${error.message}` : 'เรียงหน้าล้มเหลว')
    }
  },

  saveCurrentToPage: async (albumId, pageNumber, data) => {
    const existing = get().currentPages.find(
      (p) => p.album_id === albumId && p.page_number === pageNumber,
    )

    if (existing) {
      await get().updatePage(existing.id, {
        regions: data.regions,
        brush_strokes: data.brushStrokes,
        status: data.status,
        processing_mode: data.processingMode || 'full',
        artboard_x: data.artboardX,
        artboard_y: data.artboardY,
      })
      const updated = {
        ...existing,
        regions: data.regions,
        brush_strokes: data.brushStrokes,
        status: data.status,
        processing_mode: data.processingMode || existing.processing_mode,
        artboard_x: data.artboardX ?? existing.artboard_x,
        artboard_y: data.artboardY ?? existing.artboard_y,
        updated_at: new Date().toISOString(),
      }
      set((state) => ({
        currentPages: state.currentPages.map((p) => (p.id === existing.id ? updated : p)),
      }))
      toast.success(`บันทึกหน้า ${pageNumber} แล้ว`)
      return updated
    }

    try {
      const newPage = await createCloudflarePage(albumId, {
        pageNumber,
      })
      await updateCloudflarePage(newPage.id, {
        regions: data.regions,
        brush_strokes: data.brushStrokes,
        status: data.status,
        processing_mode: data.processingMode || 'full',
        artboard_x: data.artboardX,
        artboard_y: data.artboardY,
      })
      const page = {
        ...newPage,
        regions: data.regions,
        brush_strokes: data.brushStrokes,
        status: data.status,
        processing_mode: data.processingMode || 'full',
        artboard_x: data.artboardX ?? null,
        artboard_y: data.artboardY ?? null,
        updated_at: new Date().toISOString(),
      }
      set((state) => ({
        currentPages: [...state.currentPages, page].sort((a, b) => a.page_number - b.page_number),
      }))
      toast.success(`บันทึกหน้า ${pageNumber} แล้ว`)
      return page
    } catch (error) {
      toast.error(error instanceof Error ? `สร้างหน้าล้มเหลว: ${error.message}` : 'สร้างหน้าล้มเหลว')
      return null
    }
  },
}))
