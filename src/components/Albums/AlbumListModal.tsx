import { useCallback, useEffect, useState } from 'react'
import { useAlbumStore } from '../../store/albumStore'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { buildStorageKey, fileToBlob, generateThumbnail, imageUrlToBlob, prepareImageUpload, uploadPreparedImage } from '../../services/storageService'
import { getAlbumOpenPlan } from '../../services/albumOpen'
import { exportAlbumPages } from '../../services/exporter'
import { getNextAlbumPageNumber, getPersistedPageStatus, resolveAlbumSaveTarget } from '../../services/albumSavePlan'
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
    fetchAlbums,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    setCurrentAlbum,
    fetchPages,
    deletePage,
    updatePage,
    saveCurrentToPage,
  } = useAlbumStore()

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

  // ── Save current editor images to an album ──
  const handleSaveToAlbum = useCallback(
    async (album: Album) => {
      const appState = useAppStore.getState()
      const userId = useAuthStore.getState().user?.id
      if (!userId) return

      const images = appState.imageEntries
      if (!images || images.length === 0) {
        toast.warning('ไม่มีรูปภาพให้บันทึก')
        return
      }

      setSaving(true)
      // Fetch current pages to know next page_number
      const existingPages = await fetchPages(album.id, 'summary')
      let nextPageNum = getNextAlbumPageNumber(existingPages)

      let savedCount = 0
      for (const entry of images) {
        try {
          const target = resolveAlbumSaveTarget(entry, existingPages, nextPageNum)
          const pageNumber = target.pageNumber
          let originalKey = entry.originalR2Key ?? (target.existingPage?.original_key as string | null) ?? undefined
          let cleanedKey = entry.cleanedR2Key ?? (target.existingPage?.cleaned_key as string | null) ?? undefined
          let thumbnailKey = (target.existingPage?.thumbnail_key as string | null) ?? undefined
          let originalHash = entry.originalHash
          let cleanedHash = entry.cleanedHash
          let thumbnailHash = entry.thumbnailHash
          let cleanedBlobForThumbnail: Blob | null = null

          // Generate a thumbnail from the cleaned image when available; otherwise use the original.
          let localThumbnailDataUrl: string | undefined
          let thumbnailSource: Blob | null = null
          let thumbnailBlob: Blob | null = null
          if (entry.cleanedImageUrl) {
            cleanedBlobForThumbnail = await imageUrlToBlob(entry.cleanedImageUrl)
            thumbnailSource = cleanedBlobForThumbnail
          } else if (entry.file) {
            thumbnailSource = fileToBlob(entry.file)
          } else if (entry.originalUrl) {
            try {
              thumbnailSource = await imageUrlToBlob(entry.originalUrl)
            } catch {
              thumbnailSource = null
            }
          }
          if (thumbnailSource && (!thumbnailKey || !thumbnailHash)) {
            thumbnailBlob = await generateThumbnail(thumbnailSource)
            localThumbnailDataUrl = await new Promise<string>((res, rej) => {
              const reader = new FileReader()
              reader.onload = () => res(reader.result as string)
              reader.onerror = rej
              reader.readAsDataURL(thumbnailBlob!)
            })
          }

          // ── Try R2 upload (optional) ──
          try {
            if (entry.file && (!originalKey || !originalHash)) {
              const origKey = buildStorageKey(userId, album.id, pageNumber, 'original')
              const prepared = await prepareImageUpload(fileToBlob(entry.file))
              if (!originalKey || originalHash !== prepared.sha256) {
                const origResult = await uploadPreparedImage(prepared, origKey)
                originalKey = origResult.key
              }
              originalHash = prepared.sha256
            }
            if (entry.cleanedImageUrl && (!cleanedKey || !cleanedHash)) {
              const cleanKey = buildStorageKey(userId, album.id, pageNumber, 'cleaned')
              const cleanedBlob = cleanedBlobForThumbnail ?? await imageUrlToBlob(entry.cleanedImageUrl)
              const prepared = await prepareImageUpload(cleanedBlob)
              if (!cleanedKey || cleanedHash !== prepared.sha256) {
                const cleanResult = await uploadPreparedImage(prepared, cleanKey)
                cleanedKey = cleanResult.key
              }
              cleanedHash = prepared.sha256
            }
            if (thumbnailSource && (!thumbnailKey || !thumbnailHash)) {
              const thumbKey = buildStorageKey(userId, album.id, pageNumber, 'thumbnail')
              const prepared = await prepareImageUpload(thumbnailBlob ?? await generateThumbnail(thumbnailSource))
              if (!thumbnailKey || thumbnailHash !== prepared.sha256) {
                const thumbResult = await uploadPreparedImage(prepared, thumbKey)
                thumbnailKey = thumbResult.key
              }
              thumbnailHash = prepared.sha256
            }
          } catch (uploadErr) {
            console.warn('[save] R2 upload skipped:', uploadErr)
          }

          // ── Always save metadata to Supabase DB ──
          const status: AlbumPage['status'] = getPersistedPageStatus(entry)
          const pagePayload = {
            regions: entry.regions ?? appState.regions,
            brushStrokes: entry.brushStrokes ?? appState.brushStrokes,
            status,
            artboardX: entry.artboardX ?? null,
            artboardY: entry.artboardY ?? null,
          }

          let result = target.existingPage
          if (target.existingPage) {
            await updatePage(target.existingPage.id, {
              page_number: pageNumber,
              original_key: originalKey ?? null,
              cleaned_key: cleanedKey ?? null,
              thumbnail_key: thumbnailKey ?? null,
              regions: pagePayload.regions,
              brush_strokes: pagePayload.brushStrokes,
              status,
              processing_mode: 'full',
              artboard_x: pagePayload.artboardX,
              artboard_y: pagePayload.artboardY,
            })
          } else {
            result = await saveCurrentToPage(album.id, pageNumber, pagePayload)
          }

          if (result) {
            const { updatePage, updateAlbum } = useAlbumStore.getState()
            if (!target.existingPage) {
              await updatePage(result.id, {
                original_key: originalKey ?? null,
                cleaned_key: cleanedKey ?? null,
                thumbnail_key: thumbnailKey ?? null,
                artboard_x: entry.artboardX ?? null,
                artboard_y: entry.artboardY ?? null,
              })
            }
            useAppStore.getState().updateImageEntry(entry.id, {
              albumPageId: result.id,
              originalR2Key: originalKey,
              cleanedR2Key: cleanedKey,
              originalHash,
              cleanedHash,
              thumbnailHash,
              pageNumber,
            })
            // Auto-set album cover from first saved page
            if (savedCount === 0 && !album.cover_key && localThumbnailDataUrl) {
              await updateAlbum(album.id, { cover_key: localThumbnailDataUrl })
            }
            savedCount++
            if (!target.existingPage) nextPageNum++
          }
        } catch (err) {
          console.error('[save] Error saving page:', err)
          toast.error(`บันทึกหน้า ${entry.pageNumber ?? nextPageNum} ล้มเหลว`)
        }
      }

      setSaving(false)
      if (savedCount > 0) {
        await fetchPages(album.id, 'summary')
        const updatedAlbum = useAlbumStore.getState().albums.find((item) => item.id === album.id) ?? album
        setCurrentAlbum(updatedAlbum)
        setDetailLoadError(null)
        toast.success(`บันทึก ${savedCount} หน้าลง "${album.title}" แล้ว`)
        closeModal()
      }
    },
    [fetchPages, saveCurrentToPage, setCurrentAlbum, updatePage, closeModal],
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

  const handleDeleteAlbum = useCallback(
    (id: string) => {
      setConfirmData({
        title: 'ลบอัลบั้ม',
        message: 'อัลบั้มนี้และทุกหน้าในนั้นจะถูกลบถาวร',
        onConfirm: async () => {
          setConfirmOpen(false)
          setConfirmData(null)
          await deleteAlbum(id)
        },
      })
      setConfirmOpen(true)
    },
    [deleteAlbum],
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
        <div className="relative floating-panel mx-4 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-visible panel-enter">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--mg-border)] bg-[#151515]/95 px-5 py-3">
            <div className="flex items-center gap-2">
              {view !== 'list' && (
                <button
                  className="mg-icon-button h-7 w-7"
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
                <FolderOpen size={16} className="text-[var(--mg-accent)]" />
              )}
              <h2 className="font-bold text-base">{modalTitle}</h2>
              {saveMode && view === 'list' && (
                <span className="mg-pill text-green-300">โหมดบันทึก</span>
              )}
              {view === 'list' && albums.length > 0 && (
                <span className="mg-pill">{albums.length} อัลบั้ม</span>
              )}
              {view === 'detail' && currentPages.length > 0 && (
                <span className="mg-pill">{currentPages.length} หน้า</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {view === 'detail' && currentPages.length > 0 && (
                <button
                  className="mg-button mg-button-ghost mg-button-sm"
                  onClick={async () => {
                    if (!currentAlbum) return
                    toast.info('กำลังส่งออก...')
                    await exportAlbumPages(currentPages, currentAlbum.title, {
                      format: 'webp',
                      quality: 0.92,
                      onProgress: (cur, total) => {
                        if (cur === total) toast.success(`ส่งออก ${total} หน้าเสร็จ`)
                      },
                    })
                  }}
                >
                  <Download size={12} /> ส่งออก
                </button>
              )}
              {view === 'detail' && (
                <button
                  className={`mg-button mg-button-sm ${editMode ? 'mg-button-soft text-yellow-200' : 'mg-button-ghost'}`}
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
                  className="mg-button mg-button-primary mg-button-sm"
                  onClick={() => setView('create')}
                >
                  <Plus size={12} /> สร้างอัลบั้ม
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
                className="mg-icon-button h-7 w-7"
                onClick={closeModal}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Saving / Loading overlay */}
          {(saving || loadingPage) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[16px] bg-black/70 backdrop-blur">
              <Loader2 size={28} className="animate-spin text-[var(--mg-accent)]" />
              <p className="text-sm font-medium">{loadingPage ? 'กำลังโหลดอัลบั้ม...' : 'กำลังบันทึก...'}</p>
            </div>
          )}

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#101010] p-5">
            {!user && (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--mg-muted)]">
                <LogIn size={40} className="mb-3" />
                <p className="text-sm">กรุณาเข้าสู่ระบบเพื่อใช้ระบบอัลบั้ม</p>
                <button
                  className="mg-button mg-button-primary mt-3"
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
                <Loader2 size={24} className="animate-spin text-[var(--mg-accent)]" />
              </div>
            )}

            {/* ── Album List View ── */}
            {user && !loading && view === 'list' && (
              <>
                {albums.length === 0 ? (
                  <div className="flex min-h-80 flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--mg-border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] px-6 text-center text-[var(--mg-dim)]">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--mg-border)] bg-white/[0.035]">
                      <FolderOpen size={22} />
                    </div>
                    <p className="text-base font-semibold text-[var(--mg-text)]">ยังไม่มีอัลบั้ม</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--mg-muted)]">สร้างอัลบั้มแรกเพื่อเก็บหน้าคลีนและงานแปลไว้ในชุดเดียวกัน</p>
                    <p className="mt-3 text-xs text-[var(--mg-dim)]">ใช้ปุ่มสร้างอัลบั้มด้านบนเพื่อเริ่มต้น</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <section className="rounded-[16px] border border-white/10 bg-[#171717] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
                      <div className="relative flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--mg-dim)]">
                            {saveMode ? 'โหมดบันทึกงาน' : 'คลังอัลบั้ม'}
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-[var(--mg-text)]">
                            {saveMode ? 'เลือกอัลบั้มปลายทาง' : 'อัลบั้มทั้งหมด'}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--mg-muted)]">
                            {saveMode ? 'คลิกการ์ดเพื่อบันทึกลงอัลบั้ม หรือเข้าไปดูรายละเอียดก่อนก็ได้' : 'ใช้รายการนี้เป็นคลังงานหลักและเข้าไปจัดการแต่ละอัลบั้มได้จากการ์ด'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="mg-pill">{albums.length} อัลบั้ม</span>
                          <span className="mg-pill">{saveMode ? 'พร้อมบันทึกงาน' : 'พร้อมเปิดต่อ'}</span>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--mg-dim)]">รายการอัลบั้ม</p>
                          <h3 className="mt-1 text-lg font-bold text-[var(--mg-text)]">อัลบั้มทั้งหมด</h3>
                        </div>
                        <span className="mg-pill">{albums.length} รายการ</span>
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
                      className="mg-button mg-button-soft mg-button-sm"
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

                <section className="relative z-20 mb-6 overflow-visible rounded-[22px] border border-white/10 bg-[#171717] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
                  <div className="relative grid gap-5 xl:grid-cols-[180px_minmax(0,1fr)_300px]">
                    <div>
                      <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex aspect-[3/4] items-center justify-center bg-[#111111]">
                          {currentAlbum.cover_key && (currentAlbum.cover_key as string).startsWith('data:') ? (
                            <img src={currentAlbum.cover_key as string} alt="cover" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--mg-dim)]">
                              <FolderOpen size={28} />
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">No cover</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-4">
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mg-dim)]">Album Overview</p>
                        <h3 className="text-2xl font-bold leading-tight text-[var(--mg-text)]">{currentAlbum.title}</h3>
                        <p className="max-w-3xl text-sm leading-7 text-[var(--mg-muted)]">
                          {currentAlbum.description?.trim() || 'ยังไม่มีคำอธิบายอัลบั้มนี้ แต่คุณสามารถใช้ส่วนจัดการด้านขวาเพื่อกำหนดภาษาต้นฉบับ เลือกปกใหม่ หรือจัดการหน้าทั้งหมดได้ทันที'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="mg-pill px-3 py-1.5">{currentPages.length} หน้า</span>
                        <span className="mg-pill px-3 py-1.5">{describeAlbumSourceLanguage(currentAlbum.source_lang)}</span>
                        <span className="mg-pill px-3 py-1.5">{formatAlbumTimeAgo(currentAlbum.updated_at)}</span>
                        <span className="mg-pill px-3 py-1.5">
                          {currentAlbum.source_lang === 'auto' ? 'ตรวจภาษาก่อนแปล' : 'ใช้ค่าที่กำหนดเอง'}
                        </span>
                      </div>

                      {showCoverPicker && (
                        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mg-dim)]">Choose Cover</p>
                              <p className="mt-1 text-sm text-[var(--mg-muted)]">เลือกจาก thumbnail ของหน้าในอัลบั้ม</p>
                            </div>
                            <button
                              className="mg-button mg-button-ghost mg-button-sm"
                              onClick={() => setShowCoverPicker(false)}
                            >
                              ปิด
                            </button>
                          </div>
                          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(72px,1fr))]">
                            {currentPages.map((page) => (
                              <button
                                key={page.id}
                                className="overflow-hidden rounded-[12px] border border-[var(--mg-border)] bg-black/20 transition hover:border-[var(--mg-border-strong)]"
                                onClick={async () => {
                                  if (page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:')) {
                                    await useAlbumStore.getState().updateAlbum(currentAlbum.id, { cover_key: page.thumbnail_key })
                                    setShowCoverPicker(false)
                                  } else {
                                    toast.warning('หน้านี้ยังไม่มี thumbnail')
                                  }
                                }}
                              >
                                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden">
                                  {page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:') ? (
                                    <img src={page.thumbnail_key as string} alt={`#${page.page_number}`} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--mg-dim)]">
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

                    <div className="rounded-[20px] border border-white/10 bg-[#202020] p-4">
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mg-dim)]">Source Language</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--mg-muted)]">
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
                              className="mg-button mg-button-soft min-h-10 justify-center rounded-[12px]"
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
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mg-dim)]">Quick Actions</p>
                          <div className="mt-3 grid gap-2">
                          <label className="mg-button mg-button-ghost min-h-11 cursor-pointer justify-center rounded-[12px]">
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
                              className="mg-button mg-button-soft min-h-11 justify-center rounded-[12px]"
                              onClick={() => setShowCoverPicker((open) => !open)}
                            >
                              <ImageIcon size={12} />
                              {showCoverPicker ? 'ซ่อนตัวเลือกปก' : 'เลือกปกจากหน้า'}
                            </button>
                          )}
                          <button
                            className="mg-button mg-button-danger min-h-11 justify-center rounded-[12px]"
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

                <section className="rounded-[18px] border border-white/10 bg-[#171717] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--mg-dim)]">Page Library</p>
                      <h4 className="mt-1 text-lg font-bold text-[var(--mg-text)]">หน้าทั้งหมด</h4>
                      <p className="mt-1 text-sm text-[var(--mg-muted)]">คลิกเพื่อเปิดหน้าเข้า editor หรือสลับเป็นโหมดแก้ไขเพื่อเรียงลำดับและลบหน้า</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mg-pill">{currentPages.length} หน้า</span>
                      {editMode && <span className="mg-pill text-yellow-100">โหมดแก้ไข</span>}
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
                <div className="rounded-[10px] border border-[var(--mg-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="mg-label">
                        <span>ชื่ออัลบั้ม *</span>
                      </label>
                      <input
                        type="text"
                        className="mg-control"
                        placeholder="เช่น One Piece Vol.1"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        maxLength={100}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="mg-label">
                        <span>คำอธิบาย</span>
                      </label>
                      <textarea
                        className="mg-control min-h-20 resize-none"
                        placeholder="ไม่บังคับ"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        rows={2}
                        maxLength={500}
                      />
                    </div>
                    <button
                      className="mg-button mg-button-primary w-full"
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
