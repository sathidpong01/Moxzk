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
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const applyZoom = useCallback((newZoom: number) => {
    const nextZoom = clampViewerZoom(newZoom)
    setZoom(nextZoom)
    if (nextZoom <= 1) setPan({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom((current) => wheelViewerZoom(current, event.deltaY))
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const zoomPercent = Math.round(zoom * 100)
  const zoomFrameStyle = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
    transformOrigin: 'center center',
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
            <SplitSquareHorizontal size={14} /> สไลด์เทียบ
          </button>
          <button
            role="tab"
            className={`mg-button mg-button-sm ${mode === 'side-by-side' ? 'mg-button-soft' : 'mg-button-ghost'}`}
            onClick={() => setMode('side-by-side')}
          >
            <Columns2 size={14} /> วางคู่
          </button>
          <button
            role="tab"
            className={`mg-button mg-button-sm ${mode === 'overlay' ? 'mg-button-soft' : 'mg-button-ghost'}`}
            onClick={() => setMode('overlay')}
          >
            <Layers size={14} /> ซ้อนภาพ
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => applyZoom(stepViewerZoom(zoom, 'out'))} title="ซูมออก">
            <ZoomOut size={14} />
          </Button>
          <span className="w-10 text-center font-mono text-xs">{zoomPercent}%</span>
          <Button variant="ghost" size="sm" onClick={() => applyZoom(stepViewerZoom(zoom, 'in'))} title="ซูมเข้า">
            <ZoomIn size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} title="พอดีหน้าจอ">
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>

      <div
        className={`studio-canvas relative min-h-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--mg-border)] ${
          zoom > 1 && mode !== 'slider' ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onWheel={handleWheel}
        onPointerDown={(event) => {
          if (zoom <= 1 || mode === 'slider') return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y })
        }}
        onPointerMove={(event) => {
          if (!dragStart) return
          setPan({
            x: dragStart.panX + event.clientX - dragStart.x,
            y: dragStart.panY + event.clientY - dragStart.y,
          })
        }}
        onPointerUp={(event) => {
          if (dragStart) event.currentTarget.releasePointerCapture(event.pointerId)
          setDragStart(null)
        }}
        onPointerCancel={() => setDragStart(null)}
      >
        <div className="absolute inset-4 flex items-center justify-center">
          <div className="h-full w-full shrink-0 transition-transform duration-100 ease-out" style={zoomFrameStyle}>
            {mode === 'slider' && (
              <ReactCompareSlider
                itemOne={
                  <ReactCompareSliderImage
                    src={originalImageUrl}
                    alt="ต้นฉบับ"
                    style={{ objectFit: 'contain', objectPosition: 'center center' }}
                  />
                }
                itemTwo={
                  <ReactCompareSliderImage
                    src={translatedImageUrl}
                    alt="ฉบับแปล"
                    style={{ objectFit: 'contain', objectPosition: 'center center' }}
                  />
                }
                style={{ height: '100%', width: '100%' }}
              />
            )}

            {mode === 'side-by-side' && (
              <div className="grid h-full w-full grid-cols-2 gap-2 p-2">
                <div className="flex min-h-0 flex-col gap-1">
                  <Badge>ต้นฉบับ</Badge>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-[8px] bg-black/25">
                    <img
                      src={originalImageUrl}
                      alt="ต้นฉบับ"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                </div>
                <div className="flex min-h-0 flex-col gap-1">
                  <Badge>ฉบับแปล</Badge>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-[8px] bg-black/25">
                    <img
                      src={translatedImageUrl}
                      alt="ฉบับแปล"
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
                  alt="ต้นฉบับ"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
                <img
                  src={translatedImageUrl}
                  alt="ฉบับแปล"
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
          <span className="text-xs text-[var(--mg-muted)]">ต้นฉบับ</span>
          <input
            type="range"
            className="mg-slider flex-1"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
          />
          <span className="text-xs text-[var(--mg-muted)]">ฉบับแปล</span>
        </div>
      )}
    </div>
  )
}
