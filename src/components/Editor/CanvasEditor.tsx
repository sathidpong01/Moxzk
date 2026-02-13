import { useCallback, useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import type { TextRegion } from '../../types'
import { resolveFont } from '../../config/fonts'

interface CanvasEditorProps {
  cleanedImageUrl: string
  regions: TextRegion[]
  onRegionUpdate: (id: string, updates: Partial<TextRegion>) => void
  onSelectedRegion: (id: string | null) => void
}

type FabricObj = fabric.FabricObject & { data?: Record<string, unknown> }

export default function CanvasEditor({
  cleanedImageUrl,
  regions,
  onRegionUpdate,
  onSelectedRegion,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [imgScale, setImgScale] = useState(1)
  const scaleRef = useRef(1)
  const [zoom, setZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('100')
  const [isPanning, setIsPanning] = useState(false)
  const isPanningRef = useRef(false)
  const panState = useRef({ active: false, lastX: 0, lastY: 0 })

  // Sync panning ref for use in event handlers
  useEffect(() => {
    isPanningRef.current = isPanning
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.defaultCursor = isPanning ? 'grab' : 'default'
    canvas.selection = !isPanning
  }, [isPanning])

  // Initialize fabric canvas once
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1a1a2e',
      selection: true,
    })
    fabricRef.current = canvas

    canvas.on('selection:created', (e) => {
      const target = e.selected?.[0] as FabricObj | undefined
      if (target?.data?.regionId) {
        onSelectedRegion(target.data.regionId as string)
      }
    })

    canvas.on('selection:updated', (e) => {
      const target = e.selected?.[0] as FabricObj | undefined
      if (target?.data?.regionId) {
        onSelectedRegion(target.data.regionId as string)
      }
    })

    canvas.on('selection:cleared', () => {
      onSelectedRegion(null)
    })

    canvas.on('object:modified', (e) => {
      const target = e.target as FabricObj | undefined
      if (!target?.data?.regionId) return
      const s = scaleRef.current
      const regionId = target.data.regionId as string
      onRegionUpdate(regionId, {
        bbox: {
          x: (target.left ?? 0) / s,
          y: (target.top ?? 0) / s,
          width: ((target.width ?? 100) * (target.scaleX ?? 1)) / s,
          height: ((target.height ?? 30) * (target.scaleY ?? 1)) / s,
        },
        rotation: target.angle ?? 0,
      })
    })

    // Scroll wheel zoom
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent
      const delta = e.deltaY
      let newZoom = canvas.getZoom() * (delta > 0 ? 0.9 : 1.1)
      newZoom = Math.max(0.1, Math.min(5, newZoom))
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), newZoom)
      setZoom(newZoom)
      setZoomInput(Math.round(newZoom * 100).toString())
      e.preventDefault()
      e.stopPropagation()
    })

    // Pan: Alt+drag, middle-click drag, or pan mode
    canvas.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent
      if (isPanningRef.current || e.altKey || e.button === 1) {
        panState.current = { active: true, lastX: e.clientX, lastY: e.clientY }
        canvas.defaultCursor = 'grabbing'
        canvas.selection = false
      }
    })
    canvas.on('mouse:move', (opt) => {
      if (!panState.current.active) return
      const e = opt.e as MouseEvent
      const vpt = canvas.viewportTransform!
      vpt[4] += e.clientX - panState.current.lastX
      vpt[5] += e.clientY - panState.current.lastY
      panState.current.lastX = e.clientX
      panState.current.lastY = e.clientY
      canvas.requestRenderAll()
    })
    canvas.on('mouse:up', () => {
      panState.current.active = false
      if (fabricRef.current) {
        fabricRef.current.defaultCursor = isPanningRef.current ? 'grab' : 'default'
        if (!isPanningRef.current) fabricRef.current.selection = true
      }
    })

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load background image
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !cleanedImageUrl) return

    let cancelled = false

    fabric.FabricImage.fromURL(cleanedImageUrl).then((img) => {
      if (cancelled || !fabricRef.current) return

      const containerW = containerRef.current?.clientWidth ?? 800
      const containerH = containerRef.current?.clientHeight ?? 600
      const scale = Math.min(
        containerW / (img.width ?? 800),
        containerH / (img.height ?? 600),
        1,
      )
      scaleRef.current = scale
      setImgScale(scale)

      canvas.setDimensions({
        width: (img.width ?? 800) * scale,
        height: (img.height ?? 600) * scale,
      })

      img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false })
      canvas.backgroundImage = img
      canvas.renderAll()
    })

    return () => { cancelled = true }
  }, [cleanedImageUrl])

  // Render text regions on canvas (re-runs when scale changes after image loads)
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const s = imgScale
    const existingTexts = canvas.getObjects().filter((o) => (o as FabricObj).data?.regionId)
    existingTexts.forEach((o) => canvas.remove(o))

    regions.forEach((region) => {
      const font = resolveFont(region.suggestedFont, region.mood)

      const textbox = new fabric.Textbox(region.translatedText || ' ', {
        left: region.bbox.x * s,
        top: region.bbox.y * s,
        width: Math.max(20, region.bbox.width * s),
        fontSize: Math.max(10, region.fontSize * s),
        fontFamily: font.family,
        fontWeight: font.weight,
        fontStyle: font.style,
        fill: region.fontColor,
        textAlign: 'center',
        editable: true,
        cornerColor: '#6366f1',
        cornerStyle: 'circle',
        transparentCorners: false,
        borderColor: '#6366f1',
        data: { regionId: region.id },
      })

      canvas.add(textbox)
    })

    // Re-render after custom fonts are loaded
    document.fonts.ready.then(() => {
      canvas.requestRenderAll()
    })
  }, [regions, imgScale])

  // Zoom helpers
  const applyZoom = useCallback((newZoom: number) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const clamped = Math.max(0.1, Math.min(5, newZoom))
    setZoom(clamped)
    setZoomInput(Math.round(clamped * 100).toString())
    canvas.setZoom(clamped)
    canvas.renderAll()
  }, [])

  const handleZoomInputCommit = useCallback(() => {
    const val = parseInt(zoomInput, 10)
    if (!isNaN(val) && val >= 10 && val <= 500) {
      applyZoom(val / 100)
    } else {
      setZoomInput(Math.round(zoom * 100).toString())
    }
  }, [zoomInput, zoom, applyZoom])

  const handleResetView = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    applyZoom(1)
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    canvas.renderAll()
  }, [applyZoom])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
        <div className="join border border-base-300 rounded-lg">
          <button
            className="join-item btn btn-xs btn-ghost px-2"
            onClick={() => applyZoom(zoom - 0.1)}
            title="Zoom out"
          >
            −
          </button>
          <div className="join-item flex items-center bg-base-100">
            <input
              className="w-10 text-center text-xs bg-transparent outline-none font-mono"
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomInputCommit}
              onKeyDown={(e) => e.key === 'Enter' && handleZoomInputCommit()}
            />
            <span className="text-xs text-base-content/40 pr-1">%</span>
          </div>
          <button
            className="join-item btn btn-xs btn-ghost px-2"
            onClick={() => applyZoom(zoom + 0.1)}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <button
          className={`btn btn-xs ${isPanning ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setIsPanning(!isPanning)}
          title="Pan mode (or hold Alt / middle-click to pan)"
        >
          🖐
        </button>

        <button
          className="btn btn-xs btn-ghost"
          onClick={handleResetView}
          title="Reset view"
        >
          ↺
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="editor-canvas-area rounded-xl overflow-hidden border border-base-300 flex-1 min-h-0"
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
