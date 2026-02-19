import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import type { Album, AlbumPage } from '../types/database'
import { toast } from 'sonner'

interface AlbumStore {
  albums: Album[]
  currentAlbum: Album | null
  currentPages: AlbumPage[]
  loading: boolean
  showAlbumModal: boolean

  // Actions
  setShowAlbumModal: (show: boolean) => void
  setCurrentAlbum: (album: Album | null) => void

  // CRUD Albums
  fetchAlbums: () => Promise<void>
  createAlbum: (title: string, description?: string, sourceLang?: string) => Promise<Album | null>
  updateAlbum: (id: string, updates: Partial<Pick<Album, 'title' | 'description' | 'cover_key' | 'source_lang'>>) => Promise<void>
  deleteAlbum: (id: string) => Promise<void>

  // CRUD Pages
  fetchPages: (albumId: string) => Promise<void>
  createPage: (albumId: string, pageNumber: number) => Promise<AlbumPage | null>
  updatePage: (pageId: string, updates: Partial<Pick<AlbumPage, 'original_key' | 'cleaned_key' | 'thumbnail_key' | 'regions' | 'brush_strokes' | 'status' | 'processing_mode' | 'error_message'>>) => Promise<void>
  deletePage: (pageId: string) => Promise<void>
  reorderPages: (albumId: string, pageIds: string[]) => Promise<void>

  // Save current editor state to album page
  saveCurrentToPage: (albumId: string, pageNumber: number, data: {
    regions: unknown
    brushStrokes: unknown
    status: AlbumPage['status']
    processingMode?: AlbumPage['processing_mode']
  }) => Promise<AlbumPage | null>
}

export const useAlbumStore = create<AlbumStore>((set, get) => ({
  albums: [],
  currentAlbum: null,
  currentPages: [],
  loading: false,
  showAlbumModal: false,

  setShowAlbumModal: (show) => set({ showAlbumModal: show }),
  setCurrentAlbum: (album) => set({ currentAlbum: album }),

  // ── Fetch all albums for current user ──
  fetchAlbums: async () => {
    const user = useAuthStore.getState().user
    if (!user) return

    set({ loading: true })
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[album] fetchAlbums error:', error.message)
      toast.error('โหลดอัลบั้มล้มเหลว')
      set({ loading: false })
      return
    }
    set({ albums: data ?? [], loading: false })
  },

  // ── Create album ──
  createAlbum: async (title, description, sourceLang) => {
    const user = useAuthStore.getState().user
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบก่อน')
      return null
    }

    const { data, error } = await supabase
      .from('albums')
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        source_lang: sourceLang || 'ja',
      })
      .select()
      .single()

    if (error) {
      console.error('[album] createAlbum error:', error.message)
      toast.error(`สร้างอัลบั้มล้มเหลว: ${error.message}`)
      return null
    }

    set((state) => ({ albums: [data, ...state.albums] }))
    toast.success(`สร้างอัลบั้ม "${title}" แล้ว`)
    return data
  },

  // ── Update album ──
  updateAlbum: async (id, updates) => {
    const { error } = await supabase
      .from('albums')
      .update(updates)
      .eq('id', id)

    if (error) {
      toast.error(`แก้ไขอัลบั้มล้มเหลว: ${error.message}`)
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

  // ── Delete album ──
  deleteAlbum: async (id) => {
    const { error } = await supabase
      .from('albums')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error(`ลบอัลบั้มล้มเหลว: ${error.message}`)
      return
    }

    set((state) => ({
      albums: state.albums.filter((a) => a.id !== id),
      currentAlbum: state.currentAlbum?.id === id ? null : state.currentAlbum,
      currentPages: state.currentAlbum?.id === id ? [] : state.currentPages,
    }))
    toast.success('ลบอัลบั้มแล้ว')
  },

  // ── Fetch pages for an album ──
  fetchPages: async (albumId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('album_pages')
      .select('*')
      .eq('album_id', albumId)
      .order('page_number', { ascending: true })

    if (error) {
      console.error('[album] fetchPages error:', error.message)
      toast.error('โหลดหน้าล้มเหลว')
      set({ loading: false })
      return
    }
    set({ currentPages: data ?? [], loading: false })
  },

  // ── Create page ──
  createPage: async (albumId, pageNumber) => {
    const { data, error } = await supabase
      .from('album_pages')
      .insert({ album_id: albumId, page_number: pageNumber })
      .select()
      .single()

    if (error) {
      toast.error(`สร้างหน้าล้มเหลว: ${error.message}`)
      return null
    }

    set((state) => ({
      currentPages: [...state.currentPages, data].sort((a, b) => a.page_number - b.page_number),
    }))
    return data
  },

  // ── Update page ──
  updatePage: async (pageId, updates) => {
    const { error } = await supabase
      .from('album_pages')
      .update(updates)
      .eq('id', pageId)

    if (error) {
      toast.error(`อัปเดตหน้าล้มเหลว: ${error.message}`)
      return
    }

    set((state) => ({
      currentPages: state.currentPages.map((p) =>
        p.id === pageId ? { ...p, ...updates, updated_at: new Date().toISOString() } : p,
      ),
    }))
  },

  // ── Delete page ──
  deletePage: async (pageId) => {
    const { error } = await supabase
      .from('album_pages')
      .delete()
      .eq('id', pageId)

    if (error) {
      toast.error(`ลบหน้าล้มเหลว: ${error.message}`)
      return
    }

    set((state) => ({
      currentPages: state.currentPages.filter((p) => p.id !== pageId),
    }))
    toast.success('ลบหน้าแล้ว')
  },

  // ── Reorder pages ──
  reorderPages: async (albumId, pageIds) => {
    // Update page_number based on new order
    const updates = pageIds.map((id, index) => ({
      id,
      page_number: index + 1,
    }))

    // Optimistic update
    set((state) => ({
      currentPages: state.currentPages
        .map((p) => {
          const newOrder = updates.find((u) => u.id === p.id)
          return newOrder ? { ...p, page_number: newOrder.page_number } : p
        })
        .sort((a, b) => a.page_number - b.page_number),
    }))

    // Batch update in DB
    for (const u of updates) {
      await supabase
        .from('album_pages')
        .update({ page_number: u.page_number })
        .eq('id', u.id)
        .eq('album_id', albumId)
    }
  },

  // ── Save current editor state to an album page ──
  saveCurrentToPage: async (albumId, pageNumber, data) => {
    // Check if page exists
    const existing = get().currentPages.find(
      (p) => p.album_id === albumId && p.page_number === pageNumber,
    )

    if (existing) {
      // Update existing page
      const { error } = await supabase
        .from('album_pages')
        .update({
          regions: data.regions,
          brush_strokes: data.brushStrokes,
          status: data.status,
          processing_mode: data.processingMode || 'full',
        })
        .eq('id', existing.id)

      if (error) {
        toast.error(`บันทึกหน้าล้มเหลว: ${error.message}`)
        return null
      }

      const updated = {
        ...existing,
        regions: data.regions,
        brush_strokes: data.brushStrokes,
        status: data.status,
        processing_mode: data.processingMode || existing.processing_mode,
        updated_at: new Date().toISOString(),
      }
      set((state) => ({
        currentPages: state.currentPages.map((p) => (p.id === existing.id ? updated : p)),
      }))
      toast.success(`บันทึกหน้า ${pageNumber} แล้ว`)
      return updated
    } else {
      // Create new page
      const { data: newPage, error } = await supabase
        .from('album_pages')
        .insert({
          album_id: albumId,
          page_number: pageNumber,
          regions: data.regions,
          brush_strokes: data.brushStrokes,
          status: data.status,
          processing_mode: data.processingMode || 'full',
        })
        .select()
        .single()

      if (error) {
        toast.error(`สร้างหน้าล้มเหลว: ${error.message}`)
        return null
      }

      set((state) => ({
        currentPages: [...state.currentPages, newPage].sort((a, b) => a.page_number - b.page_number),
      }))
      toast.success(`บันทึกหน้า ${pageNumber} แล้ว`)
      return newPage
    }
  },
}))
