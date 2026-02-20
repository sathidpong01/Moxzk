import { useAppStore } from '../../store/appStore'
import { CheckCircle2, Loader2, CloudOff } from 'lucide-react'

export default function ImageStrip() {
  const imageEntries = useAppStore((s) => s.imageEntries)
  const activeImageId = useAppStore((s) => s.activeImageId)
  const switchImage = useAppStore((s) => s.switchImage)

  if (imageEntries.length <= 1) return null

  return (
    <div className="fixed left-2 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 p-1.5 floating-panel-sm panel-enter max-h-[60vh] overflow-y-auto">
      {imageEntries.map((entry, i) => {
        const isActive = entry.id === activeImageId
        const isDone = entry.status === 'done'
        const isProcessing = entry.status === 'processing'
        const isUnloaded = entry.imageLoaded === false

        return (
          <button
            key={entry.id}
            className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
              isActive
                ? 'border-primary ring-2 ring-primary/30'
                : isUnloaded
                  ? 'border-base-content/10 hover:border-base-content/30 opacity-70'
                  : 'border-base-content/10 hover:border-base-content/30'
            }`}
            onClick={() => {
              if (!isActive) switchImage(entry.id)
            }}
            title={`Image ${i + 1}${isUnloaded ? ' (click to load)' : ''}`}
          >
            {entry.originalUrl ? (
              <img
                src={entry.originalUrl}
                alt={`${i + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-base-300/50 flex items-center justify-center">
                <CloudOff size={12} className="text-base-content/20" />
              </div>
            )}
            {/* Index badge */}
            <span className="absolute bottom-0 left-0 text-[9px] font-bold bg-base-300/80 text-base-content px-1 rounded-tr">
              {i + 1}
            </span>
            {/* Status indicator */}
            {isDone && (
              <div className="absolute top-0.5 right-0.5">
                <CheckCircle2 size={10} className="text-success drop-shadow" />
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-base-100/50 flex items-center justify-center">
                <Loader2 size={12} className="text-primary animate-spin" />
              </div>
            )}
            {/* Unloaded indicator (album lazy load) */}
            {isUnloaded && !isProcessing && (
              <div className="absolute bottom-0 right-0">
                <div className="badge badge-xs bg-base-100/80 text-[7px] px-0.5 rounded-tl">☁️</div>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
