import { useEffect, useRef, useState } from 'react'
import type { AlbumPage } from '../../types/database'
import { FileImage, Trash2, CheckCircle2, Loader2, AlertCircle, Paintbrush, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { downloadImage } from '../../services/storageService'

interface AlbumPageGridProps {
  pages: AlbumPage[]
  editMode?: boolean
  onOpenPage: (page: AlbumPage) => void
  onDeletePage: (pageId: string) => void
  onReorder?: (pageIds: string[]) => void
}

const STATUS_CONFIG: Record<AlbumPage['status'], { icon: typeof FileImage; color: string; label: string }> = {
  pending: { icon: FileImage, color: 'text-[var(--mg-dim)]', label: 'รอดำเนินการ' },
  processing: { icon: Loader2, color: 'text-blue-300', label: 'กำลังประมวลผล' },
  clean_done: { icon: Paintbrush, color: 'text-yellow-300', label: 'คลีนแล้ว' },
  translated: { icon: CheckCircle2, color: 'text-green-300', label: 'แปลแล้ว' },
  error: { icon: AlertCircle, color: 'text-red-300', label: 'ผิดพลาด' },
}

function LazyThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || !src) return
    if (src.startsWith('data:') || src.startsWith('blob:') || /^https?:\/\//.test(src)) {
      setResolvedSrc(src)
      return
    }
    let cancelled = false
    downloadImage(src)
      .then((url) => {
        if (!cancelled) setResolvedSrc(url)
      })
      .catch((error) => {
        console.warn('[album] thumbnail download failed:', error)
        if (!cancelled) setResolvedSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [isVisible, src])

  return (
    <div ref={ref} className="flex aspect-[2/3] items-center justify-center overflow-hidden bg-[#0b0b0b]">
      {!isVisible ? (
        <div className="h-full w-full animate-pulse bg-white/10" />
      ) : resolvedSrc ? (
        <img src={resolvedSrc} alt={alt} className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <FileImage size={24} className="text-[var(--mg-dim)]" />
      )}
    </div>
  )
}

export default function AlbumPageGrid({ pages, editMode, onOpenPage, onDeletePage, onReorder }: AlbumPageGridProps) {
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--mg-dim)]">
        <FileImage size={40} className="mb-3" />
        <p className="text-sm">ยังไม่มีหน้าในอัลบั้มนี้</p>
        <p className="text-xs mt-1">อัปโหลดรูปแล้วบันทึกเข้าอัลบั้มจาก Editor</p>
      </div>
    )
  }

  const handleMoveLeft = (index: number) => {
    if (index <= 0 || !onReorder) return
    const ids = pages.map((p) => p.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    onReorder(ids)
  }

  const handleMoveRight = (index: number) => {
    if (index >= pages.length - 1 || !onReorder) return
    const ids = pages.map((p) => p.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    onReorder(ids)
  }

  const handleDropOnPage = (targetIndex: number) => {
    if (!draggedPageId || !onReorder) return
    const fromIndex = pages.findIndex((page) => page.id === draggedPageId)
    if (fromIndex < 0 || fromIndex === targetIndex) {
      setDraggedPageId(null)
      return
    }
    const ids = pages.map((page) => page.id)
    const [moved] = ids.splice(fromIndex, 1)
    ids.splice(targetIndex, 0, moved)
    setDraggedPageId(null)
    onReorder(ids)
  }

  return (
    <>
      {editMode && (
        <div className="mb-2 px-1">
          <p className="text-xs text-yellow-300">
            โหมดแก้ไข: ลาก thumbnail เพื่อเรียงหน้าใหม่ หรือใช้ปุ่มลูกศรเป็นทางเลือก
          </p>
        </div>
      )}
      <div className="grid justify-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(112px,132px))] sm:[grid-template-columns:repeat(auto-fill,minmax(128px,148px))]">
        {pages.map((page, index) => {
          const cfg = STATUS_CONFIG[page.status]
          const Icon = cfg.icon

          return (
            <div
              key={page.id}
              draggable={Boolean(editMode)}
              className={`group relative overflow-hidden rounded-[8px] border bg-[#181818] p-1.5 transition-all hover:bg-[#202020] ${
                editMode
                  ? `cursor-grab border-yellow-300/50 ring-1 ring-yellow-300/20 ${draggedPageId === page.id ? 'opacity-50' : ''}`
                  : 'border-[var(--mg-border)] hover:border-[var(--mg-border-strong)] cursor-pointer'
              }`}
              onDragStart={(event) => {
                if (!editMode) return
                setDraggedPageId(page.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', page.id)
              }}
              onDragOver={(event) => {
                if (!editMode || !draggedPageId) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                if (!editMode) return
                event.preventDefault()
                handleDropOnPage(index)
              }}
              onDragEnd={() => setDraggedPageId(null)}
              onClick={() => {
                if (!editMode) onOpenPage(page)
              }}
            >
              {/* Thumbnail — lazy loaded */}
              <LazyThumbnail
                src={page.thumbnail_key as string | null}
                alt={`หน้า ${page.page_number}`}
              />

              {/* Status */}
              <div className="absolute top-1 right-1">
                <div className={`mg-pill gap-0.5 bg-black/70 ${cfg.color} backdrop-blur`}>
                  <Icon size={8} className={page.status === 'processing' ? 'animate-spin' : ''} />
                </div>
              </div>

              {/* Page number */}
              <div className="px-1.5 py-1.5 text-center">
                <span className="font-mono text-[10px] text-[var(--mg-muted)]">
                  #{String(page.page_number).padStart(3, '0')}
                </span>
              </div>

              {/* Edit mode controls */}
              {editMode ? (
                <>
                  <div className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-[6px] bg-black/70 text-yellow-100 backdrop-blur" title="ลากเพื่อเรียงหน้า">
                    <GripVertical size={11} />
                  </div>

                  {/* Move arrows */}
                  <div className="absolute bottom-7 left-0 right-0 flex justify-center gap-0.5">
                    <button
                      className="mg-icon-button h-6 w-6 bg-black/70 backdrop-blur disabled:opacity-30"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveLeft(index)
                      }}
                      title="เลื่อนไปซ้าย"
                    >
                      <ChevronLeft size={10} />
                    </button>
                    <button
                      className="mg-icon-button h-6 w-6 bg-black/70 backdrop-blur disabled:opacity-30"
                      disabled={index === pages.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveRight(index)
                      }}
                      title="เลื่อนไปขวา"
                    >
                      <ChevronRight size={10} />
                    </button>
                  </div>

                  {/* Delete button (always visible in edit mode) */}
                  <button
                    className="mg-icon-button absolute right-1 top-1 h-6 w-6 bg-red-500/80 text-white backdrop-blur"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeletePage(page.id)
                    }}
                    title="ลบหน้านี้"
                  >
                    <Trash2 size={10} />
                  </button>
                </>
              ) : (
                /* Normal mode: delete on hover */
                <button
                  className="mg-icon-button absolute left-1 top-1 h-6 w-6 bg-black/70 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePage(page.id)
                  }}
                  title="ลบหน้านี้"
                >
                  <Trash2 size={10} className="text-red-300" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
