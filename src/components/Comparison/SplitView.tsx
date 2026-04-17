import { useCallback, useState } from 'react'
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from 'react-compare-slider'
import {
  SplitSquareHorizontal,
  Columns2,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react'
import { Badge, Button } from '../ui/primitives'
import { clampViewerZoom, stepViewerZoom, wheelViewerZoom } from '../../services/viewerZoom'

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
  const [overlayOpacity, setOverlayOpacity] = useState(50)
  const [zoom, setZoom] = useState(1)

  const applyZoom = useCallback((newZoom: number) => {
    setZoom(clampViewerZoom(newZoom))
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom((current) => wheelViewerZoom(current, event.deltaY))
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
  }, [])

  const zoomPercent = Math.round(zoom * 100)
  const zoomFrameStyle = {
    width: `${zoomPercent}%`,
    height: `${zoomPercent}%`,
    minWidth: `${zoomPercent}%`,
    minHeight: `${zoomPercent}%`,
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div role="tablist" className="inline-flex w-fit rounded-[8px] border border-[var(--mg-border)] bg-white/5 p-1">
          <button
            role="tab"
            className={`mg-button mg-button-sm ${mode === 'slider' ? 'mg-button-soft' : 'mg-button-ghost'}`}
            onClick={() => setMode('slider')}
          >
            <SplitSquareHorizontal size={14} /> Slider
          </button>
          <button
            role="tab"
            className={`mg-button mg-button-sm ${mode === 'side-by-side' ? 'mg-button-soft' : 'mg-button-ghost'}`}
            onClick={() => setMode('side-by-side')}
          >
            <Columns2 size={14} /> Side by Side
          </button>
          <button
            role="tab"
            className={`mg-button mg-button-sm ${mode === 'overlay' ? 'mg-button-soft' : 'mg-button-ghost'}`}
            onClick={() => setMode('overlay')}
          >
            <Layers size={14} /> Overlay
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => applyZoom(stepViewerZoom(zoom, 'out'))} title="Zoom out">
            <ZoomOut size={14} />
          </Button>
          <span className="w-10 text-center font-mono text-xs">{zoomPercent}%</span>
          <Button variant="ghost" size="sm" onClick={() => applyZoom(stepViewerZoom(zoom, 'in'))} title="Zoom in">
            <ZoomIn size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} title="Fit view">
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>

      <div
        className="studio-canvas min-h-0 flex-1 overflow-auto rounded-[8px] border border-[var(--mg-border)]"
        onWheel={handleWheel}
      >
        <div className={zoom > 1 ? 'min-h-full min-w-full' : 'flex h-full w-full items-center justify-center'}>
          <div className="shrink-0" style={zoomFrameStyle}>
            {mode === 'slider' && (
              <ReactCompareSlider
                itemOne={
                  <ReactCompareSliderImage
                    src={originalImageUrl}
                    alt="Original"
                    style={{ objectFit: 'contain', objectPosition: 'center center' }}
                  />
                }
                itemTwo={
                  <ReactCompareSliderImage
                    src={translatedImageUrl}
                    alt="Translated"
                    style={{ objectFit: 'contain', objectPosition: 'center center' }}
                  />
                }
                style={{ height: '100%', width: '100%' }}
              />
            )}

            {mode === 'side-by-side' && (
              <div className="grid h-full w-full grid-cols-2 gap-2 p-2">
                <div className="flex min-h-0 flex-col gap-1">
                  <Badge>Original</Badge>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-[8px] bg-black/25">
                    <img
                      src={originalImageUrl}
                      alt="Original"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                </div>
                <div className="flex min-h-0 flex-col gap-1">
                  <Badge>Translated</Badge>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-[8px] bg-black/25">
                    <img
                      src={translatedImageUrl}
                      alt="Translated"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'overlay' && (
              <div className="relative h-full w-full">
                <img
                  src={originalImageUrl}
                  alt="Original"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
                <img
                  src={translatedImageUrl}
                  alt="Translated"
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{ opacity: overlayOpacity / 100 }}
                  draggable={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'overlay' && (
        <div className="mt-2 flex shrink-0 items-center gap-3">
          <span className="text-xs text-[var(--mg-muted)]">Original</span>
          <input
            type="range"
            className="mg-slider flex-1"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
          />
          <span className="text-xs text-[var(--mg-muted)]">Translated</span>
        </div>
      )}
    </div>
  )
}
