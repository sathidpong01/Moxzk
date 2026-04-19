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
  Pencil,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { buildStorageKey, fileToBlob, generateThumbnail, imageUrlToBlob, prepareImageUpload, uploadPreparedImage } from '../../services/storageService'
import { exportAlbumPages } from '../../services/exporter'
import { getNextAlbumPageNumber, getPersistedPageStatus, resolveAlbumSaveTarget } from '../../services/albumSavePlan'

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
      await fetchPages(album.id, 'summary')
      const existingPages = useAlbumStore.getState().currentPages
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
      setCurrentAlbum(album)
      await fetchPages(album.id, 'summary')
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
    async (page: AlbumPage) => {
      if (editMode) return // In edit mode, clicking doesn't open
      setLoadingPage(true)
      try {
        const appStore = useAppStore.getState()
        if (currentAlbum) await fetchPages(currentAlbum.id, 'full')
        await appStore.loadAlbumPages(useAlbumStore.getState().currentPages, page.id)
        closeModal()
      } catch (err) {
        console.error('[album] loadAlbumPages failed:', err)
        toast.error('โหลดอัลบั้มล้มเหลว')
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

  return (
    <>
      <div className="fixed inset-0 z-100 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        />

        {/* Modal */}
        <div className="relative floating-panel mx-4 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden panel-enter">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--mg-border)] bg-[#151515]/95 px-5 py-3">
            <div className="flex items-center gap-2">
              {view !== 'list' && (
                <button
                  className="mg-icon-button h-7 w-7"
                  onClick={() => {
                    setView('list')
                    setCurrentAlbum(null)
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
              <h2 className="font-bold text-base">
                {view === 'create' && 'สร้างอัลบั้มใหม่'}
                {view === 'list' && (saveMode ? 'เลือกอัลบั้มที่จะบันทึก' : 'อัลบั้มของฉัน')}
                {view === 'detail' && (currentAlbum?.title ?? 'อัลบั้ม')}
              </h2>
              {saveMode && view === 'list' && (
                <span className="mg-pill text-green-300">โหมดบันทึก</span>
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
                {saveMode && (
                  <div className="mb-4 rounded-[8px] border border-green-300/20 bg-green-300/5 px-3 py-2 text-xs text-green-100">
                    คลิกอัลบั้มเพื่อบันทึกรูปปัจจุบัน หรือสร้างอัลบั้มใหม่
                  </div>
                )}
                {albums.length === 0 ? (
                  <div className="flex min-h-80 flex-col items-center justify-center rounded-[8px] border border-dashed border-white/15 bg-white/[0.02] text-[var(--mg-dim)]">
                    <FolderOpen size={40} className="mb-3" />
                    <p className="text-sm font-semibold text-[var(--mg-muted)]">ยังไม่มีอัลบั้ม</p>
                    <p className="mt-1 text-xs">สร้างอัลบั้มแรกเพื่อเก็บหน้าที่คลีนหรือแปลแล้ว</p>
                    <button
                      className="mg-button mg-button-primary mt-3"
                      onClick={() => setView('create')}
                    >
                      <Plus size={12} /> สร้างอัลบั้มแรก
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mg-muted)]">คลังอัลบั้ม</p>
                        <p className="mt-1 text-xs text-[var(--mg-dim)]">{albums.length} อัลบั้ม</p>
                      </div>
                    </div>
                    <div className="grid justify-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,170px))] sm:[grid-template-columns:repeat(auto-fill,minmax(168px,188px))]">
                      {albums.map((album) => (
                        <AlbumCard
                          key={album.id}
                          album={album}
                          onOpen={handleOpenAlbum}
                          onDelete={handleDeleteAlbum}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Album Detail View ── */}
            {user && !loading && view === 'detail' && currentAlbum && (
              <>
                {/* Cover section */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[var(--mg-border)] bg-white/5">
                    {currentAlbum.cover_key && (currentAlbum.cover_key as string).startsWith('data:') ? (
                      <img src={currentAlbum.cover_key as string} alt="cover" className="w-full h-full object-cover" />
                    ) : (
                      <FolderOpen size={20} className="text-[var(--mg-dim)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="mb-1 text-xs text-[var(--mg-muted)]">ปกอัลบั้ม</p>
                    <div className="flex gap-1">
                      <label className="mg-button mg-button-ghost mg-button-sm cursor-pointer">
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
                          className="mg-button mg-button-ghost mg-button-sm"
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
                  <div className="mb-4 rounded-[8px] border border-[var(--mg-border)] bg-white/5 p-2">
                    <p className="mb-2 text-xs text-[var(--mg-muted)]">คลิกเลือกหน้าเป็นปกอัลบั้ม:</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {currentPages.map((page) => (
                        <button
                          key={page.id}
                          className="h-18 w-14 shrink-0 overflow-hidden rounded border border-[var(--mg-border)] transition-all hover:border-[var(--mg-border-strong)]"
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
                            <div className="flex h-full w-full items-center justify-center text-[8px] text-[var(--mg-dim)]">#{page.page_number}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
              </>
            )}

            {/* ── Create Album View ── */}
            {user && view === 'create' && (
              <div className="max-w-sm mx-auto space-y-4 py-4">
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
                    placeholder="(ไม่จำเป็น)"
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
