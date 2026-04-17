import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Line } from 'react-konva'
import { Html } from 'react-konva-utils'
import Konva from 'konva'
import type { TextRegion, BrushStroke } from '../../types'
import { resolveFont } from '../../config/fonts'
import { useAppStore } from '../../store/appStore'
import { calculateBalloonFitFontSize, normalizeTextLayoutMode } from '../../utils/textLayout'
import {
  getInlineTextEditorBboxSize,
  getInlineTextEditorLayerSize,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import InlineTextEditor from './InlineTextEditor'
import { Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'

export interface CanvasEditorHandle {
  deselectAll: () => void
}

interface CanvasEditorProps {
  imageUrl: string
  regions: TextRegion[]
  onRegionUpdate: (id: string, updates: Partial<TextRegion>) => void
  onSelectedRegion: (id: string | null) => void
  stageRef?: React.RefObject<Konva.Stage | null>
  onScaleChange?: (scale: number) => void
  onViewportChange?: (state: { zoom: number; imageWidth: number; imageHeight: number }) => void
  editorRef?: React.RefObject<CanvasEditorHandle | null>
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

export default function CanvasEditor({
  imageUrl,
  regions,
  onRegionUpdate,
  onSelectedRegion,
  stageRef: externalStageRef,
  onScaleChange,
  onViewportChange,
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
  const [inlineEdit, setInlineEdit] = useState<{ id: string; text: string } | null>(null)

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
  const showTextOverlay = useAppStore((s) => s.showTextOverlay)
  const selectedId = useAppStore((s) => s.selectedRegionId)

  const isPanning = activeTool === 'pan'
  const isBrushActive = activeTool === 'brush' || activeTool === 'eraser'
  const isEyedropper = activeTool === 'eyedropper'

  // Expose deselect for export
  useImperativeHandle(editorRef, () => ({
    deselectAll: () => {
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

  useEffect(() => {
    onViewportChange?.({
      zoom,
      imageWidth: image?.naturalWidth ?? image?.width ?? 0,
      imageHeight: image?.naturalHeight ?? image?.height ?? 0,
    })
  }, [image, onViewportChange, zoom])

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

  // Selection
  const handleSelect = useCallback(
    (regionId: string | null) => {
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

  const applyLiveTextBoxResize = useCallback(
    (node: Konva.Text) => {
      const nextWidth = Math.max(20 * scale, node.width() * Math.abs(node.scaleX()))
      const nextHeight = Math.max(16 * scale, node.height() * Math.abs(node.scaleY()))

      node.scaleX(1)
      node.scaleY(1)
      node.width(nextWidth)
      node.height(nextHeight)
      node.getLayer()?.batchDraw()

      return { width: nextWidth, height: nextHeight }
    },
    [scale],
  )

  // Transform end — update paragraph box + rotation. Font size is edited separately.
  const handleTransformEnd = useCallback(
    (region: TextRegion, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Text
      const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)

      if (layoutMode === 'artistic') {
        const textScaleX = node.scaleX()
        const textScaleY = node.scaleY()

        onRegionUpdate(region.id, {
          bbox: {
            ...region.bbox,
            x: node.x() / scale,
            y: node.y() / scale,
            width: (node.width() * Math.abs(textScaleX)) / scale,
            height: (node.height() * Math.abs(textScaleY)) / scale,
          },
          textScaleX,
          textScaleY,
          rotation: node.rotation(),
        })
        return
      }

      const resized = applyLiveTextBoxResize(node)

      onRegionUpdate(region.id, {
        bbox: {
          x: node.x() / scale,
          y: node.y() / scale,
          width: resized.width / scale,
          height: resized.height / scale,
        },
        rotation: node.rotation(),
      })
    },
    [applyLiveTextBoxResize, scale, onRegionUpdate],
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
        MIN_ZOOM,
        Math.min(MAX_ZOOM, e.evt.deltaY > 0 ? oldZoom * 0.9 : oldZoom * 1.1),
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
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
    setZoom(clamped)
    setZoomInput(Math.round(clamped * 100).toString())
  }, [])

  const handleZoomInputCommit = useCallback(() => {
    const val = parseInt(zoomInput, 10)
    if (!isNaN(val) && val >= MIN_ZOOM * 100 && val <= MAX_ZOOM * 100) {
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

  const selectedRegion = selectedId ? regions.find((region) => region.id === selectedId) : null
  const selectedLayoutMode = normalizeTextLayoutMode(selectedRegion?.textLayoutMode)
  const inlineEditRegion = inlineEdit ? regions.find((region) => region.id === inlineEdit.id) : null
  const inlineEditLayoutMode = normalizeTextLayoutMode(inlineEditRegion?.textLayoutMode)
  const inlineEditFont = inlineEditRegion ? resolveFont(inlineEditRegion.suggestedFont, inlineEditRegion.mood) : null
  const inlineEditFontSize = inlineEditRegion
    ? (
        inlineEditLayoutMode === 'artistic'
          ? Math.max(8, inlineEditRegion.fontSize * scale)
          : calculateBalloonFitFontSize(inlineEdit?.text ?? '', inlineEditRegion.bbox, inlineEditRegion.fontSize) * scale
      )
    : 14
  const inlineEditSize = inlineEditRegion
    ? getInlineTextEditorLayerSize({
        bbox: inlineEditRegion.bbox,
        scale,
        minWidth: 96 / zoom,
        minHeight: 44 / zoom,
      })
    : null
  const startInlineEdit = useCallback(
    (region: TextRegion) => {
      if (isBrushActive || isEyedropper) return
      handleSelect(region.id)
      setInlineEdit({ id: region.id, text: region.translatedText })
    },
    [handleSelect, isBrushActive, isEyedropper],
  )
  const commitInlineEdit = useCallback((metrics?: InlineTextEditorCommitMetrics) => {
    if (!inlineEdit) return
    const region = regions.find((item) => item.id === inlineEdit.id)
    const bboxSize = metrics
      ? getInlineTextEditorBboxSize({ metrics, scale })
      : null
    onRegionUpdate(inlineEdit.id, {
      translatedText: inlineEdit.text,
      ...(region && bboxSize ? { bbox: { ...region.bbox, ...bboxSize } } : {}),
    })
    setInlineEdit(null)
  }, [inlineEdit, onRegionUpdate, regions, scale])
  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null)
  }, [])
  const transformerAnchors = selectedLayoutMode === 'artistic'
    ? [
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ]
    : [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'middle-left',
        'middle-right',
      ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-[8px] border border-[var(--mg-border)] bg-black/45 p-1 backdrop-blur">
        <div className="flex items-center rounded-[7px] border border-[var(--mg-border)]">
          <button
            className="mg-icon-button h-7 w-7"
            onClick={() => applyZoom(zoom - 0.1)}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <div className="flex items-center">
            <input
              className="w-10 bg-transparent text-center font-mono text-xs text-[var(--mg-text)]"
              value={zoomInput}
              aria-label="Zoom percent"
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomInputCommit}
              onKeyDown={(e) => e.key === 'Enter' && handleZoomInputCommit()}
            />
            <span className="pr-1 text-xs text-[var(--mg-dim)]">%</span>
          </div>
          <button
            className="mg-icon-button h-7 w-7"
            onClick={() => applyZoom(zoom + 0.1)}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          className={`mg-icon-button h-7 w-7 ${isPanning ? 'mg-tool-active' : ''}`}
          onClick={() => useAppStore.getState().setActiveTool(isPanning ? 'select' : 'pan')}
          aria-label="Pan mode"
        >
          <Hand size={14} />
        </button>

        <button
          className="mg-icon-button h-7 w-7"
          onClick={handleResetView}
          aria-label="Reset view"
        >
          <RotateCcw size={14} />
        </button>

        <span className="px-1 text-[10px] text-[var(--mg-muted)]">
          {Math.round(zoom * 100)}% · {activeTool}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1"
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
          <Layer visible={showTextOverlay}>
            {regions.map((region) => {
              const font = resolveFont(region.suggestedFont, region.mood)
              const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
              const isArtistic = layoutMode === 'artistic'
              const text = region.translatedText || ' '
              const fontSize = isArtistic
                ? Math.max(8, region.fontSize * scale)
                : calculateBalloonFitFontSize(text, region.bbox, region.fontSize) * scale
              return (
                <Text
                  key={`${region.id}-${layoutMode}`}
                  id={region.id}
                  x={region.bbox.x * scale}
                  y={region.bbox.y * scale}
                  text={text}
                  fontSize={fontSize}
                  fontFamily={font.family}
                  fontStyle={`${font.weight >= 700 ? 'bold' : 'normal'}${font.style === 'italic' ? ' italic' : ''}`}
                  fill={region.fontColor}
                  stroke={region.strokeWidth > 0 ? region.strokeColor : undefined}
                  strokeWidth={region.strokeWidth > 0 ? region.strokeWidth * scale : 0}
                  fillAfterStrokeEnabled
                  lineJoin={region.strokeJoin ?? 'round'}
                  lineHeight={1.18}
                  {...(isArtistic
                    ? {
                        wrap: 'none' as const,
                        align: 'left' as const,
                        scaleX: region.textScaleX ?? 1,
                        scaleY: region.textScaleY ?? 1,
                      }
                    : {
                        width: region.bbox.width * scale,
                        height: region.bbox.height * scale,
                        padding: 8 * scale,
                        wrap: 'word' as const,
                        align: 'center' as const,
                        verticalAlign: 'middle' as const,
                      })}
                  draggable={!isPanning && !isBrushActive && !isEyedropper}
                  rotation={region.rotation}
                  opacity={inlineEdit?.id === region.id ? 0.12 : 1}
                  onClick={() => {
                    if (!isBrushActive && !isEyedropper) handleSelect(region.id)
                  }}
                  onDblClick={() => startInlineEdit(region)}
                  onDblTap={() => startInlineEdit(region)}
                  onDragEnd={(e) => handleDragEnd(region.id, e)}
                  onTransform={(e) => {
                    const node = e.target as Konva.Text
                    if (layoutMode === 'balloon_fit') {
                      applyLiveTextBoxResize(node)
                    } else {
                      node.getLayer()?.batchDraw()
                    }
                  }}
                  onTransformEnd={(e) => handleTransformEnd(region, e)}
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
              keepRatio={false}
              enabledAnchors={transformerAnchors}
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 16) return oldBox
                return newBox
              }}
            />

            {showTextOverlay && inlineEdit && inlineEditRegion && inlineEditSize && inlineEditFont && (
              <Html
                groupProps={{
                  x: inlineEditRegion.bbox.x * scale,
                  y: inlineEditRegion.bbox.y * scale,
                  rotation: inlineEditRegion.rotation,
                }}
                transform
              >
                <InlineTextEditor
                  width={inlineEditSize.width}
                  height={inlineEditSize.height}
                  value={inlineEdit.text}
                  fontFamily={inlineEditFont.family}
                  fontWeight={inlineEditFont.weight}
                  fontStyle={inlineEditFont.style}
                  fontSize={inlineEditFontSize}
                  padding={inlineEditLayoutMode === 'artistic' ? 0 : 8 * scale}
                  viewportZoom={zoom}
                  color={inlineEditRegion.fontColor}
                  align={inlineEditLayoutMode === 'artistic' ? 'left' : 'center'}
                  onChange={(text) => setInlineEdit((current) => current ? { ...current, text } : current)}
                  onCommit={commitInlineEdit}
                  onCancel={cancelInlineEdit}
                />
              </Html>
            )}
          </Layer>
        </Stage>

        {/* Eyedropper preview tooltip */}
        {eyedropPreview && (
          <div
            className="fixed z-100 pointer-events-none flex items-center gap-2 rounded-[8px] border border-[var(--mg-border)] bg-black/85 px-2.5 py-1.5 shadow-lg backdrop-blur"
            style={{ left: eyedropPreview.x + 20, top: eyedropPreview.y - 10 }}
          >
            <div
              className="h-6 w-6 rounded border-2 border-[var(--mg-border-strong)]"
              style={{ backgroundColor: eyedropPreview.color }}
            />
            <span className="font-mono text-xs text-[var(--mg-text)]">{eyedropPreview.color}</span>
          </div>
        )}
      </div>
    </div>
  )
}
