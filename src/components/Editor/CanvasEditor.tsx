import { Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Line } from 'react-konva'
import { Html } from 'react-konva-utils'
import Konva from 'konva'
import type { TextRegion, BrushStroke } from '../../types'
import { resolveRegionFont } from '../../config/fonts'
import { useAppStore } from '../../store/appStore'
import { getRegionTextLayout, normalizeTextAlign, normalizeTextLayoutMode } from '../../utils/textLayout'
import { computeBrushFeather } from '../../services/brushStrokes'
import { getEditorToolCursor } from '../../services/editorCursor'
import {
  shouldClearTextSelectionOnStagePointer,
  shouldStartBrushStroke,
  shouldSyncStagePositionOnDragEnd,
} from '../../services/konvaInteraction'
import {
  getArtisticInlineTextEditorLayerSize,
  getInlineTextEditorFontSize,
  getInlineTextEditorBboxSize,
  getInlineTextEditorLayerSize,
  getTextTransformerAnchors,
  getTextTransformerKeepRatio,
  getTextTransformerShiftBehavior,
  getTextBoxResizeResult,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import type { RegionUpdateOptions } from '../../store/appStore'
import InlineTextEditor from './InlineTextEditor'
import OversetTextBadge from './OversetTextBadge'
import { Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'

export interface CanvasEditorHandle {
  deselectAll: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
  setZoomPercent: (percent: number) => void
}

interface CanvasEditorProps {
  imageUrl: string
  regions: TextRegion[]
  onRegionUpdate: (id: string, updates: Partial<TextRegion>, options?: RegionUpdateOptions) => void
  onSelectedRegion: (id: string | null) => void
  stageRef?: React.RefObject<Konva.Stage | null>
  onScaleChange?: (scale: number) => void
  onViewportChange?: (state: { zoom: number; zoomPercent: number; imageWidth: number; imageHeight: number }) => void
  editorRef?: React.RefObject<CanvasEditorHandle | null>
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 24
const ZOOM_PERCENT_STEP = 10

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
  const textTransformStartRef = useRef<Record<string, TextRegion[]>>({})

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [scale, setScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('100')
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [inlineEdit, setInlineEdit] = useState<{
    id: string
    text: string
    initialText: string
    beforeRegions: TextRegion[]
  } | null>(null)

  // Paint state
  const isDrawing = useRef(false)
  const currentStrokePoints = useRef<number[]>([])
  const [drawingLine, setDrawingLine] = useState<number[] | null>(null)

  // Eyedropper preview state
  const [eyedropPreview, setEyedropPreview] = useState<{x: number; y: number; color: string} | null>(null)
  const eyedropCacheRef = useRef<ImageData | null>(null)

  const zoomPercent = Math.round(zoom * 100)

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
      zoomPercent,
      imageWidth: image?.naturalWidth ?? image?.width ?? 0,
      imageHeight: image?.naturalHeight ?? image?.height ?? 0,
    })
  }, [image, onViewportChange, zoom, zoomPercent])

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
      if (!isBrushActive && !isEyedropper && shouldClearTextSelectionOnStagePointer(e.target)) {
        handleSelect(null)
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
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isBrushActive) return
      if (!shouldStartBrushStroke(e.target)) return
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
      const isArtisticFree = layoutMode === 'artistic' && region.artisticFit !== 'bubble_guided'
      const font = resolveRegionFont(region)
      const historyBefore = textTransformStartRef.current[region.id]
      const fittingRegion = historyBefore?.find((item) => item.id === region.id) ?? region
      delete textTransformStartRef.current[region.id]
      const historyOptions: RegionUpdateOptions = {
        historyBefore,
        historyKey: `transform:${region.id}`,
      }

      if (isArtisticFree) {
        const pointScale = Math.max(0.1, Math.abs(node.scaleX()) || 1, Math.abs(node.scaleY()) || 1)
        const nextFontSize = Math.max(1, region.fontSize * pointScale)
        node.scaleX(1)
        node.scaleY(1)
        const nextLayout = getRegionTextLayout(
          { ...region, fontSize: nextFontSize },
          region.translatedText || ' ',
          {
            fontFamily: font.family,
            fontWeight: font.weight,
            fontStyle: font.style,
          },
        )
        node.width(nextLayout.innerWidth * scale)
        node.height(nextLayout.contentHeight * scale)
        node.getLayer()?.batchDraw()
        onRegionUpdate(region.id, {
          bbox: {
            x: node.x() / scale,
            y: node.y() / scale,
            width: nextLayout.innerWidth,
            height: nextLayout.contentHeight,
          },
          fontSize: nextFontSize,
          rotation: node.rotation(),
          textScaleX: 1,
          textScaleY: 1,
        }, historyOptions)
        return
      }

      const resized = applyLiveTextBoxResize(node)
      const nextBbox = {
        x: node.x() / scale,
        y: node.y() / scale,
        width: resized.width / scale,
        height: resized.height / scale,
      }
      const resizeResult = getTextBoxResizeResult({
        region: fittingRegion,
        bbox: nextBbox,
        text: region.translatedText || ' ',
        rotation: node.rotation(),
        fontFamily: font.family,
        fontWeight: font.weight,
        fontStyle: font.style,
      })

      onRegionUpdate(region.id, resizeResult.updates, historyOptions)
    },
    [applyLiveTextBoxResize, scale, onRegionUpdate],
  )

  // Scroll wheel zoom to pointer
  const applyZoom = useCallback((newZoom: number, anchor?: { x: number; y: number }) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
    const nextAnchor = anchor ?? {
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    }
    const worldPoint = {
      x: (nextAnchor.x - stagePos.x) / zoom,
      y: (nextAnchor.y - stagePos.y) / zoom,
    }
    setZoom(clamped)
    setZoomInput(Math.round(clamped * 100).toString())
    setStagePos({
      x: nextAnchor.x - worldPoint.x * clamped,
      y: nextAnchor.y - worldPoint.y * clamped,
    })
  }, [stagePos.x, stagePos.y, stageSize.height, stageSize.width, zoom])

  const applyZoomPercent = useCallback((percent: number) => {
    const clampedPercent = Math.max(MIN_ZOOM * 100, Math.min(MAX_ZOOM * 100, percent))
    applyZoom(clampedPercent / 100)
  }, [applyZoom])

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const nextZoom = e.evt.deltaY > 0 ? zoom * 0.9 : zoom * 1.1
      applyZoom(nextZoom, pointer)
    },
    [applyZoom, stageRef, zoom],
  )

  const handleZoomInputCommit = useCallback(() => {
    const val = parseInt(zoomInput, 10)
    if (!isNaN(val) && val >= MIN_ZOOM * 100 && val <= MAX_ZOOM * 100) {
      applyZoomPercent(val)
    } else {
      setZoomInput(zoomPercent.toString())
    }
  }, [applyZoomPercent, zoomInput, zoomPercent])

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

  useImperativeHandle(editorRef, () => ({
    deselectAll: () => {
      onSelectedRegion(null)
      transformerRef.current?.nodes([])
      transformerRef.current?.getLayer()?.batchDraw()
    },
    zoomIn: () => applyZoomPercent(zoomPercent + ZOOM_PERCENT_STEP),
    zoomOut: () => applyZoomPercent(zoomPercent - ZOOM_PERCENT_STEP),
    fitView: () => handleResetView(),
    setZoomPercent: (percent: number) => applyZoomPercent(percent),
  }), [applyZoomPercent, handleResetView, onSelectedRegion, zoomPercent])

  const handleStageDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!shouldSyncStagePositionOnDragEnd(e.target)) return
      setStagePos({ x: e.target.x(), y: e.target.y() })
    },
    [],
  )

  const selectedRegion = selectedId ? regions.find((region) => region.id === selectedId) : null
  const selectedLayoutMode = normalizeTextLayoutMode(selectedRegion?.textLayoutMode)
  const inlineEditRegion = inlineEdit ? regions.find((region) => region.id === inlineEdit.id) : null
  const inlineEditLayoutMode = normalizeTextLayoutMode(inlineEditRegion?.textLayoutMode)
  const inlineEditConstrainToFrame = inlineEditLayoutMode !== 'artistic' || inlineEditRegion?.artisticFit === 'bubble_guided'
  const inlineEditAlign = normalizeTextAlign(inlineEditRegion?.textAlign)
  const inlineEditFont = inlineEditRegion ? resolveRegionFont(inlineEditRegion) : null
  const inlineEditLayout = inlineEditRegion && inlineEditFont
    ? getRegionTextLayout(inlineEditRegion, inlineEdit?.text ?? '', {
        fontFamily: inlineEditFont.family,
        fontWeight: inlineEditFont.weight,
        fontStyle: inlineEditFont.style,
      })
    : null
  const inlineEditFontSize = inlineEditRegion
    ? getInlineTextEditorFontSize({
        fontSize: inlineEditLayout?.fontSize ?? inlineEditRegion.fontSize,
        scale,
      })
    : 14
  const inlineEditLineHeight = inlineEditLayout?.lineHeight ?? 1.18
  const inlineEditPaddingX = inlineEditLayout
    ? inlineEditLayout.paddingX * scale
    : (inlineEditLayoutMode === 'artistic' ? 0 : 8 * scale)
  const inlineEditPaddingY = inlineEditLayout
    ? inlineEditLayout.paddingY * scale
    : (inlineEditLayoutMode === 'artistic' ? 0 : 8 * scale)
  const inlineEditContentHeight = inlineEditLayout
    ? inlineEditLayout.contentHeight * scale
    : undefined
  const inlineEditSize = inlineEditRegion && inlineEditFont
    ? inlineEditConstrainToFrame
      ? getInlineTextEditorLayerSize({
          bbox: inlineEditRegion.bbox,
          scale,
          minWidth: 96 / zoom,
          minHeight: 44 / zoom,
        })
      : getArtisticInlineTextEditorLayerSize({
          text: inlineEdit?.text ?? '',
          bbox: inlineEditRegion.bbox,
          scale,
          fontSize: inlineEditRegion.fontSize,
          fontFamily: inlineEditFont.family,
          fontWeight: inlineEditFont.weight,
          fontStyle: inlineEditFont.style,
          lineHeight: inlineEditLayout?.lineHeight,
          minWidth: 24 / zoom,
          minHeight: 24 / zoom,
        })
    : null
  const startInlineEdit = useCallback(
    (region: TextRegion) => {
      if (isBrushActive || isEyedropper) return
      handleSelect(region.id)
      setInlineEdit({
        id: region.id,
        text: region.translatedText,
        initialText: region.translatedText,
        beforeRegions: cloneRegions(regions),
      })
    },
    [handleSelect, isBrushActive, isEyedropper, regions],
  )
  const updateInlineEditText = useCallback((text: string) => {
    if (!inlineEdit) return
    setInlineEdit((current) => current ? { ...current, text } : current)
    onRegionUpdate(inlineEdit.id, { translatedText: text }, { trackHistory: false })
  }, [inlineEdit, onRegionUpdate])
  const finishInlineEdit = useCallback((metrics: InlineTextEditorCommitMetrics | undefined, finalText: string) => {
    if (!inlineEdit) return
    if (finalText === inlineEdit.initialText) {
      setInlineEdit(null)
      return
    }
    const region = regions.find((item) => item.id === inlineEdit.id)
    const bboxSize = metrics
      ? getInlineTextEditorBboxSize({ metrics, scale })
      : null
    const layoutMode = normalizeTextLayoutMode(region?.textLayoutMode)
    const font = region ? resolveRegionFont(region) : null
    const nextBbox = region && bboxSize ? { ...region.bbox, ...bboxSize } : null
    const nextFontSize = region && font && nextBbox && layoutMode === 'balloon_fit'
      ? getRegionTextLayout({ ...region, bbox: nextBbox }, finalText || ' ', {
          fontFamily: font.family,
          fontWeight: font.weight,
          fontStyle: font.style,
        }).fontSize
      : undefined
    onRegionUpdate(inlineEdit.id, {
      translatedText: finalText,
      ...(nextBbox ? { bbox: nextBbox } : {}),
      ...(nextFontSize !== undefined ? { fontSize: nextFontSize } : {}),
    }, {
      historyBefore: inlineEdit.beforeRegions,
    })
    setInlineEdit(null)
  }, [inlineEdit, onRegionUpdate, regions, scale])
  const transformerAnchors = getTextTransformerAnchors(selectedLayoutMode)
  const transformerKeepRatio = getTextTransformerKeepRatio(selectedLayoutMode)
  const transformerShiftBehavior = getTextTransformerShiftBehavior(selectedLayoutMode)

  const backgroundLayer = useMemo(() => (
    <Layer>
      {image && (
        <KonvaImage
          image={image}
          width={image.width * scale}
          height={image.height * scale}
        />
      )}
    </Layer>
  ), [image, scale])

  const textRegionsLayer = useMemo(() => (
    <Layer visible={showTextOverlay}>
      {regions.map((region) => {
        const font = resolveRegionFont(region)
        const text = region.translatedText || ' '
        const regionLayout = getRegionTextLayout(region, text, {
          fontFamily: font.family,
          fontWeight: font.weight,
          fontStyle: font.style,
        })
        const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
        const isArtistic = layoutMode === 'artistic'
        const isArtisticFree = isArtistic && regionLayout.artisticFit === 'free'
        const fontSize = regionLayout.fontSize * scale
        return (
          <Fragment key={`${region.id}-${layoutMode}`}>
            <Text
              id={region.id}
              x={region.bbox.x * scale}
              y={region.bbox.y * scale}
              text={regionLayout.lines.join('\n')}
              fontSize={fontSize}
              fontFamily={font.family}
              fontStyle={`${font.weight >= 700 ? 'bold' : 'normal'}${font.style === 'italic' ? ' italic' : ''}`}
              fill={region.fontColor}
              stroke={region.strokeWidth > 0 ? region.strokeColor : undefined}
              strokeWidth={region.strokeWidth > 0 ? region.strokeWidth * scale : 0}
              fillAfterStrokeEnabled
              lineJoin={region.strokeJoin ?? 'round'}
              lineHeight={regionLayout.lineHeight}
              {...(isArtistic
                ? {
                    width: (isArtisticFree ? regionLayout.innerWidth : region.bbox.width) * scale,
                    height: (isArtisticFree ? regionLayout.contentHeight : region.bbox.height) * scale,
                    padding: regionLayout.artisticFit === 'bubble_guided'
                      ? Math.max(regionLayout.paddingX, regionLayout.paddingY) * scale
                      : 0,
                    wrap: 'none' as const,
                    align: regionLayout.textAlign,
                    scaleX: 1,
                    scaleY: 1,
                  }
                : {
                    width: region.bbox.width * scale,
                    height: region.bbox.height * scale,
                    padding: Math.max(regionLayout.paddingX, regionLayout.paddingY) * scale,
                    wrap: 'none' as const,
                    align: regionLayout.textAlign,
                    verticalAlign: 'middle' as const,
                  })}
              draggable={!isPanning && !isBrushActive && !isEyedropper}
              rotation={region.rotation}
              opacity={1}
              onClick={() => {
                if (!isBrushActive && !isEyedropper) handleSelect(region.id)
              }}
              onDblClick={() => startInlineEdit(region)}
              onDblTap={() => startInlineEdit(region)}
              onDragEnd={(e) => handleDragEnd(region.id, e)}
              onTransformStart={() => {
                textTransformStartRef.current[region.id] = cloneRegions(regions)
              }}
              onTransform={(e) => {
                const node = e.target as Konva.Text
                if (isArtisticFree) {
                  node.getLayer()?.batchDraw()
                  return
                }
                const resized = applyLiveTextBoxResize(node)
                const nextBbox = {
                  x: node.x() / scale,
                  y: node.y() / scale,
                  width: resized.width / scale,
                  height: resized.height / scale,
                }
                const fittingRegion = textTransformStartRef.current[region.id]?.find((item) => item.id === region.id) ?? region
                const resizeResult = getTextBoxResizeResult({
                  region: fittingRegion,
                  bbox: nextBbox,
                  text,
                  rotation: node.rotation(),
                  fontFamily: font.family,
                  fontWeight: font.weight,
                  fontStyle: font.style,
                })
                if (resizeResult.layout) {
                  node.text(resizeResult.layout.lines.join('\n'))
                  node.fontSize(resizeResult.layout.fontSize * scale)
                }
                onRegionUpdate(region.id, resizeResult.updates, { trackHistory: false })
              }}
              onTransformEnd={(e) => handleTransformEnd(region, e)}
            />
            {regionLayout.overflow && (
              <OversetTextBadge
                x={(region.bbox.x + region.bbox.width) * scale}
                y={(region.bbox.y + region.bbox.height) * scale}
                viewportZoom={zoom}
                showLabel={selectedId === region.id}
                labelText={regionLayout.overflowReason === 'readability' ? 'ตัวเล็ก/ล้น' : 'ข้อความยังล้น'}
              />
            )}
          </Fragment>
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
        keepRatio={transformerKeepRatio}
        enabledAnchors={transformerAnchors}
        shiftBehavior={transformerShiftBehavior}
        ignoreStroke
        flipEnabled={false}
        boundBoxFunc={(oldBox, newBox) => {
          if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 16) return oldBox
          return newBox
        }}
      />
    </Layer>
  ), [
    showTextOverlay, regions, scale, zoom, selectedId,
    isPanning, isBrushActive, isEyedropper, inlineEdit?.id,
    transformerKeepRatio, transformerAnchors, transformerShiftBehavior,
    handleSelect, startInlineEdit, handleDragEnd, applyLiveTextBoxResize, handleTransformEnd, onRegionUpdate
  ])

  return (
    <div className="studio-canvas flex h-full min-h-0 flex-col">
      <div className="absolute left-3 top-16 z-20 flex items-center gap-1.5 rounded-[8px] bg-black/45 p-1 backdrop-blur">
        <div className="flex items-center rounded-[7px] bg-black/20">
          <button
            className="moxzk-icon-button h-7 w-7"
            onClick={() => applyZoom(zoom - 0.1)}
            aria-label="ซูมออก"
          >
            <ZoomOut size={14} />
          </button>
          <div className="flex items-center">
            <input
              className="w-10 bg-transparent text-center font-mono text-xs text-[var(--moxzk-text)]"
              value={zoomInput}
              aria-label="เปอร์เซ็นต์ซูม"
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomInputCommit}
              onKeyDown={(e) => e.key === 'Enter' && handleZoomInputCommit()}
            />
            <span className="pr-1 text-xs text-[var(--moxzk-dim)]">%</span>
          </div>
          <button
            className="moxzk-icon-button h-7 w-7"
            onClick={() => applyZoom(zoom + 0.1)}
            aria-label="ซูมเข้า"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          className={`moxzk-icon-button h-7 w-7 ${isPanning ? 'moxzk-tool-active' : ''}`}
          onClick={() => {
            useAppStore.getState().setActiveTool(isPanning ? 'select' : 'pan')
            if (!isPanning) handleSelect(null)
          }}
          aria-label="โหมดเลื่อนผ้าใบ"
        >
          <Hand size={14} />
        </button>

        <button
          className="moxzk-icon-button h-7 w-7"
          onClick={handleResetView}
          aria-label="รีเซ็ตมุมมอง"
        >
          <RotateCcw size={14} />
        </button>

        <span className="px-1 text-[10px] text-[var(--moxzk-muted)]">
          {Math.round(zoom * 100)}% · {getToolLabel(activeTool)}
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
          style={{ cursor: getEditorToolCursor(activeTool) }}
        >
          {/* Layer 1: Background image */}
          {backgroundLayer}

          {/* Layer 2: Paint strokes */}
          <Layer>
            {brushStrokes.map((stroke) => {
              const f = computeBrushFeather(stroke.width, stroke.shadowBlur)
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
              const f = computeBrushFeather(brushSize, brushShadowBlur)
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
          {textRegionsLayer}

          <Layer>
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
                  visualValue={inlineEditConstrainToFrame && inlineEditLayout ? inlineEditLayout.lines.join('\n') : inlineEdit.text}
                  fontFamily={inlineEditFont.family}
                  fontWeight={inlineEditFont.weight}
                  fontStyle={inlineEditFont.style}
                  fontSize={inlineEditFontSize}
                  lineHeight={inlineEditLineHeight}
                  paddingX={inlineEditPaddingX}
                  paddingY={inlineEditPaddingY}
                  contentHeight={inlineEditContentHeight}
                  viewportZoom={zoom}
                  color={inlineEditRegion.fontColor}
                  align={inlineEditAlign}
                  layoutMode={inlineEditLayoutMode}
                  constrainToFrame={inlineEditConstrainToFrame}
                  onChange={updateInlineEditText}
                  onFinish={finishInlineEdit}
                />
              </Html>
            )}
          </Layer>
        </Stage>

        {/* Eyedropper preview tooltip */}
        {eyedropPreview && (
          <div
            className="fixed z-100 pointer-events-none flex items-center gap-2 rounded-[8px] bg-black/85 px-2.5 py-1.5 shadow-lg backdrop-blur"
            style={{ left: eyedropPreview.x + 20, top: eyedropPreview.y - 10 }}
          >
            <div
              className="h-6 w-6 rounded"
              style={{ backgroundColor: eyedropPreview.color }}
            />
            <span className="font-mono text-xs text-[var(--moxzk-text)]">{eyedropPreview.color}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function cloneRegions(regions: TextRegion[]): TextRegion[] {
  return regions.map((region) => ({
    ...region,
    bbox: { ...region.bbox },
  }))
}

function getToolLabel(tool: string): string {
  if (tool === 'brush') return 'แปรง'
  if (tool === 'eraser') return 'ยางลบ'
  if (tool === 'eyedropper') return 'ดูดสี'
  if (tool === 'pan') return 'เลื่อนผ้าใบ'
  return 'เลือก'
}
