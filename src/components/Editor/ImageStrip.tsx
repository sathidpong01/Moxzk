import { useAppStore } from '../../store/appStore'
import { CheckCircle2, Loader2, CloudOff } from 'lucide-react'

interface ImageStripProps {
  isOpen?: boolean
  onToggle?: () => void
}

export default function ImageStrip({ isOpen = true, onToggle }: ImageStripProps) {
  const imageEntries = useAppStore((s) => s.imageEntries)
  const activeImageId = useAppStore((s) => s.activeImageId)
  const switchImage = useAppStore((s) => s.switchImage)

  if (imageEntries.length <= 1) return null

  return (
    <div className="fixed left-2 top-1/2 z-30 flex -translate-y-1/2 items-center">
      <div
        className={`floating-panel-sm panel-enter flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto overflow-x-hidden transition-all duration-200 ease-out ${
          isOpen
            ? 'w-[68px] translate-x-0 border-opacity-100 p-1.5 opacity-100'
            : 'w-0 -translate-x-2 border-opacity-0 p-0 opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
        {imageEntries.map((entry, i) => {
          const isActive = entry.id === activeImageId
          const isDone = entry.status === 'done'
          const isProcessing = ['processing', 'clean_queued', 'cleaning', 'translate_queued', 'translating'].includes(entry.status)
          const isUnloaded = entry.imageLoaded === false
          const pageNumber = entry.pageNumber ?? i + 1

          return (
            <button
              key={entry.id}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                isActive
                  ? 'border-[var(--mg-accent)] ring-2 ring-blue-400/30'
                  : isUnloaded
                    ? 'border-white/10 opacity-70 hover:border-white/30'
                    : 'border-white/10 hover:border-white/30'
              }`}
              onClick={() => {
                if (!isActive) switchImage(entry.id)
              }}
              title={`หน้า ${pageNumber}${isUnloaded ? ' (คลิกเพื่อโหลด)' : ''}`}
            >
              {entry.originalUrl ? (
                <img
                  src={entry.originalUrl}
                  alt={`หน้า ${pageNumber}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5">
                  <CloudOff size={12} className="text-[var(--mg-dim)]" />
                </div>
              )}
              <span className="absolute bottom-0 left-0 rounded-tr bg-black/75 px-1 text-[9px] font-bold text-[var(--mg-text)]">
                {pageNumber}
              </span>
              {isDone && (
                <div className="absolute top-0.5 right-0.5">
                  <CheckCircle2 size={10} className="text-[var(--mg-success)] drop-shadow" />
                </div>
              )}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 size={12} className="animate-spin text-[var(--mg-accent)]" />
                </div>
              )}
              {isUnloaded && !isProcessing && (
                <div className="absolute bottom-0 right-0">
                  <div className="rounded-tl bg-black/80 px-0.5 text-[7px]">cloud</div>
                </div>
              )}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="ml-1 flex h-10 w-5 items-center justify-center rounded-[6px] border border-[var(--mg-border)] bg-black/65 text-[var(--mg-text)] backdrop-blur transition hover:border-white/30 hover:bg-white/10"
        onClick={onToggle}
        aria-label={isOpen ? 'ซ่อนแถบหน้า' : 'แสดงแถบหน้า'}
        title={isOpen ? 'ซ่อนแถบหน้า' : 'แสดงแถบหน้า'}
      >
        <span
          className="block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-[var(--mg-text)] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
    </div>
  )
}
