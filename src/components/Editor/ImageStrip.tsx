import { useCallback, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { AlertCircle, CheckCircle2, Loader2, CloudOff } from 'lucide-react'

interface ImageStripProps {
  isOpen?: boolean
  showToggle?: boolean
  onToggle?: () => void
}

interface ThumbnailMetric {
  width: number
  height: number
}

const THUMBNAIL_WIDTH = 120
const THUMBNAIL_MIN_HEIGHT = 88
const THUMBNAIL_MAX_HEIGHT = 196
const STRIP_WIDTH = 146
const STRIP_MASK_FADE_TOP = 26
const STRIP_MASK_FADE_BOTTOM = 34

const statusMeta = {
  pending: { label: '', className: '', icon: null },
  clean_queued: { label: 'รอคลีน', className: 'bg-black/78 text-zinc-200', icon: null },
  cleaning: { label: 'คลีน', className: 'bg-blue-500/85 text-white', icon: Loader2 },
  clean_done: { label: 'คลีนแล้ว', className: 'bg-emerald-500/85 text-white', icon: CheckCircle2 },
  translate_queued: { label: 'รอแปล', className: 'bg-black/78 text-zinc-200', icon: null },
  translating: { label: 'แปล', className: 'bg-blue-500/85 text-white', icon: Loader2 },
  processing: { label: 'ทำงาน', className: 'bg-blue-500/85 text-white', icon: Loader2 },
  done: { label: 'เสร็จ', className: 'bg-emerald-500/85 text-white', icon: CheckCircle2 },
  error: { label: 'พลาด', className: 'bg-red-500/88 text-white', icon: AlertCircle },
} as const

function getThumbnailHeight(metric?: ThumbnailMetric): number {
  if (!metric || metric.width <= 0 || metric.height <= 0) return 168
  const naturalHeight = THUMBNAIL_WIDTH * (metric.height / metric.width)
  return Math.max(THUMBNAIL_MIN_HEIGHT, Math.min(THUMBNAIL_MAX_HEIGHT, Math.round(naturalHeight)))
}

function getStripMaskStyle(): CSSProperties {
  const maskImage = `linear-gradient(to bottom, transparent 0px, black ${STRIP_MASK_FADE_TOP}px, black calc(100% - ${STRIP_MASK_FADE_BOTTOM}px), transparent 100%)`
  return {
    maxHeight: 'calc(74vh - 5.5rem)',
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  }
}

export default function ImageStrip({ isOpen = true, showToggle = true, onToggle }: ImageStripProps) {
  const imageEntries = useAppStore((s) => s.imageEntries)
  const activeImageId = useAppStore((s) => s.activeImageId)
  const switchImage = useAppStore((s) => s.switchImage)
  const [thumbnailMetrics, setThumbnailMetrics] = useState<Record<string, ThumbnailMetric>>({})

  const handleImageLoad = useCallback((entryId: string, event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) return
    setThumbnailMetrics((current) => {
      const previous = current[entryId]
      if (previous?.width === naturalWidth && previous.height === naturalHeight) return current
      return {
        ...current,
        [entryId]: {
          width: naturalWidth,
          height: naturalHeight,
        },
      }
    })
  }, [])

  if (imageEntries.length <= 1) return null
  if (!showToggle && !isOpen) return null

  return (
    <div className="fixed left-3 top-1/2 z-30 flex -translate-y-1/2 items-center">
      <div
        className={`floating-panel-sm panel-enter relative flex max-h-[74vh] flex-col items-center overflow-hidden transition-all duration-200 ease-out ${
          isOpen
            ? 'translate-x-0 border-opacity-100 px-3 py-6 opacity-100'
            : 'w-0 -translate-x-2 border-opacity-0 p-0 opacity-0'
        }`}
        style={isOpen ? { width: STRIP_WIDTH } : undefined}
        aria-hidden={!isOpen}
      >
        <div
          className="mg-scrollbar-hidden flex w-full flex-col items-center gap-3 overflow-y-auto overflow-x-hidden"
          style={getStripMaskStyle()}
        >
          {imageEntries.map((entry, i) => {
            const isActive = entry.id === activeImageId
            const meta = statusMeta[entry.status]
            const StatusIcon = meta.icon
            const isProcessing = ['processing', 'cleaning', 'translating'].includes(entry.status)
            const isUnloaded = entry.imageLoaded === false
            const pageNumber = entry.pageNumber ?? i + 1
            const thumbnailHeight = getThumbnailHeight(thumbnailMetrics[entry.id])
            const previewUrl = entry.cleanedImageUrl || entry.originalUrl

            return (
              <button
                key={entry.id}
                className={`relative shrink-0 overflow-hidden rounded-[12px] border-2 bg-white/[0.03] transition ${
                  isActive
                    ? 'border-[var(--mg-accent)] ring-2 ring-blue-400/30'
                    : isUnloaded
                      ? 'border-white/10 opacity-70 hover:border-white/30'
                      : 'border-white/10 hover:border-white/30'
                }`}
                style={{ width: THUMBNAIL_WIDTH, height: thumbnailHeight }}
                onClick={() => {
                  if (!isActive) switchImage(entry.id)
                }}
                title={`หน้า ${pageNumber}${isUnloaded ? ' (คลิกเพื่อโหลด)' : ''}`}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`หน้า ${pageNumber}`}
                    onLoad={(event) => handleImageLoad(entry.id, event)}
                    className={`h-full w-full object-contain transition ${isProcessing ? 'brightness-75' : ''}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/5">
                    <CloudOff size={18} className="text-[var(--mg-dim)]" />
                  </div>
                )}
                <span className="absolute bottom-0 left-0 rounded-tr bg-black/75 px-2 py-1 text-[11px] font-bold text-[var(--mg-text)]">
                  {pageNumber}
                </span>
                {meta.label && (
                  <span className={`absolute right-1 top-1 inline-flex max-w-[76px] items-center gap-1 rounded-[7px] px-1.5 py-1 text-[9px] font-bold shadow ${meta.className}`}>
                    {StatusIcon && (
                      <StatusIcon
                        size={10}
                        className={isProcessing ? 'animate-spin' : ''}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{meta.label}</span>
                  </span>
                )}
                {isUnloaded && !isProcessing && (
                  <div className="absolute bottom-0 right-0">
                    <div className="rounded-tl bg-black/80 px-1.5 py-1 text-[9px]">c</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {showToggle && (
        <button
          type="button"
          className="ml-1.5 flex h-12 w-6 items-center justify-center rounded-[8px] border border-[var(--mg-border)] bg-black/65 text-[var(--mg-text)] backdrop-blur transition hover:border-white/30 hover:bg-white/10"
          onClick={onToggle}
          aria-label={isOpen ? 'ซ่อนแถบหน้า' : 'แสดงแถบหน้า'}
          title={isOpen ? 'ซ่อนแถบหน้า' : 'แสดงแถบหน้า'}
        >
          <span
            className="block h-0 w-0 border-y-[7px] border-l-[10px] border-y-transparent border-l-[var(--mg-text)] transition-transform duration-200 ease-out"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      )}
    </div>
  )
}
