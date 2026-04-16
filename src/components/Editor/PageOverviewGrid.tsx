import type { ImageEntry } from '../../types'
import { AlertCircle, CheckCircle2, CloudOff, Loader2 } from 'lucide-react'

interface PageOverviewGridProps {
  entries: ImageEntry[]
  activeImageId: string | null
  onOpenPage: (id: string) => void
}

const statusMeta = {
  pending: { label: 'รอทำงาน', className: 'text-[var(--mg-muted)]', icon: null },
  clean_queued: { label: 'รอคลีน', className: 'text-[var(--mg-muted)]', icon: null },
  cleaning: { label: 'กำลังคลีน', className: 'text-[var(--mg-accent)]', icon: Loader2 },
  clean_done: { label: 'คลีนแล้ว', className: 'text-[var(--mg-success)]', icon: CheckCircle2 },
  translate_queued: { label: 'รอแปล', className: 'text-[var(--mg-muted)]', icon: null },
  translating: { label: 'กำลังแปล', className: 'text-[var(--mg-accent)]', icon: Loader2 },
  processing: { label: 'กำลังประมวลผล', className: 'text-[var(--mg-accent)]', icon: Loader2 },
  done: { label: 'เสร็จแล้ว', className: 'text-[var(--mg-success)]', icon: CheckCircle2 },
  error: { label: 'ผิดพลาด', className: 'text-[var(--mg-danger)]', icon: AlertCircle },
} as const

export default function PageOverviewGrid({
  entries,
  activeImageId,
  onOpenPage,
}: PageOverviewGridProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--mg-bg)]">
        <p className="text-sm text-[var(--mg-muted)]">ไม่มีรูปภาพ</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[var(--mg-bg)] px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {entries.map((entry, index) => {
          const isActive = entry.id === activeImageId
          const meta = statusMeta[entry.status]
          const StatusIcon = meta.icon
          const previewUrl = entry.cleanedImageUrl || entry.originalUrl
          const pageNumber = entry.pageNumber ?? index + 1

          return (
            <button
              key={entry.id}
              type="button"
              className={`group overflow-hidden rounded-[8px] border bg-[var(--mg-surface)] text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--mg-accent)] ${
                isActive
                  ? 'border-[var(--mg-accent)] shadow-[0_0_0_1px_var(--mg-accent)]'
                  : 'border-[var(--mg-border)] hover:border-white/30'
              }`}
              onClick={() => onOpenPage(entry.id)}
              aria-label={`เปิดหน้า ${pageNumber} เพื่อแก้ไข`}
            >
              <div className="flex h-9 items-center justify-between gap-2 border-b border-[var(--mg-border)] bg-black/25 px-3">
                <span className="text-xs font-bold text-[var(--mg-text)]">หน้า {pageNumber}</span>
                <span className={`flex min-w-0 items-center gap-1 text-[11px] ${meta.className}`}>
                  {StatusIcon && (
                    <StatusIcon
                      size={12}
                      className={entry.status === 'processing' ? 'animate-spin' : ''}
                    />
                  )}
                  <span className="truncate">{meta.label}</span>
                </span>
              </div>

              <div className="relative aspect-[3/4] bg-[#101010]">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`หน้า ${pageNumber}`}
                    className="h-full w-full object-contain p-2 transition duration-150 group-hover:scale-[1.01]"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--mg-muted)]">
                    <CloudOff size={18} />
                    <span className="text-xs">ยังไม่ได้โหลดรูป</span>
                  </div>
                )}

                {isActive && (
                  <span className="absolute left-2 top-2 rounded-[6px] bg-[var(--mg-accent)] px-2 py-1 text-[10px] font-bold text-white">
                    กำลังแก้ไข
                  </span>
                )}
                {entry.error && (
                  <span className="absolute bottom-2 left-2 right-2 truncate rounded-[6px] bg-red-950/85 px-2 py-1 text-[10px] text-red-100">
                    {entry.error}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
