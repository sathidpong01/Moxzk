import { useCallback, useEffect, useState } from 'react'
import { useAlbumStore } from '../../store/albumStore'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import type { Album, AlbumPage } from '../../types/database'
import AlbumCard from './AlbumCard'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { uploadImage, buildStorageKey, fileToBlob, dataUrlToBlob, generateThumbnail } from '../../services/storageService'
import { exportAlbumPages } from '../../services/exporter'

type ModalView = 'list' | 'detail' | 'create'

export default function AlbumListModal() {
  const { user } = useAuthStore()
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
    deleteAlbum,
    setCurrentAlbum,
    fetchPages,
    deletePage,
    saveCurrentToPage,
  } = useAlbumStore()

  const [view, setView] = useState<ModalView>('list')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [showCoverPicker, setShowCoverPicker] = useState(false)

  // Fetch albums when modal opens
  useEffect(() => {
    if (showAlbumModal && user) {
      fetchAlbums()
      setView('list')
      setCurrentAlbum(null)
    }
  }, [showAlbumModal, user, fetchAlbums, setCurrentAlbum])

  const closeModal = useCallback(() => {
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
      await fetchPages(album.id)
      const existingPages = useAlbumStore.getState().currentPages
      let nextPageNum = existingPages.length > 0
        ? Math.max(...existingPages.map((p) => p.page_number)) + 1
        : 1

      let savedCount = 0
      for (const entry of images) {
        try {
          // ── Generate thumbnail (always, as data URL for immediate display) ──
          let originalKey: string | undefined
          let cleanedKey: string | undefined
          let thumbnailKey: string | undefined

          // Always generate a local thumbnail data URL as fallback
          let localThumbnailDataUrl: string | undefined
          if (entry.file) {
            try {
              const thumbBlob = await generateThumbnail(fileToBlob(entry.file))
              localThumbnailDataUrl = await new Promise<string>((res, rej) => {
                const reader = new FileReader()
                reader.onload = () => res(reader.result as string)
                reader.onerror = rej
                reader.readAsDataURL(thumbBlob)
              })
            } catch { /* ignore */ }
          }

          // ── Try R2 upload (optional) ──
          try {
            if (entry.file) {
              const origKey = buildStorageKey(userId, album.id, nextPageNum, 'original')
              const origResult = await uploadImage(fileToBlob(entry.file), origKey)
              originalKey = origResult.key
            }
            if (entry.cleanedImageUrl) {
              const cleanKey = buildStorageKey(userId, album.id, nextPageNum, 'cleaned')
              const cleanedBlob = dataUrlToBlob(entry.cleanedImageUrl)
              const cleanResult = await uploadImage(cleanedBlob, cleanKey)
              cleanedKey = cleanResult.key
            }
            if (entry.file && localThumbnailDataUrl) {
              const thumbKey = buildStorageKey(userId, album.id, nextPageNum, 'thumbnail')
              const thumbBlob = dataUrlToBlob(localThumbnailDataUrl)
              const thumbResult = await uploadImage(thumbBlob, thumbKey)
              thumbnailKey = thumbResult.key
            }
          } catch (uploadErr) {
            console.warn('[save] R2 upload skipped:', uploadErr)
          }

          // Always use data URL for thumbnail_key (for instant display)
          // R2 thumbnail is just a backup
          thumbnailKey = localThumbnailDataUrl

          // ── Always save metadata to Supabase DB ──
          const status: AlbumPage['status'] = entry.cleanedImageUrl ? 'translated' : 'pending'
          const result = await saveCurrentToPage(album.id, nextPageNum, {
            regions: entry.regions ?? appState.regions,
            brushStrokes: entry.brushStrokes ?? appState.brushStrokes,
            status,
          })

          if (result) {
            const { updatePage, updateAlbum } = useAlbumStore.getState()
            await updatePage(result.id, {
              original_key: originalKey ?? null,
              cleaned_key: cleanedKey ?? null,
              thumbnail_key: thumbnailKey ?? null,
            })
            // Auto-set album cover from first saved page
            if (savedCount === 0 && !album.cover_key && localThumbnailDataUrl) {
              await updateAlbum(album.id, { cover_key: localThumbnailDataUrl })
            }
            savedCount++
            nextPageNum++
          }
        } catch (err) {
          console.error('[save] Error saving page:', err)
          toast.error(`บันทึกหน้า ${nextPageNum} ล้มเหลว`)
        }
      }

      setSaving(false)
      if (savedCount > 0) {
        toast.success(`บันทึก ${savedCount} หน้าลง "${album.title}" แล้ว`)
        closeModal()
      }
    },
    [fetchPages, saveCurrentToPage, closeModal],
  )

  const handleOpenAlbum = useCallback(
    async (album: Album) => {
      if (saveMode) {
        await handleSaveToAlbum(album)
        return
      }
      setCurrentAlbum(album)
      await fetchPages(album.id)
      setView('detail')
    },
    [saveMode, handleSaveToAlbum, setCurrentAlbum, fetchPages],
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

  const handleCreateAlbum = useCallback(async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const album = await createAlbum(newTitle.trim(), newDesc.trim() || undefined)
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
    (_page: AlbumPage) => {
      // TODO: load page state into editor (Phase 4+)
      closeModal()
    },
    [closeModal],
  )

  const handleDeletePage = useCallback(
    (pageId: string) => {
      setConfirmData({
        title: 'ลบหน้า',
        message: 'หน้านี้จะถูกลบถาวร ไม่สามารถกู้คืนได้',
        onConfirm: async () => {
          setConfirmOpen(false)
          setConfirmData(null)
          await deletePage(pageId)
        },
      })
      setConfirmOpen(true)
    },
    [deletePage],
  )

  if (!showAlbumModal) return null

  return (
    <>
      <div className="fixed inset-0 z-100 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        />

        {/* Modal */}
        <div className="relative floating-panel w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col panel-enter">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-base-300/30 shrink-0">
            <div className="flex items-center gap-2">
              {view !== 'list' && (
                <button
                  className="btn btn-ghost btn-xs btn-square"
                  onClick={() => {
                    setView('list')
                    setCurrentAlbum(null)
                  }}
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              {saveMode ? (
                <Save size={16} className="text-success" />
              ) : (
                <FolderOpen size={16} className="text-primary" />
              )}
              <h2 className="font-bold text-base">
                {view === 'create' && 'สร้างอัลบั้มใหม่'}
                {view === 'list' && (saveMode ? 'เลือกอัลบั้มที่จะบันทึก' : 'อัลบั้มของฉัน')}
                {view === 'detail' && (currentAlbum?.title ?? 'อัลบั้ม')}
              </h2>
              {saveMode && view === 'list' && (
                <span className="badge badge-xs badge-success">โหมดบันทึก</span>
              )}
              {view === 'detail' && currentPages.length > 0 && (
                <span className="badge badge-xs badge-ghost">{currentPages.length} หน้า</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {view === 'detail' && currentPages.length > 0 && (
                <button
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={async () => {
                    if (!currentAlbum) return
                    toast.info('กำลัง export...')
                    await exportAlbumPages(currentPages, currentAlbum.title, {
                      format: 'webp',
                      quality: 0.92,
                      onProgress: (cur, total) => {
                        if (cur === total) toast.success(`Export ${total} หน้าเสร็จ!`)
                      },
                    })
                  }}
                >
                  <Download size={12} /> Export
                </button>
              )}
              {view === 'list' && (
                <button
                  className="btn btn-primary btn-xs gap-1"
                  onClick={() => setView('create')}
                >
                  <Plus size={12} /> สร้างอัลบั้ม
                </button>
              )}
              <button
                className="btn btn-ghost btn-xs btn-square"
                onClick={closeModal}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Saving overlay */}
          {saving && (
            <div className="absolute inset-0 z-10 bg-base-100/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-2xl">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm font-medium">กำลังบันทึก...</p>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {!user && (
              <div className="flex flex-col items-center justify-center py-12 text-base-content/40">
                <LogIn size={40} className="mb-3" />
                <p className="text-sm">กรุณาเข้าสู่ระบบเพื่อใช้ระบบอัลบั้ม</p>
                <button
                  className="btn btn-primary btn-sm mt-3"
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
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            )}

            {/* ── Album List View ── */}
            {user && !loading && view === 'list' && (
              <>
                {saveMode && (
                  <p className="text-xs text-base-content/50 mb-3">
                    คลิกที่อัลบั้มเพื่อบันทึกรูปปัจจุบันเข้าอัลบั้ม หรือสร้างอัลบั้มใหม่
                  </p>
                )}
                {albums.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
                    <FolderOpen size={40} className="mb-3" />
                    <p className="text-sm">ยังไม่มีอัลบั้ม</p>
                    <button
                      className="btn btn-primary btn-sm mt-3 gap-1"
                      onClick={() => setView('create')}
                    >
                      <Plus size={12} /> สร้างอัลบั้มแรก
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {albums.map((album) => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        onOpen={handleOpenAlbum}
                        onDelete={handleDeleteAlbum}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Album Detail View ── */}
            {user && !loading && view === 'detail' && currentAlbum && (
              <>
                {/* Cover section */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-base-300/50 overflow-hidden flex items-center justify-center shrink-0 border border-base-300/50">
                    {currentAlbum.cover_key && (currentAlbum.cover_key as string).startsWith('data:') ? (
                      <img src={currentAlbum.cover_key as string} alt="cover" className="w-full h-full object-cover" />
                    ) : (
                      <FolderOpen size={20} className="text-base-content/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-base-content/50 mb-1">ปกอัลบั้ม</p>
                    <div className="flex gap-1">
                      <label className="btn btn-xs btn-ghost gap-1 cursor-pointer">
                        <ImagePlus size={12} />
                        อัปโหลด
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
                          className="btn btn-xs btn-ghost gap-1"
                          onClick={() => setShowCoverPicker(!showCoverPicker)}
                        >
                          <ImageIcon size={12} />
                          เลือกจากหน้า
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cover picker from pages */}
                {showCoverPicker && (
                  <div className="mb-4 p-2 rounded-lg bg-base-300/30 border border-base-300/50">
                    <p className="text-xs text-base-content/50 mb-2">คลิกเลือกหน้าเป็นปกอัลบั้ม:</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {currentPages.map((page) => (
                        <button
                          key={page.id}
                          className="shrink-0 w-14 h-18 rounded border border-base-300/50 hover:border-primary overflow-hidden transition-all"
                          onClick={async () => {
                            if (page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:')) {
                              await useAlbumStore.getState().updateAlbum(currentAlbum.id, { cover_key: page.thumbnail_key })
                              setShowCoverPicker(false)
                            } else {
                              toast.warning('หน้านี้ยังไม่มี thumbnail')
                            }
                          }}
                        >
                          {page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:') ? (
                            <img src={page.thumbnail_key as string} alt={`#${page.page_number}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-base-content/30">#{page.page_number}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <AlbumPageGrid
                  pages={currentPages}
                  onOpenPage={handleOpenPage}
                  onDeletePage={handleDeletePage}
                />
              </>
            )}

            {/* ── Create Album View ── */}
            {user && view === 'create' && (
              <div className="max-w-sm mx-auto space-y-4 py-4">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm font-medium">ชื่ออัลบั้ม *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="เช่น One Piece Vol.1"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={100}
                    autoFocus
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm font-medium">คำอธิบาย</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    placeholder="(ไม่จำเป็น)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    maxLength={500}
                  />
                </div>
                <button
                  className="btn btn-primary w-full gap-1"
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
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete modal */}
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
