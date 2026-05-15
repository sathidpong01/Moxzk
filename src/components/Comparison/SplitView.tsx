import { useEffect, useRef, useState } from 'react'
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from 'react-compare-slider'
import { Badge } from '../ui/primitives'
import { wheelViewerZoom } from '../../services/viewerZoom'
import type { ExportPreviewMode } from '../../services/exportDrawer'
import {
  canPanExportPreview,
  createExportPreviewTransform,
  normalizeExportPreviewPan,
} from '../../services/exportPreviewViewport'

interface SplitViewProps {
  originalImageUrl: string
  translatedImageUrl: string
  mode: ExportPreviewMode
  zoom: number
  onZoomChange: (zoom: number) => void
}

export default function SplitView({
  originalImageUrl,
  translatedImageUrl,
  mode,
  zoom,
  onZoomChange,
}: SplitViewProps) {
  const [overlayOpacity, setOverlayOpacity] = useState(50)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canPan = canPanExportPreview(mode, zoom)

  useEffect(() => {
    setPan((current) => normalizeExportPreviewPan(zoom, current))
  }, [zoom])

  const onZoomChangeRef = useRef(onZoomChange)
  const zoomRef = useRef(zoom)
  useEffect(() => { onZoomChangeRef.current = onZoomChange }, [onZoomChange])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (event: WheelEvent) => {
      event.preventDefault()
      onZoomChangeRef.current(wheelViewerZoom(zoomRef.current, event.deltaY))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const zoomFrameStyle = {
    transform: createExportPreviewTransform(zoom, pan),
    transformOrigin: 'center center',
  }

  const viewportClassName = 'absolute inset-0 flex items-center justify-center'
  const imageClassName = 'h-full w-full object-contain'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        className={`studio-canvas relative min-h-0 flex-1 overflow-hidden rounded-[18px] border border-[var(--moxzk-border)] bg-black/25 ${
          canPan ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onPointerDown={(event) => {
          if (!canPan) return
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
          <div className="h-full w-full shrink-0">
            {mode === 'after' && (
              <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-black/15">
                <div className={viewportClassName} style={zoomFrameStyle}>
                  <img
                    src={translatedImageUrl}
                    alt="ภาพหลัง export"
                    className={imageClassName}
                    draggable={false}
                  />
                </div>
              </div>
            )}

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
              <div className="grid h-full w-full grid-cols-2 gap-3">
                <div className="flex min-h-0 flex-col gap-1">
                  <Badge className="justify-center px-3 py-1.5">ต้นฉบับ</Badge>
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-black/20">
                    <div className={viewportClassName} style={zoomFrameStyle}>
                      <img
                        src={originalImageUrl}
                        alt="ต้นฉบับ"
                        className={imageClassName}
                        draggable={false}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex min-h-0 flex-col gap-1">
                  <Badge className="justify-center px-3 py-1.5">ฉบับแปล</Badge>
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-black/20">
                    <div className={viewportClassName} style={zoomFrameStyle}>
                      <img
                        src={translatedImageUrl}
                        alt="ฉบับแปล"
                        className={imageClassName}
                        draggable={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mode === 'overlay' && (
              <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-black/15">
                <div className={viewportClassName} style={zoomFrameStyle}>
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
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'overlay' && (
        <div className="mt-3 flex shrink-0 items-center gap-3 rounded-[14px] border border-[var(--moxzk-border)] bg-white/[0.03] px-3 py-2">
          <span className="text-xs text-[var(--moxzk-muted)]">ต้นฉบับ</span>
          <input
            type="range"
            className="moxzk-slider flex-1"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
          />
          <span className="text-xs text-[var(--moxzk-muted)]">ฉบับแปล</span>
        </div>
      )}
    </div>
  )
}
