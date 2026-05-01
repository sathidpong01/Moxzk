import { useEffect, useRef, useState } from 'react'
import type { AlbumPage } from '../../types/database'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileImage, GripVertical, Loader2, Paintbrush, Trash2 } from 'lucide-react'
import { downloadImage } from '../../services/storageService'

interface AlbumPageGridProps {
  pages: AlbumPage[]
  editMode?: boolean
  onOpenPage: (page: AlbumPage) => void
  onDeletePage: (pageId: string) => void
  onReorder?: (pageIds: string[]) => void
}

const STATUS_CONFIG: Record<AlbumPage['status'], { icon: typeof FileImage; color: string; label: string }> = {
  pending: { icon: FileImage, color: 'text-[var(--moxzk-dim)]', label: 'รอดำเนินการ' },
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
        <FileImage size={24} className="text-[var(--moxzk-dim)]" />
      )}
    </div>
  )
}

export default function AlbumPageGrid({ pages, editMode, onOpenPage, onDeletePage, onReorder }: AlbumPageGridProps) {
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)

  if (pages.length === 0) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--moxzk-border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] px-6 py-12 text-center text-[var(--moxzk-dim)]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--moxzk-border)] bg-white/[0.035]">
          <FileImage size={24} />
        </div>
        <p className="text-sm font-semibold text-[var(--moxzk-text)]">ยังไม่มีหน้าในอัลบั้มนี้</p>
        <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--moxzk-muted)]">บันทึกหน้าจาก Editor เข้ามาในอัลบั้ม แล้วค่อยกลับมาเปิด แก้ไข หรือเรียงลำดับจากที่นี่</p>
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
        <div className="mb-4 rounded-[12px] border border-yellow-300/20 bg-yellow-300/8 px-3 py-2.5">
          <p className="text-xs font-medium text-yellow-100">
            โหมดแก้ไข: ลากรูปตัวอย่างเพื่อเรียงหน้าใหม่ หรือใช้ปุ่มลูกศรเป็นทางเลือก
          </p>
        </div>
      )}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(172px,1fr))] 2xl:[grid-template-columns:repeat(auto-fill,minmax(182px,1fr))]">
        {pages.map((page, index) => {
          const cfg = STATUS_CONFIG[page.status]
          const Icon = cfg.icon

          return (
            <div
              key={page.id}
              draggable={Boolean(editMode)}
              className={`group relative flex h-full flex-col overflow-hidden rounded-[16px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--moxzk-border-strong)] hover:shadow-[0_22px_44px_rgba(0,0,0,0.24)] ${
                editMode
                  ? `cursor-grab border-yellow-300/50 ring-1 ring-yellow-300/20 ${draggedPageId === page.id ? 'opacity-50' : ''}`
                  : 'cursor-pointer border-[var(--moxzk-border)]'
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
              <div className="relative overflow-hidden rounded-[12px] border border-white/10 bg-black/20">
                <LazyThumbnail
                  src={page.thumbnail_key as string | null}
                  alt={`หน้า ${page.page_number}`}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
              </div>

              {/* Status */}
              <div className="absolute right-5 top-5">
                <div className={`moxzk-pill gap-1 border-white/10 bg-black/65 ${cfg.color} backdrop-blur`}>
                  <Icon size={9} className={page.status === 'processing' ? 'animate-spin' : ''} />
                  <span className="max-w-20 truncate">{cfg.label}</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between gap-3 px-1 pb-1 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--moxzk-dim)]">
                    หน้า {String(page.page_number).padStart(3, '0')}
                  </span>
                </div>
                {!editMode && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--moxzk-text)]">เปิดหน้าในตัวแก้ไข</span>
                    <span className="text-[10px] text-[var(--moxzk-dim)]">คลิกเพื่อเปิด</span>
                  </div>
                )}
              </div>

              {/* Edit mode controls */}
              {editMode ? (
                <>
                  <div className="absolute left-5 top-5 flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/10 bg-black/60 text-yellow-100 backdrop-blur" title="ลากเพื่อเรียงหน้า">
                    <GripVertical size={11} />
                  </div>

                  {/* Move arrows */}
                  <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1">
                    <button
                      className="moxzk-icon-button h-7 w-7 border border-white/10 bg-black/65 backdrop-blur disabled:opacity-30"
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
                      className="moxzk-icon-button h-7 w-7 border border-white/10 bg-black/65 backdrop-blur disabled:opacity-30"
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
                    className="moxzk-icon-button absolute left-5 bottom-5 h-8 w-8 border border-red-300/25 bg-red-500/75 text-white backdrop-blur"
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
                  className="moxzk-icon-button absolute left-5 top-5 h-8 w-8 border border-white/10 bg-black/60 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
