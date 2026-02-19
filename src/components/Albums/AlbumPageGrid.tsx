import { useEffect, useRef, useState } from 'react'
import type { AlbumPage } from '../../types/database'
import { FileImage, Trash2, CheckCircle2, Loader2, AlertCircle, Paintbrush } from 'lucide-react'

interface AlbumPageGridProps {
  pages: AlbumPage[]
  onOpenPage: (page: AlbumPage) => void
  onDeletePage: (pageId: string) => void
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

export default function AlbumPageGrid({ pages, onOpenPage, onDeletePage }: AlbumPageGridProps) {
  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
        <FileImage size={40} className="mb-3" />
        <p className="text-sm">ยังไม่มีหน้าในอัลบั้มนี้</p>
        <p className="text-xs mt-1">อัปโหลดรูปแล้วบันทึกเข้าอัลบั้มจาก Editor</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {pages.map((page) => {
        const cfg = STATUS_CONFIG[page.status]
        const Icon = cfg.icon

        return (
          <div
            key={page.id}
            className="group relative rounded-lg overflow-hidden border border-base-300/50 hover:border-primary/40 transition-all cursor-pointer bg-base-200/50"
            onClick={() => onOpenPage(page)}
          >
            {/* Thumbnail — lazy loaded via IntersectionObserver */}
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

            {/* Delete on hover */}
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
          </div>
        )
      })}
    </div>
  )
}
