import { useCallback, useEffect, useRef, useState } from 'react'
import { useAlbumStore } from '../../store/albumStore'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import type { AppSettings } from '../../types'
import type { Album, AlbumPage } from '../../types/database'
import AlbumCard, { describeAlbumSourceLanguage, formatAlbumTimeAgo } from './AlbumCard'
import AlbumPageGrid from './AlbumPageGrid'
import ConfirmModal from './ConfirmModal'
import {
  X,
  ArrowLeft,
  Plus,
  FolderOpen,
  Loader2,
  LogIn,
  Save,
  ImagePlus,
  Image as ImageIcon,
  Download,
  Pencil,
  Check,
  Trash2,
  User,
  Lock,
  Heart,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAlbumOpenPlan } from '../../services/albumOpen'
import { exportAlbumPages } from '../../services/exporter'
import { saveEditorImagesToAlbum } from '../../services/albumEditorSave'
import { generateThumbnail } from '../../services/storageService'
import { SelectField, TextInput } from '../ui/primitives'

type ModalView = 'list' | 'detail' | 'create'
type SourceLanguage = AppSettings['sourceLang']
type SourceLanguageSelectValue = SourceLanguage | 'custom'

const BUILTIN_SOURCE_LANGUAGES = new Set<SourceLanguage>(['auto', 'ja', 'zh', 'en'])

const ALBUM_SOURCE_LANGUAGE_OPTIONS: Array<{ value: SourceLanguageSelectValue; label: string }> = [
  { value: 'auto', label: 'อัตโนมัติ' },
  { value: 'ja', label: 'ญี่ปุ่น' },
  { value: 'zh', label: 'จีน' },
  { value: 'en', label: 'อังกฤษ' },
  { value: 'custom', label: 'กำหนดเอง' },
]

function getAlbumSourceLanguageSelectValue(sourceLang?: string | null): SourceLanguageSelectValue {
  if (!sourceLang) return 'auto'
  return BUILTIN_SOURCE_LANGUAGES.has(sourceLang as SourceLanguage) ? (sourceLang as SourceLanguage) : 'custom'
}

export default function AlbumListModal() {
  const { user, profile } = useAuthStore()
  const {
    showAlbumModal,
    setShowAlbumModal,
    saveMode,
    albums,
    currentAlbum,
    currentPages,
    loading,
    pendingOpenAlbumId,
    fetchAlbums,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    setCurrentAlbum,
    consumePendingOpenAlbumId,
    fetchPages,
    deletePage,
  } = useAlbumStore(useShallow((state) => ({
    showAlbumModal: state.showAlbumModal,
    setShowAlbumModal: state.setShowAlbumModal,
    saveMode: state.saveMode,
    albums: state.albums,
    currentAlbum: state.currentAlbum,
    currentPages: state.currentPages,
    loading: state.loading,
    pendingOpenAlbumId: state.pendingOpenAlbumId,
    fetchAlbums: state.fetchAlbums,
    createAlbum: state.createAlbum,
    updateAlbum: state.updateAlbum,
    deleteAlbum: state.deleteAlbum,
    setCurrentAlbum: state.setCurrentAlbum,
    consumePendingOpenAlbumId: state.consumePendingOpenAlbumId,
    fetchPages: state.fetchPages,
    deletePage: state.deletePage,
  })))

  const isSupporter = profile?.supporter_unlocked ?? false
  const FREE_ALBUM_LIMIT = 1
  const FREE_PAGE_LIMIT = 50
  const atAlbumLimit = !isSupporter && albums.length >= FREE_ALBUM_LIMIT

  const [view, setView] = useState<ModalView>('list')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null)
  const [updatingSourceLang, setUpdatingSourceLang] = useState(false)
  const [customSourceLangDraft, setCustomSourceLangDraft] = useState('')

  const modalRef = useRef<HTMLDivElement>(null)

  // Focus first interactive element when modal opens or view changes
  useEffect(() => {
    if (!showAlbumModal) return
    const el = modalRef.current
    if (!el) return
    const firstFocusable = el.querySelector<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }, [showAlbumModal, view])

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [showCoverPicker, setShowCoverPicker] = useState(false)

  // Fetch albums when the album window opens
  useEffect(() => {
    if (showAlbumModal && user) {
      fetchAlbums()
      setView('list')
      setCurrentAlbum(null)
      setEditMode(false)
      setShowCoverPicker(false)
      setDetailLoadError(null)
    }
  }, [showAlbumModal, user, fetchAlbums, setCurrentAlbum])

  useEffect(() => {
    if (!currentAlbum) {
      setCustomSourceLangDraft('')
      return
    }
    const sourceLang = currentAlbum.source_lang?.trim() ?? ''
    setCustomSourceLangDraft(BUILTIN_SOURCE_LANGUAGES.has(sourceLang as SourceLanguage) ? '' : sourceLang)
  }, [currentAlbum?.id, currentAlbum?.source_lang])

  const closeModal = useCallback(() => {
    setEditMode(false)
    setShowCoverPicker(false)
    setDetailLoadError(null)
    setShowAlbumModal(false)
  }, [setShowAlbumModal])

  // Close on Escape
  useEffect(() => {
    if (!showAlbumModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showAlbumModal, closeModal])

  // ── Save current editor images to an album ──
  const handleSaveToAlbum = useCallback(
    async (album: Album) => {
      setSaving(true)
      try {
        const result = await saveEditorImagesToAlbum(album)
        if (result.savedCount > 0) {
          setCurrentAlbum(result.album)
          setDetailLoadError(null)
          closeModal()
        }
      } finally {
        setSaving(false)
      }
    },
    [setCurrentAlbum, closeModal],
  )

  const handleOpenAlbum = useCallback(
    async (album: Album) => {
      if (saveMode) {
        await handleSaveToAlbum(album)
        return
      }

      setLoadingPage(true)
      setCurrentAlbum(album)
      setEditMode(false)
      setShowCoverPicker(false)
      setDetailLoadError(null)
      try {
        const pages = await fetchPages(album.id, 'full')
        const openPlan = getAlbumOpenPlan(pages)
        if (!openPlan.shouldOpenEditor || !openPlan.activePageId) {
          toast.warning('อัลบั้มนี้ยังไม่มีหน้าให้เปิด')
          setView('detail')
          return
        }
        await useAppStore.getState().loadAlbumPages(pages, openPlan.activePageId)
        closeModal()
      } catch {
        setDetailLoadError('โหลดหน้าในอัลบั้มไม่สำเร็จ ลองอีกครั้งหรือเข้าเมนูจัดการอัลบั้มเพื่อตรวจสอบ')
        setView('detail')
      } finally {
        setLoadingPage(false)
      }
    },
    [closeModal, saveMode, handleSaveToAlbum, setCurrentAlbum, fetchPages],
  )

  const handleManageAlbum = useCallback(
    async (album: Album) => {
      setCurrentAlbum(album)
      setEditMode(false)
      setShowCoverPicker(false)
      setDetailLoadError(null)
      try {
        await fetchPages(album.id, 'summary')
        setView('detail')
      } catch {
        setDetailLoadError('โหลดข้อมูลอัลบั้มไม่สำเร็จ')
        setView('detail')
      }
    },
    [fetchPages, setCurrentAlbum],
  )

  useEffect(() => {
    if (!showAlbumModal || !pendingOpenAlbumId || loading) return
    const album = albums.find((item) => item.id === pendingOpenAlbumId)
    if (!album) {
      if (albums.length > 0) {
        consumePendingOpenAlbumId()
        toast.warning('ไม่พบอัลบั้มนี้แล้ว')
      }
      return
    }
    consumePendingOpenAlbumId()
    void handleManageAlbum(album)
  }, [albums, consumePendingOpenAlbumId, handleManageAlbum, loading, pendingOpenAlbumId, showAlbumModal])

  const handleDeleteAlbum = useCallback(
    (id: string) => {
      setConfirmData({
        title: 'ลบอัลบั้ม',
        message: 'อัลบั้มนี้และทุกหน้าในนั้นจะถูกลบถาวร',
        onConfirm: async () => {
          setConfirmOpen(false)
          setConfirmData(null)
          await deleteAlbum(id)
          const albumState = useAlbumStore.getState()
          const albumStillExists = albumState.currentAlbum?.id === id || albumState.albums.some((album) => album.id === id)
          if (albumStillExists) return
          setView('list')
          setCurrentAlbum(null)
          setEditMode(false)
          setShowCoverPicker(false)
          setDetailLoadError(null)
        },
      })
      setConfirmOpen(true)
    },
    [deleteAlbum, setCurrentAlbum],
  )

  const handleAlbumSourceLanguageChange = useCallback(
    async (nextSourceLang: SourceLanguageSelectValue) => {
      if (!currentAlbum || updatingSourceLang) return
      if (nextSourceLang === 'custom') {
        if (BUILTIN_SOURCE_LANGUAGES.has((currentAlbum.source_lang ?? '') as SourceLanguage)) {
          setCustomSourceLangDraft('')
        }
        return
      }
      if (currentAlbum.source_lang === nextSourceLang) return
      setUpdatingSourceLang(true)
      try {
        await updateAlbum(currentAlbum.id, { source_lang: nextSourceLang })
      } finally {
        setUpdatingSourceLang(false)
      }
    },
    [currentAlbum, updateAlbum, updatingSourceLang],
  )

  const handleCustomSourceLanguageSave = useCallback(async () => {
    if (!currentAlbum || updatingSourceLang) return
    const nextSourceLang = customSourceLangDraft.trim()
    if (!nextSourceLang) {
      toast.warning('กรอกชื่อภาษาก่อน')
      return
    }
    if (currentAlbum.source_lang === nextSourceLang) return
    setUpdatingSourceLang(true)
    try {
      await updateAlbum(currentAlbum.id, { source_lang: nextSourceLang })
    } finally {
      setUpdatingSourceLang(false)
    }
  }, [currentAlbum, customSourceLangDraft, updateAlbum, updatingSourceLang])

  const handleCreateAlbum = useCallback(async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const sourceLang = useAppStore.getState().settings.sourceLang
    const album = await createAlbum(newTitle.trim(), newDesc.trim() || undefined, sourceLang)
    setCreating(false)
    if (album) {
      setNewTitle('')
      setNewDesc('')
      if (saveMode) {
        // In save mode: immediately save to newly created album
        await handleSaveToAlbum(album)
      } else {
        setView('list')
      }
    }
  }, [newTitle, newDesc, createAlbum, saveMode, handleSaveToAlbum])

  const handleOpenPage = useCallback(
    async (page: AlbumPage) => {
      if (editMode) return // In edit mode, clicking doesn't open
      setLoadingPage(true)
      try {
        const appStore = useAppStore.getState()
        if (!currentAlbum) return
        const pages = await fetchPages(currentAlbum.id, 'full')
        await appStore.loadAlbumPages(pages, page.id)
        setDetailLoadError(null)
        closeModal()
      } catch {
        setDetailLoadError('โหลดหน้าในอัลบั้มไม่สำเร็จ')
      } finally {
        setLoadingPage(false)
      }
    },
    [closeModal, currentAlbum, editMode, fetchPages],
  )

  const handleDeletePage = useCallback(
    (pageId: string) => {
      setConfirmData({
        title: 'ลบหน้า',
        message: 'หน้านี้จะถูกลบถาวร ไม่สามารถกู้คืนได้',
        onConfirm: async () => {
          setConfirmOpen(false)
          setConfirmData(null)
          const deleted = await deletePage(pageId)
          if (!deleted) return
          const appStore = useAppStore.getState()
          const editorEntry = appStore.imageEntries.find((entry) => entry.albumPageId === pageId)
          if (editorEntry) appStore.removeImageEntry(editorEntry.id)
        },
      })
      setConfirmOpen(true)
    },
    [deletePage],
  )

  if (!showAlbumModal) return null

  const displayName = profile?.username
    || user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'User'

  const avatarUrl = profile?.avatar_url
    || user?.user_metadata?.avatar_url
    || user?.user_metadata?.picture

  const modalTitle = view === 'create'
    ? 'สร้างอัลบั้มใหม่'
    : view === 'detail'
      ? (currentAlbum?.title ?? 'อัลบั้ม')
      : (saveMode ? 'เลือกอัลบั้ม' : 'อัลบั้มของฉัน')

  return (
    <>
      <div className="fixed inset-0 z-100 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        />

        {/* Modal */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="album-modal-title"
          className="relative floating-panel mx-4 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-visible panel-enter"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--moxzk-border)] bg-[#151515]/95 px-5 py-3">
            <div className="flex items-center gap-2">
              {view !== 'list' && (
                <button
                  className="moxzk-icon-button h-7 w-7"
                  aria-label="ย้อนกลับ"
                  onClick={() => {
                    setView('list')
                    setCurrentAlbum(null)
                    setEditMode(false)
                    setShowCoverPicker(false)
                    setDetailLoadError(null)
                  }}
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              {saveMode ? (
                <Save size={16} className="text-green-300" />
              ) : (
                <FolderOpen size={16} className="text-[var(--moxzk-accent)]" />
              )}
              <h2 id="album-modal-title" className="font-bold text-base">{modalTitle}</h2>
              {saveMode && view === 'list' && (
                <span className="moxzk-pill text-green-300">โหมดบันทึก</span>
              )}
              {view === 'list' && albums.length > 0 && (
                <span className="moxzk-pill">{albums.length} อัลบั้ม</span>
              )}
              {view === 'detail' && currentPages.length > 0 && (
                <span className="moxzk-pill">{currentPages.length} หน้า</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {view === 'detail' && currentPages.length > 0 && (
                <button
                  className="moxzk-button moxzk-button-ghost moxzk-button-sm"
                  onClick={async () => {
                    if (!currentAlbum) return
                    toast.info('กำลัง export...')
                    await exportAlbumPages(currentPages, currentAlbum.title, {
                      format: 'webp',
                      quality: 0.92,
                      onProgress: (cur, total) => {
                        if (cur === total) toast.success(`export ${total} หน้าเสร็จ`)
                      },
                    })
                  }}
                >
                  <Download size={12} /> export
                </button>
              )}
              {view === 'detail' && (
                <button
                  className={`moxzk-button moxzk-button-sm ${editMode ? 'moxzk-button-soft text-yellow-200' : 'moxzk-button-ghost'}`}
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? (
                    <><Check size={12} /> เสร็จ</>
                  ) : (
                    <><Pencil size={12} /> แก้ไข</>
                  )}
                </button>
              )}
              {view === 'list' && (
                <button
                  className={`moxzk-button moxzk-button-sm ${atAlbumLimit ? 'moxzk-button-soft opacity-60' : 'moxzk-button-primary'}`}
                  onClick={() => !atAlbumLimit && setView('create')}
                  disabled={atAlbumLimit}
                  title={atAlbumLimit ? 'Free tier รองรับ 1 album — อัปเกรดเป็น Supporter เพื่อสร้างเพิ่ม' : undefined}
                >
                  {atAlbumLimit ? <Lock size={12} /> : <Plus size={12} />}
                  สร้างอัลบั้ม
                </button>
              )}
              {view === 'list' && user && (
                <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035]">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-8 w-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
                      <User size={14} />
                    </div>
                  )}
                </div>
              )}
              <button
                className="moxzk-icon-button h-7 w-7"
                aria-label="ปิด"
                onClick={closeModal}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Saving / Loading overlay */}
          {(saving || loadingPage) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[16px] bg-black/70 backdrop-blur">
              <Loader2 size={28} className="animate-spin text-[var(--moxzk-accent)]" />
              <p className="text-sm font-medium">{loadingPage ? 'กำลังโหลดอัลบั้ม...' : 'กำลังบันทึก...'}</p>
            </div>
          )}

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#101010] p-5">
            {!user && (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--moxzk-muted)]">
                <LogIn size={40} className="mb-3" />
                <p className="text-sm">กรุณาเข้าสู่ระบบเพื่อใช้ระบบอัลบั้ม</p>
                <button
                  className="moxzk-button moxzk-button-primary mt-3"
                  onClick={() => {
                    closeModal()
                    useAuthStore.getState().setShowAuthModal(true)
                  }}
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            )}

            {user && loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--moxzk-accent)]" />
              </div>
            )}

            {/* ── Album List View ── */}
            {user && !loading && view === 'list' && (
              <>
                {albums.length === 0 ? (
                  <div className="flex min-h-80 flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--moxzk-border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] px-6 text-center text-[var(--moxzk-dim)]">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--moxzk-border)] bg-white/[0.035]">
                      <FolderOpen size={22} />
                    </div>
                    <p className="text-base font-semibold text-[var(--moxzk-text)]">ยังไม่มีอัลบั้ม</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--moxzk-muted)]">สร้างอัลบั้มแรกเพื่อเก็บหน้าคลีนและงานแปลไว้ในชุดเดียวกัน</p>
                    <p className="mt-3 text-xs text-[var(--moxzk-dim)]">ใช้ปุ่มสร้างอัลบั้มด้านบนเพื่อเริ่มต้น</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <section className="space-y-4">
                      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--moxzk-dim)]">
                            {saveMode ? 'โหมดบันทึกงาน' : 'คลังอัลบั้ม'}
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-[var(--moxzk-text)]">
                            {saveMode ? 'เลือกอัลบั้มปลายทาง' : 'อัลบั้มทั้งหมด'}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isSupporter ? (
                            <span className="moxzk-pill inline-flex items-center gap-1 text-[var(--moxzk-supporter)]">
                              <Heart size={10} className="fill-[var(--moxzk-supporter)]" /> Supporter
                            </span>
                          ) : (
                            <span className={`moxzk-pill ${atAlbumLimit ? 'text-amber-300' : ''}`}>
                              {albums.length}/{FREE_ALBUM_LIMIT} album
                            </span>
                          )}
                          <span className="moxzk-pill">{saveMode ? 'พร้อมบันทึกงาน' : 'พร้อมเปิดต่อ'}</span>
                        </div>
                      </div>

                      <div className="grid justify-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,240px))] 2xl:[grid-template-columns:repeat(auto-fill,minmax(220px,250px))]">
                        {albums.map((album) => (
                          <AlbumCard
                            key={album.id}
                            album={album}
                            mode={saveMode ? 'save' : 'browse'}
                            onOpen={handleOpenAlbum}
                            onManage={handleManageAlbum}
                          />
                        ))}
                      </div>
                      {atAlbumLimit && (
                        <div className="flex items-center justify-between gap-4 rounded-[10px] border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Lock size={14} className="shrink-0 text-amber-300" />
                            <p className="text-sm text-amber-200/80">
                              Free tier รองรับ {FREE_ALBUM_LIMIT} album — Supporter ได้ unlimited
                            </p>
                          </div>
                          <button
                            className="moxzk-button moxzk-button-soft moxzk-button-sm shrink-0"
                            onClick={() => {
                              closeModal()
                              setTimeout(() => useAppStore.getState().openSettingsAtTab('supporter'), 150)
                            }}
                          >
                            <Heart size={11} /> อัปเกรด
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}

            {/* ── Album Detail View ── */}
            {user && !loading && view === 'detail' && currentAlbum && (
              <>
                {detailLoadError && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-[8px] border border-red-400/30 bg-red-500/10 px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-red-100">โหลดอัลบั้มไม่สำเร็จ</p>
                      <p className="mt-1 text-xs text-red-100/80">{detailLoadError}</p>
                    </div>
                    <button
                      className="moxzk-button moxzk-button-soft moxzk-button-sm"
                      onClick={async () => {
                        if (!currentAlbum) return
                        setLoadingPage(true)
                        try {
                          await fetchPages(currentAlbum.id, 'summary')
                          setDetailLoadError(null)
                        } catch {
                          // Store-level fetchPages already reports the failure.
                        } finally {
                          setLoadingPage(false)
                        }
                      }}
                    >
                      ลองใหม่
                    </button>
                  </div>
                )}

                <section className="relative z-20 mb-6 overflow-visible">
                  <div className="relative grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)_280px]">
                    <div>
                      <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex aspect-[3/4] items-center justify-center bg-[#111111]">
                          {currentAlbum.cover_key && (currentAlbum.cover_key as string).startsWith('data:') ? (
                            <img src={currentAlbum.cover_key as string} alt="cover" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--moxzk-dim)]">
                              <FolderOpen size={28} />
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">No cover</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-4">
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--moxzk-dim)]">Album Overview</p>
                        <h3 className="text-2xl font-bold leading-tight text-[var(--moxzk-text)]">{currentAlbum.title}</h3>
                        <p className="max-w-3xl text-sm leading-7 text-[var(--moxzk-muted)]">
                          {currentAlbum.description?.trim() || 'ยังไม่มีคำอธิบายอัลบั้มนี้ แต่คุณสามารถใช้ส่วนจัดการด้านขวาเพื่อกำหนดภาษาต้นฉบับ เลือกปกใหม่ หรือจัดการหน้าทั้งหมดได้ทันที'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="moxzk-pill px-3 py-1.5">{currentPages.length} หน้า</span>
                        <span className="moxzk-pill px-3 py-1.5">{describeAlbumSourceLanguage(currentAlbum.source_lang)}</span>
                        <span className="moxzk-pill px-3 py-1.5">{formatAlbumTimeAgo(currentAlbum.updated_at)}</span>
                        <span className="moxzk-pill px-3 py-1.5">
                          {currentAlbum.source_lang === 'auto' ? 'ตรวจภาษาก่อนแปล' : 'ใช้ค่าที่กำหนดเอง'}
                        </span>
                      </div>

                      {showCoverPicker && (
                        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--moxzk-dim)]">Choose Cover</p>
                              <p className="mt-1 text-sm text-[var(--moxzk-muted)]">เลือกจากรูปตัวอย่างของหน้าในอัลบั้ม</p>
                            </div>
                            <button
                              className="moxzk-button moxzk-button-ghost moxzk-button-sm"
                              onClick={() => setShowCoverPicker(false)}
                            >
                              ปิด
                            </button>
                          </div>
                          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(72px,1fr))]">
                            {currentPages.map((page) => (
                              <button
                                key={page.id}
                                className="overflow-hidden rounded-[12px] border border-[var(--moxzk-border)] bg-black/20 transition hover:border-[var(--moxzk-border-strong)]"
                                onClick={async () => {
                                  if (page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:')) {
                                    await useAlbumStore.getState().updateAlbum(currentAlbum.id, { cover_key: page.thumbnail_key })
                                    setShowCoverPicker(false)
                                  } else {
                                    toast.warning('หน้านี้ยังไม่มีรูปตัวอย่าง')
                                  }
                                }}
                              >
                                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden">
                                  {page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:') ? (
                                    <img src={page.thumbnail_key as string} alt={`#${page.page_number}`} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--moxzk-dim)]">
                                      #{page.page_number}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/[0.07] pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--moxzk-dim)]">Source Language</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--moxzk-muted)]">
                          ตั้งค่าให้ตรวจอัตโนมัติ หรือบังคับภาษาต้นฉบับเองสำหรับงานในอัลบั้มนี้
                        </p>
                        <SelectField<SourceLanguageSelectValue>
                          value={getAlbumSourceLanguageSelectValue(currentAlbum.source_lang)}
                          options={ALBUM_SOURCE_LANGUAGE_OPTIONS}
                          onChange={(value) => {
                            void handleAlbumSourceLanguageChange(value)
                          }}
                          buttonClassName="mt-3 min-h-11 rounded-[12px] border-white/10 bg-white/[0.04] text-sm"
                          className={`relative z-30 ${updatingSourceLang ? 'pointer-events-none opacity-70' : ''}`}
                        />
                        {getAlbumSourceLanguageSelectValue(currentAlbum.source_lang) === 'custom' && (
                          <div className="mt-3 grid gap-2">
                            <TextInput
                              value={customSourceLangDraft}
                              placeholder="เช่น เกาหลี, สเปน"
                              className="min-h-11 rounded-[12px] border-white/10 bg-white/[0.04]"
                              onChange={(event) => setCustomSourceLangDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void handleCustomSourceLanguageSave()
                                }
                              }}
                            />
                            <button
                              className="moxzk-button moxzk-button-soft min-h-10 justify-center rounded-[12px]"
                              onClick={() => {
                                void handleCustomSourceLanguageSave()
                              }}
                              disabled={!customSourceLangDraft.trim() || updatingSourceLang}
                            >
                              บันทึกภาษาที่กำหนดเอง
                            </button>
                          </div>
                        )}
                        <div className="pt-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--moxzk-dim)]">Quick Actions</p>
                          <div className="mt-3 grid gap-2">
                          <label className="moxzk-button moxzk-button-ghost min-h-11 cursor-pointer justify-center rounded-[12px]">
                            <ImagePlus size={12} />
                            อัปโหลดปกใหม่
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file || !currentAlbum) return
                                try {
                                  const thumbBlob = await generateThumbnail(file)
                                  const reader = new FileReader()
                                  reader.onload = async () => {
                                    const dataUrl = reader.result as string
                                    await useAlbumStore.getState().updateAlbum(currentAlbum.id, { cover_key: dataUrl })
                                  }
                                  reader.readAsDataURL(thumbBlob)
                                } catch { toast.error('อัปโหลดปกล้มเหลว') }
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {currentPages.length > 0 && (
                            <button
                              className="moxzk-button moxzk-button-soft min-h-11 justify-center rounded-[12px]"
                              onClick={() => setShowCoverPicker((open) => !open)}
                            >
                              <ImageIcon size={12} />
                              {showCoverPicker ? 'ซ่อนตัวเลือกปก' : 'เลือกปกจากหน้า'}
                            </button>
                          )}
                          <button
                            className="moxzk-button moxzk-button-danger min-h-11 justify-center rounded-[12px]"
                            onClick={() => handleDeleteAlbum(currentAlbum.id)}
                          >
                            <Trash2 size={12} />
                            ลบอัลบั้มนี้
                          </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="border-t border-white/[0.07] pt-6">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--moxzk-dim)]">Page Library</p>
                      <h4 className="mt-1 text-lg font-bold text-[var(--moxzk-text)]">หน้าทั้งหมด</h4>
                      <p className="mt-1 text-sm text-[var(--moxzk-muted)]">คลิกเพื่อเปิดหน้าเข้าโหมดแก้ไข หรือสลับเป็นโหมดจัดการเพื่อเรียงลำดับและลบหน้า</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isSupporter ? (
                        <span className="moxzk-pill">{currentPages.length} หน้า</span>
                      ) : (
                        <span className={`moxzk-pill ${currentPages.length >= FREE_PAGE_LIMIT ? 'text-amber-300' : ''}`}>
                          {currentPages.length}/{FREE_PAGE_LIMIT} หน้า
                        </span>
                      )}
                      {editMode && <span className="moxzk-pill text-yellow-100">โหมดแก้ไข</span>}
                    </div>
                  </div>
                  <AlbumPageGrid
                    pages={currentPages}
                    editMode={editMode}
                    onOpenPage={handleOpenPage}
                    onDeletePage={handleDeletePage}
                    onReorder={async (pageIds) => {
                      if (!currentAlbum) return
                      const { reorderPages } = useAlbumStore.getState()
                      await reorderPages(currentAlbum.id, pageIds)
                    }}
                  />
                </section>
              </>
            )}

            {/* ── Create Album View ── */}
            {user && view === 'create' && (
              <div className="mx-auto max-w-xl py-4">
                <div className="rounded-[10px] border border-[var(--moxzk-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="moxzk-label">
                        <span>ชื่ออัลบั้ม *</span>
                      </label>
                      <input
                        type="text"
                        className="moxzk-control"
                        placeholder="เช่น One Piece Vol.1"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        maxLength={100}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="moxzk-label">
                        <span>คำอธิบาย</span>
                      </label>
                      <textarea
                        className="moxzk-control min-h-20 resize-none"
                        placeholder="ไม่บังคับ"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        rows={2}
                        maxLength={500}
                      />
                    </div>
                    <button
                      className="moxzk-button moxzk-button-primary w-full"
                      onClick={handleCreateAlbum}
                      disabled={!newTitle.trim() || creating}
                    >
                      {creating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Plus size={16} /> {saveMode ? 'สร้างและบันทึก' : 'สร้างอัลบั้ม'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete dialog */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmData?.title ?? ''}
        message={confirmData?.message ?? ''}
        confirmLabel="ลบ"
        variant="error"
        onConfirm={() => confirmData?.onConfirm()}
        onCancel={() => {
          setConfirmOpen(false)
          setConfirmData(null)
        }}
      />
    </>
  )
}
