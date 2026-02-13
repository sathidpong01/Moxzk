import { useCallback, useRef, useState } from 'react'

interface SplitViewProps {
  originalImageUrl: string
  translatedImageUrl: string
}

type ViewMode = 'slider' | 'side-by-side' | 'overlay'

export default function SplitView({
  originalImageUrl,
  translatedImageUrl,
}: SplitViewProps) {
  const [mode, setMode] = useState<ViewMode>('slider')
  const [sliderPos, setSliderPos] = useState(50)
  const [overlayOpacity, setOverlayOpacity] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      setSliderPos(Math.max(0, Math.min(100, x)))
    },
    [],
  )

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div role="tablist" className="tabs tabs-boxed tabs-sm w-fit">
        <button
          role="tab"
          className={`tab ${mode === 'slider' ? 'tab-active' : ''}`}
          onClick={() => setMode('slider')}
        >
          ↔️ Slider
        </button>
        <button
          role="tab"
          className={`tab ${mode === 'side-by-side' ? 'tab-active' : ''}`}
          onClick={() => setMode('side-by-side')}
        >
          ◻️ Side by Side
        </button>
        <button
          role="tab"
          className={`tab ${mode === 'overlay' ? 'tab-active' : ''}`}
          onClick={() => setMode('overlay')}
        >
          🔲 Overlay
        </button>
      </div>

      {/* Slider mode */}
      {mode === 'slider' && (
        <div>
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-xl border border-base-300 select-none cursor-col-resize"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Translated (full width behind) */}
            <img
              src={translatedImageUrl}
              alt="Translated"
              className="w-full block"
              draggable={false}
            />

            {/* Original (clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={originalImageUrl}
                alt="Original"
                className="w-full block"
                style={{ width: containerRef.current?.offsetWidth ?? '100%' }}
                draggable={false}
              />
            </div>

            {/* Divider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-content text-xs font-bold shadow-lg">
                ↔
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-2 left-2 badge badge-sm badge-neutral/80">
              Original
            </div>
            <div className="absolute top-2 right-2 badge badge-sm badge-primary/80">
              Translated
            </div>
          </div>

          <input
            type="range"
            className="range range-primary range-xs mt-2"
            min={0}
            max={100}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
          />
        </div>
      )}

      {/* Side by side mode */}
      {mode === 'side-by-side' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="badge badge-sm badge-neutral">Original</span>
            <img
              src={originalImageUrl}
              alt="Original"
              className="w-full rounded-xl border border-base-300"
            />
          </div>
          <div className="space-y-1">
            <span className="badge badge-sm badge-primary">Translated</span>
            <img
              src={translatedImageUrl}
              alt="Translated"
              className="w-full rounded-xl border border-base-300"
            />
          </div>
        </div>
      )}

      {/* Overlay mode */}
      {mode === 'overlay' && (
        <div>
          <div className="relative rounded-xl border border-base-300 overflow-hidden">
            <img
              src={originalImageUrl}
              alt="Original"
              className="w-full block"
            />
            <img
              src={translatedImageUrl}
              alt="Translated"
              className="absolute inset-0 w-full h-full"
              style={{ opacity: overlayOpacity / 100 }}
            />
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-base-content/50">Original</span>
            <input
              type="range"
              className="range range-primary range-xs flex-1"
              min={0}
              max={100}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            />
            <span className="text-xs text-base-content/50">Translated</span>
          </div>
        </div>
      )}
    </div>
  )
}
