import { useCallback, useRef, useState } from 'react'
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
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const applyZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(0.25, Math.min(5, newZoom))
    setZoom(clamped)
    if (clamped <= 1) setPan({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      applyZoom(zoom * delta)
    },
    [zoom, applyZoom],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [zoom])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const zoomStyle = {
    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
    transformOrigin: 'center center',
    transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar: mode tabs + zoom */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div role="tablist" className="tabs tabs-boxed tabs-sm w-fit">
          <button
            role="tab"
            className={`tab gap-1 ${mode === 'slider' ? 'tab-active' : ''}`}
            onClick={() => setMode('slider')}
          >
            <SplitSquareHorizontal size={14} /> Slider
          </button>
          <button
            role="tab"
            className={`tab gap-1 ${mode === 'side-by-side' ? 'tab-active' : ''}`}
            onClick={() => setMode('side-by-side')}
          >
            <Columns2 size={14} /> Side by Side
          </button>
          <button
            role="tab"
            className={`tab gap-1 ${mode === 'overlay' ? 'tab-active' : ''}`}
            onClick={() => setMode('overlay')}
          >
            <Layers size={14} /> Overlay
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button className="btn btn-xs btn-ghost" onClick={() => applyZoom(zoom - 0.25)} title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-xs btn-ghost" onClick={() => applyZoom(zoom + 0.25)} title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button className="btn btn-xs btn-ghost" onClick={resetView} title="Reset zoom">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Content area — scrollable, zoomable */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden rounded-xl border border-base-300 editor-canvas-area"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <div style={zoomStyle}>
            {/* Slider mode */}
            {mode === 'slider' && (
              <ReactCompareSlider
                itemOne={
                  <ReactCompareSliderImage src={originalImageUrl} alt="Original" />
                }
                itemTwo={
                  <ReactCompareSliderImage src={translatedImageUrl} alt="Translated" />
                }
                style={{ maxHeight: '100%', width: '100%' }}
              />
            )}

            {/* Side by side mode */}
            {mode === 'side-by-side' && (
              <div className="grid grid-cols-2 gap-2 p-2">
                <div className="space-y-1">
                  <span className="badge badge-sm badge-neutral">Original</span>
                  <img
                    src={originalImageUrl}
                    alt="Original"
                    className="w-full rounded-lg"
                    draggable={false}
                  />
                </div>
                <div className="space-y-1">
                  <span className="badge badge-sm badge-primary">Translated</span>
                  <img
                    src={translatedImageUrl}
                    alt="Translated"
                    className="w-full rounded-lg"
                    draggable={false}
                  />
                </div>
              </div>
            )}

            {/* Overlay mode */}
            {mode === 'overlay' && (
              <div>
                <div className="relative">
                  <img
                    src={originalImageUrl}
                    alt="Original"
                    className="w-full block"
                    draggable={false}
                  />
                  <img
                    src={translatedImageUrl}
                    alt="Translated"
                    className="absolute inset-0 w-full h-full"
                    style={{ opacity: overlayOpacity / 100 }}
                    draggable={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay opacity slider (only in overlay mode) */}
      {mode === 'overlay' && (
        <div className="flex items-center gap-3 mt-2 shrink-0">
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
      )}
    </div>
  )
}
