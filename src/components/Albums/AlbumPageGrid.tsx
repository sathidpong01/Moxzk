import { useEffect, useRef, useState } from 'react'
import type { AlbumPage } from '../../types/database'
import { FileImage, Trash2, CheckCircle2, Loader2, AlertCircle, Paintbrush, ChevronLeft, ChevronRight } from 'lucide-react'

interface AlbumPageGridProps {
  pages: AlbumPage[]
  editMode?: boolean
  onOpenPage: (page: AlbumPage) => void
  onDeletePage: (pageId: string) => void
  onReorder?: (pageIds: string[]) => void
}

const STATUS_CONFIG: Record<AlbumPage['status'], { icon: typeof FileImage; color: string; label: string }> = {
  pending: { icon: FileImage, color: 'text-base-content/30', label: 'รอดำเนินการ' },
  processing: { icon: Loader2, color: 'text-info', label: 'กำลังประมวลผล' },
  clean_done: { icon: Paintbrush, color: 'text-warning', label: 'คลีนแล้ว' },
  translated: { icon: CheckCircle2, color: 'text-success', label: 'แปลแล้ว' },
  error: { icon: AlertCircle, color: 'text-error', label: 'ผิดพลาด' },
}

function LazyThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

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

  return (
    <div ref={ref} className="aspect-3/4 flex items-center justify-center bg-base-300/30 overflow-hidden">
      {!isVisible ? (
        <div className="w-full h-full animate-pulse bg-base-300/50" />
      ) : src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <FileImage size={24} className="text-base-content/15" />
      )}
    </div>
  )
}

export default function AlbumPageGrid({ pages, editMode, onOpenPage, onDeletePage, onReorder }: AlbumPageGridProps) {
  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
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

  return (
    <>
      {editMode && (
        <div className="mb-2 px-1">
          <p className="text-xs text-warning">
            📝 โหมดแก้ไข — เลื่อนลำดับด้วย ◀ ▶ หรือลบหน้าด้วย ✕
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {pages.map((page, index) => {
          const cfg = STATUS_CONFIG[page.status]
          const Icon = cfg.icon

          return (
            <div
              key={page.id}
              className={`group relative rounded-lg overflow-hidden border transition-all bg-base-200/50 ${
                editMode
                  ? 'border-warning/40 ring-1 ring-warning/20'
                  : 'border-base-300/50 hover:border-primary/40 cursor-pointer'
              }`}
              onClick={() => {
                if (!editMode) onOpenPage(page)
              }}
            >
              {/* Thumbnail — lazy loaded */}
              <LazyThumbnail
                src={page.thumbnail_key && (page.thumbnail_key as string).startsWith('data:') ? (page.thumbnail_key as string) : null}
                alt={`หน้า ${page.page_number}`}
              />

              {/* Status badge */}
              <div className="absolute top-1 right-1">
                <div className={`badge badge-xs gap-0.5 ${cfg.color} bg-base-100/80 backdrop-blur-sm`}>
                  <Icon size={8} className={page.status === 'processing' ? 'animate-spin' : ''} />
                </div>
              </div>

              {/* Page number */}
              <div className="px-1.5 py-1 text-center">
                <span className="text-[10px] font-mono text-base-content/50">
                  #{String(page.page_number).padStart(3, '0')}
                </span>
              </div>

              {/* Edit mode controls */}
              {editMode ? (
                <>
                  {/* Move arrows */}
                  <div className="absolute bottom-7 left-0 right-0 flex justify-center gap-0.5">
                    <button
                      className="btn btn-xs btn-square btn-ghost bg-base-100/80 backdrop-blur-sm disabled:opacity-30"
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
                      className="btn btn-xs btn-square btn-ghost bg-base-100/80 backdrop-blur-sm disabled:opacity-30"
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
                    className="absolute top-1 left-1 btn btn-error btn-xs btn-square bg-error/80 backdrop-blur-sm"
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
                  className="absolute top-1 left-1 btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 bg-base-100/80 backdrop-blur-sm transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePage(page.id)
                  }}
                  title="ลบหน้านี้"
                >
                  <Trash2 size={10} className="text-error" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
