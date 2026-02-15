import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Line } from 'react-konva'
import Konva from 'konva'
import type { TextRegion, BrushStroke } from '../../types'
import { resolveFont } from '../../config/fonts'
import { useAppStore } from '../../store/appStore'
import { Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'

export interface CanvasEditorHandle {
  deselectAll: () => void
}

interface CanvasEditorProps {
  imageUrl: string
  regions: TextRegion[]
  onRegionUpdate: (id: string, updates: Partial<TextRegion>) => void
  onRegionDelete: (id: string) => void
  onSelectedRegion: (id: string | null) => void
  stageRef?: React.RefObject<Konva.Stage | null>
  onScaleChange?: (scale: number) => void
  editorRef?: React.RefObject<CanvasEditorHandle | null>
}

export default function CanvasEditor({
  imageUrl,
  regions,
  onRegionUpdate,
  onRegionDelete,
  onSelectedRegion,
  stageRef: externalStageRef,
  onScaleChange,
  editorRef,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalStageRef = useRef<Konva.Stage>(null)
  const stageRef = externalStageRef ?? internalStageRef
  const transformerRef = useRef<Konva.Transformer>(null)

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [scale, setScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('100')
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Paint state
  const isDrawing = useRef(false)
  const currentStrokePoints = useRef<number[]>([])
  const [drawingLine, setDrawingLine] = useState<number[] | null>(null)

  // Eyedropper preview state
  const [eyedropPreview, setEyedropPreview] = useState<{x: number; y: number; color: string} | null>(null)
  const eyedropCacheRef = useRef<ImageData | null>(null)

  // Store
  const activeTool = useAppStore((s) => s.activeTool)
  const brushColor = useAppStore((s) => s.brushColor)
  const brushSize = useAppStore((s) => s.brushSize)
  const brushOpacity = useAppStore((s) => s.brushOpacity)
  const brushShadowBlur = useAppStore((s) => s.brushShadowBlur)
  const brushStrokes = useAppStore((s) => s.brushStrokes)
  const addBrushStroke = useAppStore((s) => s.addBrushStroke)
  const setBrushColor = useAppStore((s) => s.setBrushColor)

  const isPanning = activeTool === 'pan'
  const isBrushActive = activeTool === 'brush' || activeTool === 'eraser'
  const isEyedropper = activeTool === 'eyedropper'

  // Expose deselect for export
  useImperativeHandle(editorRef, () => ({
    deselectAll: () => {
      setSelectedId(null)
      onSelectedRegion(null)
      transformerRef.current?.nodes([])
      transformerRef.current?.getLayer()?.batchDraw()
    },
  }), [onSelectedRegion])

  // Load image
  useEffect(() => {
    if (!imageUrl) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      fitImageToContainer(img)
    }
    img.src = imageUrl
  }, [imageUrl])

  const fitImageToContainer = useCallback((img: HTMLImageElement) => {
    const cw = containerRef.current?.clientWidth ?? 800
    const ch = containerRef.current?.clientHeight ?? 600
    const s = Math.min(cw / img.width, ch / img.height, 1)
    setScale(s)
    onScaleChange?.(s)
    // Stage fills entire container — image centered via stagePos
    setStageSize({ width: cw, height: ch })
    setStagePos({
      x: (cw - img.width * s) / 2,
      y: (ch - img.height * s) / 2,
    })
    setZoom(1)
    setZoomInput('100')
  }, [onScaleChange])

  // Resize observer — update stage size to match container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw > 0 && ch > 0) {
        setStageSize({ width: cw, height: ch })
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Update transformer when selection changes
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return

    if (selectedId) {
      const node = stage.findOne('#' + selectedId)
      if (node) {
        tr.nodes([node])
        tr.getLayer()?.batchDraw()
        return
      }
    }
    tr.nodes([])
    tr.getLayer()?.batchDraw()
  }, [selectedId, regions, stageRef])

  // Keyboard shortcuts: Delete key, Ctrl+Z/Y, Space for pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
        if (selectedId) {
          onRegionDelete(selectedId)
          setSelectedId(null)
          onSelectedRegion(null)
        }
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        useAppStore.getState().undoBrushStroke()
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        useAppStore.getState().redoBrushStroke()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, onRegionDelete, onSelectedRegion])

  // Selection
  const handleSelect = useCallback(
    (regionId: string | null) => {
      setSelectedId(regionId)
      onSelectedRegion(regionId)
    },
    [onSelectedRegion],
  )

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        if (!isBrushActive && !isEyedropper) {
          handleSelect(null)
        }
      }
    },
    [handleSelect, isBrushActive, isEyedropper],
  )

  // Eyedropper — build cache for fast sampling
  const buildEyedropCache = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return null
    try {
      const canvas = stage.toCanvas({ pixelRatio: 1 })
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      eyedropCacheRef.current = data
      return data
    } catch {
      return null
    }
  }, [stageRef])

  // Clear cache when leaving eyedropper
  useEffect(() => {
    if (!isEyedropper) {
      eyedropCacheRef.current = null
      setEyedropPreview(null)
    }
  }, [isEyedropper])

  // Eyedropper click — confirm color and switch back
  const handleEyedrop = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isEyedropper) return
      if (eyedropPreview) {
        setBrushColor(eyedropPreview.color)
        toast.success(`Picked: ${eyedropPreview.color}`, { duration: 1500 })
      }
      useAppStore.getState().setActiveTool('brush')
      setEyedropPreview(null)
      eyedropCacheRef.current = null
    },
    [isEyedropper, eyedropPreview, setBrushColor],
  )

  // Eyedropper mousemove — real-time preview
  const handleEyedropMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isEyedropper) return
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      let cache = eyedropCacheRef.current
      if (!cache) cache = buildEyedropCache()
      if (!cache) return

      const px = Math.round(pointer.x)
      const py = Math.round(pointer.y)
      if (px < 0 || py < 0 || px >= cache.width || py >= cache.height) return

      const i = (py * cache.width + px) * 4
      const hex = '#' + [cache.data[i], cache.data[i + 1], cache.data[i + 2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')

      setEyedropPreview({ x: e.evt.clientX, y: e.evt.clientY, color: hex })
    },
    [isEyedropper, stageRef, buildEyedropCache],
  )

  // Paint: mouse down — store points in IMAGE-SPACE (divide by scale)
  const handlePaintStart = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isBrushActive) return
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      isDrawing.current = true
      const x = (pointer.x - stagePos.x) / zoom / scale
      const y = (pointer.y - stagePos.y) / zoom / scale
      currentStrokePoints.current = [x, y]
      setDrawingLine([x, y])
    },
    [isBrushActive, stageRef, stagePos, zoom, scale],
  )

  // Paint: mouse move
  const handlePaintMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing.current || !isBrushActive) return
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const x = (pointer.x - stagePos.x) / zoom / scale
      const y = (pointer.y - stagePos.y) / zoom / scale
      currentStrokePoints.current = [...currentStrokePoints.current, x, y]
      setDrawingLine([...currentStrokePoints.current])
    },
    [isBrushActive, stageRef, stagePos, zoom, scale],
  )

  // Paint: mouse up
  const handlePaintEnd = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false

    if (currentStrokePoints.current.length >= 2) {
      const stroke: BrushStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        points: currentStrokePoints.current,
        color: activeTool === 'eraser' ? '#000000' : brushColor,
        width: brushSize,
        opacity: brushOpacity,
        shadowBlur: brushShadowBlur,
        tool: activeTool as 'brush' | 'eraser',
      }
      addBrushStroke(stroke)
    }
    currentStrokePoints.current = []
    setDrawingLine(null)
  }, [activeTool, brushColor, brushSize, brushOpacity, brushShadowBlur, addBrushStroke])

  // Drag end — update region bbox
  const handleDragEnd = useCallback(
    (regionId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      onRegionUpdate(regionId, {
        bbox: {
          ...regions.find((r) => r.id === regionId)!.bbox,
          x: node.x() / scale,
          y: node.y() / scale,
        },
      })
    },
    [regions, scale, onRegionUpdate],
  )

  // Transform end — update bbox + fontSize + rotation
  const handleTransformEnd = useCallback(
    (regionId: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Text
      const sx = node.scaleX()
      const sy = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)

      onRegionUpdate(regionId, {
        bbox: {
          x: node.x() / scale,
          y: node.y() / scale,
          width: (node.width() * sx) / scale,
          height: (node.height() * sy) / scale,
        },
        fontSize: node.fontSize() * sy,
        rotation: node.rotation(),
      })
    },
    [scale, onRegionUpdate],
  )

  // Scroll wheel zoom to pointer
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const oldZoom = zoom
      const newZoom = Math.max(
        0.1,
        Math.min(5, e.evt.deltaY > 0 ? oldZoom * 0.9 : oldZoom * 1.1),
      )

      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldZoom,
        y: (pointer.y - stagePos.y) / oldZoom,
      }

      setZoom(newZoom)
      setZoomInput(Math.round(newZoom * 100).toString())
      setStagePos({
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
      })
    },
    [zoom, stagePos, stageRef],
  )

  // Zoom helpers
  const applyZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(0.1, Math.min(5, newZoom))
    setZoom(clamped)
    setZoomInput(Math.round(clamped * 100).toString())
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
    setZoom(1)
    setZoomInput('100')
    // Re-center image in container
    if (image) {
      const cw = containerRef.current?.clientWidth ?? 800
      const ch = containerRef.current?.clientHeight ?? 600
      setStagePos({
        x: (cw - image.width * scale) / 2,
        y: (ch - image.height * scale) / 2,
      })
    } else {
      setStagePos({ x: 0, y: 0 })
    }
  }, [image, scale])

  const handleStageDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      setStagePos({ x: e.target.x(), y: e.target.y() })
    },
    [],
  )

  // Feather compensation: reduce strokeWidth, use shadowBlur to fill gap
  const computeFeather = (size: number, feather: number) => ({
    strokeWidth: Math.max(1, size - 2 * feather),
    shadowBlur: feather,
  })

  // Custom cursor based on active tool
  const getCursor = (): string => {
    if (isPanning) return 'grab'
    if (isEyedropper) {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m2 22 1-1h3l9-9'/><path d='M3 21v-3l9-9'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4'/></svg>`
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 22, crosshair`
    }
    if (isBrushActive) {
      const sz = Math.max(4, Math.round(brushSize * scale * zoom))
      const half = sz / 2
      const color = activeTool === 'eraser' ? 'rgba(255,0,0,0.5)' : brushColor
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${sz + 2}' height='${sz + 2}'><circle cx='${half + 1}' cy='${half + 1}' r='${half}' fill='none' stroke='${color}' stroke-width='1'/><line x1='${half + 1}' y1='0' x2='${half + 1}' y2='${sz + 2}' stroke='${color}' stroke-width='0.5'/><line x1='0' y1='${half + 1}' x2='${sz + 2}' y2='${half + 1}' stroke='${color}' stroke-width='0.5'/></svg>`
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half + 1} ${half + 1}, crosshair`
    }
    return 'default'
  }

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
            <ZoomOut size={14} />
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
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          className={`btn btn-xs ${isPanning ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => useAppStore.getState().setActiveTool(isPanning ? 'select' : 'pan')}
          title="Pan mode (or hold Alt)"
        >
          <Hand size={14} />
        </button>

        <button
          className="btn btn-xs btn-ghost"
          onClick={handleResetView}
          title="Reset view"
        >
          <RotateCcw size={14} />
        </button>

        <span className="text-[10px] text-base-content/30 ml-auto">
          {Math.round(zoom * 100)}% · {activeTool}
        </span>
      </div>

      {/* Canvas — fills entire space */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
      >
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={zoom}
          scaleY={zoom}
          x={stagePos.x}
          y={stagePos.y}
          draggable={isPanning}
          onWheel={handleWheel}
          onClick={(e) => {
            handleStageClick(e)
            handleEyedrop(e)
          }}
          onMouseDown={handlePaintStart}
          onMouseMove={(e) => {
            handlePaintMove(e)
            handleEyedropMove(e)
          }}
          onMouseUp={handlePaintEnd}
          onMouseLeave={handlePaintEnd}
          onDragEnd={handleStageDragEnd}
          style={{ cursor: getCursor() }}
        >
          {/* Layer 1: Background image */}
          <Layer>
            {image && (
              <KonvaImage
                image={image}
                width={image.width * scale}
                height={image.height * scale}
              />
            )}
          </Layer>

          {/* Layer 2: Paint strokes */}
          <Layer>
            {brushStrokes.map((stroke) => {
              const f = computeFeather(stroke.width, stroke.shadowBlur)
              return (
                <Line
                  key={stroke.id}
                  points={stroke.points.map((p) => p * scale)}
                  stroke={stroke.color}
                  strokeWidth={f.strokeWidth * scale}
                  opacity={stroke.opacity}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  shadowBlur={f.shadowBlur * scale}
                  shadowColor={stroke.tool === 'eraser' ? undefined : stroke.color}
                  globalCompositeOperation={
                    stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              )
            })}
            {/* Currently drawing line */}
            {drawingLine && drawingLine.length >= 2 && (() => {
              const f = computeFeather(brushSize, brushShadowBlur)
              return (
                <Line
                  points={drawingLine.map((p) => p * scale)}
                  stroke={activeTool === 'eraser' ? '#ff000080' : brushColor}
                  strokeWidth={f.strokeWidth * scale}
                  opacity={activeTool === 'eraser' ? 0.5 : brushOpacity}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  shadowBlur={f.shadowBlur * scale}
                  shadowColor={brushColor}
                  dash={activeTool === 'eraser' ? [5, 5] : undefined}
                />
              )
            })()}
          </Layer>

          {/* Layer 3: Text regions + Transformer */}
          <Layer>
            {regions.map((region) => {
              const font = resolveFont(region.suggestedFont, region.mood)
              return (
                <Text
                  key={region.id}
                  id={region.id}
                  x={region.bbox.x * scale}
                  y={region.bbox.y * scale}
                  width={region.bbox.width * scale}
                  text={region.translatedText || ' '}
                  fontSize={Math.max(10, region.fontSize * scale)}
                  fontFamily={font.family}
                  fontStyle={`${font.weight >= 700 ? 'bold' : 'normal'}${font.style === 'italic' ? ' italic' : ''}`}
                  fill={region.fontColor}
                  stroke={region.strokeWidth > 0 ? region.strokeColor : undefined}
                  strokeWidth={region.strokeWidth > 0 ? region.strokeWidth * scale : 0}
                  align="center"
                  wrap="char"
                  draggable={!isPanning && !isBrushActive && !isEyedropper}
                  rotation={region.rotation}
                  onClick={() => {
                    if (!isBrushActive && !isEyedropper) handleSelect(region.id)
                  }}
                  onDragEnd={(e) => handleDragEnd(region.id, e)}
                  onTransform={(e) => {
                    // Live preview during transform
                    const node = e.target as Konva.Text
                    node.getLayer()?.batchDraw()
                  }}
                  onTransformEnd={(e) => handleTransformEnd(region.id, e)}
                />
              )
            })}

            {/* Transformer for selected text */}
            <Transformer
              ref={transformerRef}
              borderStroke="#6366f1"
              anchorStroke="#6366f1"
              anchorFill="#ffffff"
              anchorSize={8}
              anchorCornerRadius={4}
              padding={4}
              rotateEnabled={true}
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
                'middle-left',
                'middle-right',
              ]}
            />
          </Layer>
        </Stage>

        {/* Eyedropper preview tooltip */}
        {eyedropPreview && (
          <div
            className="fixed z-100 pointer-events-none flex items-center gap-2 bg-base-300/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-base-content/10"
            style={{ left: eyedropPreview.x + 20, top: eyedropPreview.y - 10 }}
          >
            <div
              className="w-6 h-6 rounded border-2 border-base-content/30"
              style={{ backgroundColor: eyedropPreview.color }}
            />
            <span className="text-xs font-mono text-base-content">{eyedropPreview.color}</span>
          </div>
        )}
      </div>
    </div>
  )
}
