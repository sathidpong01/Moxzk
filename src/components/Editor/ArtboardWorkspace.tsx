import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { Html } from 'react-konva-utils'
import Konva from 'konva'
import type { ActiveTool, ImageEntry, TextRegion } from '../../types'
import {
  ARTBOARD_COLUMNS,
  ARTBOARD_GAP_X,
  ARTBOARD_HEADER_HEIGHT,
  ARTBOARD_MAX_PREVIEW_WIDTH,
  ARTBOARD_ROW_HEIGHT,
  getDefaultArtboardPosition,
  type RegionUpdateOptions,
  useAppStore,
} from '../../store/appStore'
import { useAlbumStore } from '../../store/albumStore'
import { resolveRegionFont } from '../../config/fonts'
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
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import { translateSingleRegion } from '../../services/ollama'
import {
  computeBoardViewport,
  getViewportZoomPercent,
  getZoomFromViewportPercent,
} from '../../services/workspaceViewport'
import type { CanvasEditorHandle } from './CanvasEditor'
import InlineTextEditor from './InlineTextEditor'
import ContextualTextHud from './ContextualTextHud'
import OversetTextBadge from './OversetTextBadge'
import { Button, Modal } from '../ui/primitives'
import { toast } from 'sonner'

interface ArtboardWorkspaceProps {
  entries: ImageEntry[]
  stageRef?: React.RefObject<Konva.Stage | null>
  editorRef?: React.RefObject<CanvasEditorHandle | null>
  onViewportChange?: (state: { zoom: number; zoomPercent: number; imageWidth: number; imageHeight: number }) => void
  activeProcessCard?: ArtboardProcessCard | null
}

export interface ArtboardProcessCard {
  type: 'running' | 'error'
  label: string
  message: string
  progress?: number
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

interface LoadedImage {
  id: string
  image: HTMLImageElement
  scale: number
  width: number
  height: number
  offsetX: number
  offsetY: number
  frameWidth: number
  frameHeight: number
}

interface ReorderPreviewState {
  entryId: string
  sourceIndex: number
  targetIndex: number
  dragX: number
  dragY: number
}

const statusLabel: Record<ImageEntry['status'], string> = {
  pending: 'รอ',
  clean_queued: 'รอคลีน',
  cleaning: 'คลีน',
  clean_done: 'คลีนแล้ว',
  translate_queued: 'รอแปล',
  translating: 'แปล',
  processing: 'ทำงาน',
  done: 'เสร็จ',
  error: 'พลาด',
}

const ARTBOARD_FRAME_WIDTH = ARTBOARD_MAX_PREVIEW_WIDTH
const ARTBOARD_FRAME_HEIGHT = Math.round(ARTBOARD_MAX_PREVIEW_WIDTH * 1.42)
const MIN_ZOOM = 0.1
const MAX_ZOOM = 24
const ZOOM_PERCENT_STEP = 10

function easeOutCubic(value: number): number {
  return 1 - ((1 - value) ** 3)
}

function roundZoom(value: number): number {
  return Number(value.toFixed(2))
}

function getArtboardSurfaceMetrics(artboard: {
  width: number
  height: number
  loaded?: LoadedImage
}) {
  const contentX = artboard.loaded?.offsetX ?? 0
  const contentY = artboard.loaded?.offsetY ?? 0
  const contentWidth = artboard.loaded?.width ?? artboard.width
  const contentHeight = artboard.loaded?.height ?? artboard.height
  const surfacePadding = artboard.loaded ? 12 : 0
  const surfaceX = Math.max(0, contentX - surfacePadding)
  const surfaceY = Math.max(0, contentY - surfacePadding)
  const surfaceWidth = Math.min(artboard.width - surfaceX, contentWidth + surfacePadding * 2)
  const surfaceHeight = Math.min(artboard.height - surfaceY, contentHeight + surfacePadding * 2)

  return {
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    surfaceX,
    surfaceY,
    surfaceWidth,
    surfaceHeight,
  }
}

export default function ArtboardWorkspace({
  entries,
  stageRef: externalStageRef,
  editorRef,
  onViewportChange,
  activeProcessCard,
}: ArtboardWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalStageRef = useRef<Konva.Stage>(null)
  const stageRef = externalStageRef ?? internalStageRef
  const transformerRef = useRef<Konva.Transformer>(null)
  const isDrawing = useRef(false)
  const currentStrokePoints = useRef<number[]>([])

  const activeImageId = useAppStore((s) => s.activeImageId)
  const activeTool = useAppStore((s) => s.activeTool)
  const switchImage = useAppStore((s) => s.switchImage)
  const removeImageEntry = useAppStore((s) => s.removeImageEntry)
  const reorderImages = useAppStore((s) => s.reorderImages)
  const updateAlbumPage = useAlbumStore((s) => s.updatePage)
  const deleteAlbumPage = useAlbumStore((s) => s.deletePage)
  const reorderAlbumPages = useAlbumStore((s) => s.reorderPages)
  const currentAlbum = useAlbumStore((s) => s.currentAlbum)
  const setActiveTool = useAppStore((s) => s.setActiveTool)
  const selectedRegionId = useAppStore((s) => s.selectedRegionId)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const updateEntryRegionStore = useAppStore((s) => s.updateEntryRegion)
  const deleteRegion = useAppStore((s) => s.deleteRegion)
  const addBrushStroke = useAppStore((s) => s.addBrushStroke)
  const setBrushColor = useAppStore((s) => s.setBrushColor)
  const brushColor = useAppStore((s) => s.brushColor)
  const brushSize = useAppStore((s) => s.brushSize)
  const brushOpacity = useAppStore((s) => s.brushOpacity)
  const brushShadowBlur = useAppStore((s) => s.brushShadowBlur)
  const showTextOverlay = useAppStore((s) => s.showTextOverlay)

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [loadedImages, setLoadedImages] = useState<Record<string, LoadedImage>>({})
  const [drawingLine, setDrawingLine] = useState<number[] | null>(null)
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<ImageEntry | null>(null)
  const [isDeletingPage, setIsDeletingPage] = useState(false)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; text: string; beforeRegions: TextRegion[] } | null>(null)
  const [eyedropPreview, setEyedropPreview] = useState<{ x: number; y: number; color: string } | null>(null)
  const [hudTranslating, setHudTranslating] = useState(false)
  const [hudHidden, setHudHidden] = useState(false)
  const [previewOriginalRegionId, setPreviewOriginalRegionId] = useState<string | null>(null)
  const [animatedArtboardPositions, setAnimatedArtboardPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [reorderPreview, setReorderPreview] = useState<ReorderPreviewState | null>(null)
  const eyedropCacheRef = useRef<ImageData | null>(null)
  const artboardAnimationFrameRef = useRef<number | null>(null)
  const animatedArtboardPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const initialViewportAppliedRef = useRef(false)
  const reorderPreviewRef = useRef<ReorderPreviewState | null>(null)
  const reorderPreviewPendingRef = useRef<ReorderPreviewState | null>(null)
  const reorderPreviewAnimationFrameRef = useRef<number | null>(null)

  const activeEntry = entries.find((entry) => entry.id === activeImageId) ?? entries[0]
  const isPanning = activeTool === 'pan'
  const isBrushActive = activeTool === 'brush' || activeTool === 'eraser'
  const isEyedropper = activeTool === 'eyedropper'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => setStageSize({
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
    })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    entries.forEach((entry) => {
      const src = entry.cleanedImageUrl || entry.originalUrl
      if (!src || loadedImages[entry.id]?.image.src === src) return
      const image = new window.Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => {
        if (cancelled) return
        const scale = Math.min(ARTBOARD_FRAME_WIDTH / image.width, ARTBOARD_FRAME_HEIGHT / image.height)
        const width = image.width * scale
        const height = image.height * scale
        setLoadedImages((current) => ({
          ...current,
          [entry.id]: {
            id: entry.id,
            image,
            scale,
            width,
            height,
            offsetX: (ARTBOARD_FRAME_WIDTH - width) / 2,
            offsetY: (ARTBOARD_FRAME_HEIGHT - height) / 2,
            frameWidth: ARTBOARD_FRAME_WIDTH,
            frameHeight: ARTBOARD_FRAME_HEIGHT,
          },
        }))
      }
      image.src = src
    })
    return () => { cancelled = true }
  }, [entries, loadedImages])

  useEffect(() => {
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage || !selectedRegionId) {
      transformer?.nodes([])
      return
    }
    const node = stage.findOne(`#${selectedRegionId}`)
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedRegionId, stageRef, entries, loadedImages])

  const artboards = useMemo(() => entries.map((entry, index) => {
    const fallback = getDefaultArtboardPosition(index)
    const loaded = loadedImages[entry.id]
    return {
      entry,
      x: entry.artboardX ?? fallback.x,
      y: entry.artboardY ?? fallback.y,
      scale: loaded?.scale ?? 0.25,
      width: ARTBOARD_FRAME_WIDTH,
      height: ARTBOARD_FRAME_HEIGHT,
      loaded,
    }
  }), [entries, loadedImages])
  const artboardMotionKey = useMemo(
    () => artboards
      .map((artboard) => `${artboard.entry.id}:${Math.round(artboard.x)}:${Math.round(artboard.y)}`)
      .join('|'),
    [artboards],
  )

  useEffect(() => {
    const nextPositions = Object.fromEntries(
      artboards.map((artboard) => [artboard.entry.id, { x: artboard.x, y: artboard.y }]),
    )
    const previousPositions = animatedArtboardPositionsRef.current
    const nextIds = Object.keys(nextPositions)
    const previousIds = Object.keys(previousPositions)

    if (
      nextIds.length === 0
      || previousIds.length === 0
      || nextIds.length !== previousIds.length
      || nextIds.some((id) => !previousPositions[id])
    ) {
      if (artboardAnimationFrameRef.current !== null) {
        cancelAnimationFrame(artboardAnimationFrameRef.current)
        artboardAnimationFrameRef.current = null
      }
      animatedArtboardPositionsRef.current = nextPositions
      setAnimatedArtboardPositions(nextPositions)
      return
    }

    const hasMotion = nextIds.some((id) => (
      Math.round(previousPositions[id].x) !== Math.round(nextPositions[id].x)
      || Math.round(previousPositions[id].y) !== Math.round(nextPositions[id].y)
    ))
    if (!hasMotion) return

    if (artboardAnimationFrameRef.current !== null) {
      cancelAnimationFrame(artboardAnimationFrameRef.current)
      artboardAnimationFrameRef.current = null
    }

    const startedAt = performance.now()
    const duration = 190

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = easeOutCubic(progress)
      const framePositions = Object.fromEntries(
        nextIds.map((id) => {
          const from = previousPositions[id]
          const to = nextPositions[id]
          return [
            id,
            {
              x: from.x + (to.x - from.x) * eased,
              y: from.y + (to.y - from.y) * eased,
            },
          ]
        }),
      )
      animatedArtboardPositionsRef.current = framePositions
      setAnimatedArtboardPositions(framePositions)

      if (progress < 1) {
        artboardAnimationFrameRef.current = requestAnimationFrame(animate)
        return
      }

      animatedArtboardPositionsRef.current = nextPositions
      setAnimatedArtboardPositions(nextPositions)
      artboardAnimationFrameRef.current = null
    }

    artboardAnimationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (artboardAnimationFrameRef.current !== null) {
        cancelAnimationFrame(artboardAnimationFrameRef.current)
        artboardAnimationFrameRef.current = null
      }
    }
  }, [artboardMotionKey, artboards])

  const renderedArtboards = useMemo(() => (
    artboards.map((artboard) => {
      const animatedPosition = animatedArtboardPositions[artboard.entry.id]
      return {
        ...artboard,
        targetX: artboard.x,
        targetY: artboard.y,
        x: animatedPosition?.x ?? artboard.x,
        y: animatedPosition?.y ?? artboard.y,
      }
    })
  ), [animatedArtboardPositions, artboards])

  const activeArtboard = renderedArtboards.find((artboard) => artboard.entry.id === activeImageId)
  const applyViewportState = useCallback((next: { zoom: number; x: number; y: number }) => {
    setZoom(next.zoom)
    setStagePos({ x: next.x, y: next.y })
  }, [])

  const boardViewportBounds = useMemo(() => (
    artboards.map((artboard) => {
      return {
        x: artboard.x - 28,
        y: artboard.y - ARTBOARD_HEADER_HEIGHT,
        width: artboard.width + 56,
        height: artboard.height + ARTBOARD_HEADER_HEIGHT + 24,
      }
    })
  ), [artboards])
  const boardViewport = useMemo(() => (
    computeBoardViewport({
      stageSize,
      artboards: boardViewportBounds,
    })
  ), [boardViewportBounds, stageSize])
  const zoomPercent = getViewportZoomPercent(zoom, activeArtboard?.scale ?? 1)

  useEffect(() => {
    const activeImage = activeEntry ? loadedImages[activeEntry.id] : null
    onViewportChange?.({
      zoom,
      zoomPercent,
      imageWidth: activeImage?.image.naturalWidth ?? 0,
      imageHeight: activeImage?.image.naturalHeight ?? 0,
    })
  }, [activeEntry, loadedImages, onViewportChange, zoom, zoomPercent])

  useEffect(() => {
    if (initialViewportAppliedRef.current) return
    if (stageSize.width <= 0 || stageSize.height <= 0 || artboards.length === 0) return
    applyViewportState(boardViewport)
    initialViewportAppliedRef.current = true
  }, [applyViewportState, artboards.length, boardViewport, stageSize.height, stageSize.width])

  const applyZoom = useCallback((nextZoom: number, anchor?: { x: number; y: number }) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    const nextAnchor = anchor ?? {
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    }
    const worldPoint = {
      x: (nextAnchor.x - stagePos.x) / zoom,
      y: (nextAnchor.y - stagePos.y) / zoom,
    }
    setZoom(roundZoom(clamped))
    setStagePos({
      x: nextAnchor.x - worldPoint.x * clamped,
      y: nextAnchor.y - worldPoint.y * clamped,
    })
  }, [stagePos.x, stagePos.y, stageSize.height, stageSize.width, zoom])

  const applyZoomPercent = useCallback((percent: number) => {
    const activeScale = activeArtboard?.scale ?? 1
    const minPercent = Math.max(1, getViewportZoomPercent(MIN_ZOOM, activeScale))
    const maxPercent = getViewportZoomPercent(MAX_ZOOM, activeScale)
    const clampedPercent = Math.max(minPercent, Math.min(maxPercent, percent))
    const nextZoom = getZoomFromViewportPercent(clampedPercent, activeScale)

    applyZoom(nextZoom)
  }, [activeArtboard?.scale, applyZoom])

  const fitView = useCallback(() => {
    if (artboards.length === 0) return
    applyViewportState(boardViewport)
  }, [applyViewportState, artboards.length, boardViewport])

  useImperativeHandle(editorRef, () => ({
    deselectAll: () => {
      selectRegion(null)
      transformerRef.current?.nodes([])
      transformerRef.current?.getLayer()?.batchDraw()
    },
    zoomIn: () => applyZoomPercent(zoomPercent + ZOOM_PERCENT_STEP),
    zoomOut: () => applyZoomPercent(zoomPercent - ZOOM_PERCENT_STEP),
    fitView,
    setZoomPercent: (percent: number) => applyZoomPercent(percent),
  }), [applyZoomPercent, fitView, selectRegion, zoomPercent])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer) return
    const nextZoom = e.evt.deltaY > 0 ? zoom * 0.9 : zoom * 1.1
    applyZoom(nextZoom, pointer)
  }, [applyZoom, stageRef, zoom])

  const pointerToActiveImagePoint = useCallback(() => {
    const stage = stageRef.current
    if (!stage || !activeArtboard) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    const worldX = (pointer.x - stagePos.x) / zoom
    const worldY = (pointer.y - stagePos.y) / zoom
    const offsetX = activeArtboard.loaded?.offsetX ?? 0
    const offsetY = activeArtboard.loaded?.offsetY ?? 0
    const x = (worldX - activeArtboard.x - offsetX) / activeArtboard.scale
    const y = (worldY - activeArtboard.y - offsetY) / activeArtboard.scale
    const imageWidth = activeArtboard.loaded?.image.width ?? activeArtboard.width / activeArtboard.scale
    const imageHeight = activeArtboard.loaded?.image.height ?? activeArtboard.height / activeArtboard.scale
    if (x < 0 || y < 0 || x > imageWidth || y > imageHeight) {
      return null
    }
    return { x, y }
  }, [activeArtboard, stagePos, stageRef, zoom])

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

  const sampleEyedropColor = useCallback(() => {
    if (!isEyedropper) return null
    const stage = stageRef.current
    if (!stage) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null

    let cache = eyedropCacheRef.current
    if (!cache) cache = buildEyedropCache()
    if (!cache) return null

    const px = Math.round(pointer.x)
    const py = Math.round(pointer.y)
    if (px < 0 || py < 0 || px >= cache.width || py >= cache.height) return null

    const i = (py * cache.width + px) * 4
    return '#' + [cache.data[i], cache.data[i + 1], cache.data[i + 2]]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  }, [buildEyedropCache, isEyedropper, stageRef])

  useEffect(() => {
    if (!isEyedropper) {
      eyedropCacheRef.current = null
      setEyedropPreview(null)
    }
  }, [isEyedropper])

  const handleEyedropMove = useCallback((event: Konva.KonvaEventObject<MouseEvent>) => {
    const color = sampleEyedropColor()
    if (!color) return
    setEyedropPreview({ x: event.evt.clientX, y: event.evt.clientY, color })
  }, [sampleEyedropColor])

  const handleEyedrop = useCallback(() => {
    if (!isEyedropper) return
    const color = eyedropPreview?.color ?? sampleEyedropColor()
    if (color) {
      setBrushColor(color)
      toast.success(`Picked: ${color}`, { duration: 1500 })
    }
    setActiveTool('brush')
    setEyedropPreview(null)
    eyedropCacheRef.current = null
  }, [eyedropPreview, isEyedropper, sampleEyedropColor, setActiveTool, setBrushColor])

  const handleStageClick = useCallback((event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isBrushActive && !isEyedropper && shouldClearTextSelectionOnStagePointer(event.target)) {
      selectRegion(null)
    }
  }, [isBrushActive, isEyedropper, selectRegion])

  const handlePaintStart = useCallback((event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isBrushActive || !activeEntry) return
    if (!shouldStartBrushStroke(event.target)) return
    const point = pointerToActiveImagePoint()
    if (!point) return
    isDrawing.current = true
    currentStrokePoints.current = [point.x, point.y]
    setDrawingLine([point.x, point.y])
  }, [activeEntry, isBrushActive, pointerToActiveImagePoint])

  const handlePaintMove = useCallback(() => {
    if (!isDrawing.current || !isBrushActive) return
    const point = pointerToActiveImagePoint()
    if (!point) return
    currentStrokePoints.current = [...currentStrokePoints.current, point.x, point.y]
    setDrawingLine([...currentStrokePoints.current])
  }, [isBrushActive, pointerToActiveImagePoint])

  const handlePaintEnd = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (currentStrokePoints.current.length >= 2) {
      addBrushStroke({
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        points: currentStrokePoints.current,
        color: activeTool === 'eraser' ? '#000000' : brushColor,
        width: brushSize,
        opacity: activeTool === 'eraser' ? 1 : brushOpacity,
        shadowBlur: brushShadowBlur,
        tool: activeTool as 'brush' | 'eraser',
      })
    }
    currentStrokePoints.current = []
    setDrawingLine(null)
  }, [activeTool, addBrushStroke, brushColor, brushOpacity, brushShadowBlur, brushSize])

  const applyEntryRegionUpdate = useCallback((
    entryId: string,
    regionId: string,
    updates: Partial<TextRegion>,
    options?: RegionUpdateOptions,
  ) => {
    updateEntryRegionStore(entryId, regionId, updates, options)
  }, [updateEntryRegionStore])

  const selectedRegion = activeEntry?.regions.find((region) => region.id === selectedRegionId) ?? null
  const inlineEditRegion = inlineEdit ? activeEntry?.regions.find((region) => region.id === inlineEdit.id) ?? null : null
  useEffect(() => {
    if (!selectedRegionId || previewOriginalRegionId !== selectedRegionId) {
      setPreviewOriginalRegionId(null)
    }
  }, [previewOriginalRegionId, selectedRegionId])
  useEffect(() => {
    if (activeTool !== 'select') {
      setPreviewOriginalRegionId(null)
    }
  }, [activeTool])
  useEffect(() => {
    setHudHidden(false)
  }, [activeTool, selectedRegionId])
  const inlineEditLayoutMode = normalizeTextLayoutMode(inlineEditRegion?.textLayoutMode)
  const inlineEditConstrainToFrame = inlineEditLayoutMode !== 'artistic' || inlineEditRegion?.artisticFit === 'bubble_guided'
  const inlineEditAlign = normalizeTextAlign(inlineEditRegion?.textAlign)
  const inlineEditFont = inlineEditRegion ? resolveRegionFont(inlineEditRegion) : null
  const inlineEditScale = activeArtboard?.scale ?? 1
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
        scale: inlineEditScale,
      })
    : 14
  const inlineEditLineHeight = inlineEditLayout?.lineHeight ?? 1.18
  const inlineEditPaddingX = inlineEditLayout
    ? inlineEditLayout.paddingX * inlineEditScale
    : (inlineEditLayoutMode === 'artistic' ? 0 : 8 * inlineEditScale)
  const inlineEditPaddingY = inlineEditLayout
    ? inlineEditLayout.paddingY * inlineEditScale
    : (inlineEditLayoutMode === 'artistic' ? 0 : 8 * inlineEditScale)
  const inlineEditContentHeight = inlineEditLayout
    ? inlineEditLayout.contentHeight * inlineEditScale
    : undefined
  const inlineEditSize = inlineEditRegion && inlineEditFont
    ? inlineEditConstrainToFrame
      ? getInlineTextEditorLayerSize({
          bbox: inlineEditRegion.bbox,
          scale: inlineEditScale,
          minWidth: 96 / zoom,
          minHeight: 44 / zoom,
        })
      : getArtisticInlineTextEditorLayerSize({
          text: inlineEdit?.text ?? '',
          bbox: inlineEditRegion.bbox,
          scale: inlineEditScale,
          fontSize: inlineEditRegion.fontSize,
          fontFamily: inlineEditFont.family,
          fontWeight: inlineEditFont.weight,
          fontStyle: inlineEditFont.style,
          lineHeight: inlineEditLayout?.lineHeight,
          minWidth: 24 / zoom,
          minHeight: 24 / zoom,
        })
    : null
  const inlineEditPosition = inlineEditRegion && activeArtboard
    ? {
        x: activeArtboard.x + (activeArtboard.loaded?.offsetX ?? 0) + inlineEditRegion.bbox.x * inlineEditScale,
        y: activeArtboard.y + (activeArtboard.loaded?.offsetY ?? 0) + inlineEditRegion.bbox.y * inlineEditScale,
      }
    : null
  const startInlineEdit = useCallback(
    (region: TextRegion) => {
      if (isBrushActive) return
      selectRegion(region.id)
      setPreviewOriginalRegionId(null)
      setHudHidden(false)
      setInlineEdit({ id: region.id, text: region.translatedText, beforeRegions: cloneRegions(activeEntry?.regions ?? []) })
    },
    [activeEntry?.regions, isBrushActive, selectRegion],
  )
  const updateInlineEditText = useCallback((text: string) => {
    if (!inlineEdit || !activeEntry) return
    setInlineEdit((current) => current ? { ...current, text } : current)
    applyEntryRegionUpdate(activeEntry.id, inlineEdit.id, { translatedText: text }, { trackHistory: false })
  }, [activeEntry, inlineEdit])
  const finishInlineEdit = useCallback((metrics: InlineTextEditorCommitMetrics | undefined, finalText: string) => {
    if (!inlineEdit || !activeEntry) return
    const region = activeEntry.regions.find((item) => item.id === inlineEdit.id)
    const bboxSize = metrics
      ? getInlineTextEditorBboxSize({ metrics, scale: inlineEditScale })
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
    applyEntryRegionUpdate(activeEntry.id, inlineEdit.id, {
      translatedText: finalText,
      ...(nextBbox ? { bbox: nextBbox } : {}),
      ...(nextFontSize !== undefined ? { fontSize: nextFontSize } : {}),
    }, {
      historyBefore: inlineEdit.beforeRegions,
    })
    setPreviewOriginalRegionId(null)
    setHudHidden(false)
    setInlineEdit(null)
  }, [activeEntry, inlineEdit, inlineEditScale])
  const selectedRegionLayout = selectedRegion ? normalizeTextLayoutMode(selectedRegion.textLayoutMode) : 'balloon_fit'
  const selectedRegionAnchorRect = useMemo(() => {
    if (!selectedRegion || !activeArtboard) return null
    const offsetX = activeArtboard.loaded?.offsetX ?? 0
    const offsetY = activeArtboard.loaded?.offsetY ?? 0
    return {
      x: stagePos.x + (activeArtboard.x + offsetX + selectedRegion.bbox.x * activeArtboard.scale) * zoom,
      y: stagePos.y + (activeArtboard.y + offsetY + selectedRegion.bbox.y * activeArtboard.scale) * zoom,
      width: Math.max(40, selectedRegion.bbox.width * activeArtboard.scale * zoom),
      height: Math.max(28, selectedRegion.bbox.height * activeArtboard.scale * zoom),
    }
  }, [activeArtboard, selectedRegion, selectedRegionLayout, stagePos.x, stagePos.y, zoom])
  const transformerAnchors = getTextTransformerAnchors(selectedRegionLayout)
  const transformerKeepRatio = getTextTransformerKeepRatio(selectedRegionLayout)
  const transformerShiftBehavior = getTextTransformerShiftBehavior(selectedRegionLayout)
  const showTextHud = Boolean(
    containerRef.current
    && selectedRegion
    && activeTool === 'select'
    && showTextOverlay
    && !hudHidden,
  )

  const handleTranslateSelectedRegion = useCallback(async () => {
    if (!selectedRegion?.originalText || !activeEntry || hudTranslating) return
    const settings = useAppStore.getState().settings
    const entryId = activeEntry.id
    const regionId = selectedRegion.id
    const originalText = selectedRegion.originalText
    setHudTranslating(true)
    try {
      const translatedText = await translateSingleRegion(
        originalText,
        settings.sourceLang,
        {
          ollamaUrl: settings.ollamaUrl,
          ollamaModel: settings.ollamaModel,
          ollamaApiKey: settings.ollamaApiKey,
          storyContext: {
            enabled: settings.translationContextEnabled,
            translationMode: settings.translationMode,
            styleGuide: settings.translationStyleGuide,
          },
        },
      )
      applyEntryRegionUpdate(entryId, regionId, { translatedText }, { historyKey: `hud:translate:${regionId}` })
      toast.success('แปลใหม่แล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'แปลใหม่ไม่สำเร็จ')
    } finally {
      setHudTranslating(false)
    }
  }, [activeEntry, applyEntryRegionUpdate, hudTranslating, selectedRegion])

  const handleConfirmDeletePage = useCallback(async () => {
    if (!pendingDeleteEntry) return
    setIsDeletingPage(true)
    try {
      if (pendingDeleteEntry.albumPageId) {
        const deleted = await deleteAlbumPage(pendingDeleteEntry.albumPageId)
        if (!deleted) return
      }
      removeImageEntry(pendingDeleteEntry.id)
      setPendingDeleteEntry(null)
    } finally {
      setIsDeletingPage(false)
    }
  }, [deleteAlbumPage, pendingDeleteEntry, removeImageEntry])

  const getReorderIndexFromPoint = useCallback((worldX: number, worldY: number) => {
    const columnWidth = ARTBOARD_FRAME_WIDTH + ARTBOARD_GAP_X
    const column = Math.max(0, Math.min(ARTBOARD_COLUMNS - 1, Math.round((worldX - 40) / columnWidth)))
    const row = Math.max(0, Math.round((worldY - 48) / ARTBOARD_ROW_HEIGHT))
    return Math.max(0, Math.min(entries.length - 1, row * ARTBOARD_COLUMNS + column))
  }, [entries.length])

  const clearReorderPreview = useCallback(() => {
    if (reorderPreviewAnimationFrameRef.current !== null) {
      cancelAnimationFrame(reorderPreviewAnimationFrameRef.current)
      reorderPreviewAnimationFrameRef.current = null
    }
    reorderPreviewPendingRef.current = null
    reorderPreviewRef.current = null
    setReorderPreview(null)
  }, [])

  const pushReorderPreview = useCallback((nextPreview: ReorderPreviewState) => {
    reorderPreviewPendingRef.current = nextPreview
    if (reorderPreviewAnimationFrameRef.current !== null) return
    reorderPreviewAnimationFrameRef.current = requestAnimationFrame(() => {
      reorderPreviewAnimationFrameRef.current = null
      const preview = reorderPreviewPendingRef.current
      if (!preview) return
      reorderPreviewRef.current = preview
      setReorderPreview(preview)
    })
  }, [])

  const startReorderPreview = useCallback((entryId: string, startX: number, startY: number) => {
    const fromIndex = entries.findIndex((entry) => entry.id === entryId)
    if (fromIndex < 0) return
    const nextPreview = {
      entryId,
      sourceIndex: fromIndex,
      targetIndex: fromIndex,
      dragX: startX,
      dragY: startY,
    }
    reorderPreviewPendingRef.current = nextPreview
    reorderPreviewRef.current = nextPreview
    setReorderPreview(nextPreview)
  }, [entries])

  const updateReorderPreview = useCallback((entryId: string, worldX: number, worldY: number) => {
    const targetIndex = getReorderIndexFromPoint(worldX, worldY)
    const currentPreview = reorderPreviewPendingRef.current ?? reorderPreviewRef.current
    if (!currentPreview || currentPreview.entryId !== entryId) return
    if (
      currentPreview.targetIndex === targetIndex
      && Math.round(currentPreview.dragX) === Math.round(worldX)
      && Math.round(currentPreview.dragY) === Math.round(worldY)
    ) return
    pushReorderPreview({
      ...currentPreview,
      targetIndex,
      dragX: worldX,
      dragY: worldY,
    })
  }, [getReorderIndexFromPoint, pushReorderPreview])

  const reorderFromDropPoint = useCallback((entryId: string, worldX: number, worldY: number) => {
    const fromIndex = entries.findIndex((entry) => entry.id === entryId)
    clearReorderPreview()
    if (fromIndex < 0) return
    const toIndex = getReorderIndexFromPoint(worldX, worldY)
    if (toIndex === fromIndex) return

    const orderedEntries = [...entries]
    const [moved] = orderedEntries.splice(fromIndex, 1)
    orderedEntries.splice(toIndex, 0, moved)
    reorderImages(fromIndex, toIndex)
    if (currentAlbum && orderedEntries.every((entry) => entry.albumPageId)) {
      void (async () => {
        await reorderAlbumPages(currentAlbum.id, orderedEntries.map((entry) => entry.albumPageId!))
        await Promise.all(orderedEntries.map((entry, index) => {
          const position = getDefaultArtboardPosition(index)
          return updateAlbumPage(entry.albumPageId!, {
            artboard_x: Math.round(position.x),
            artboard_y: Math.round(position.y),
          })
        }))
      })()
    }
  }, [clearReorderPreview, currentAlbum, entries, getReorderIndexFromPoint, reorderAlbumPages, reorderImages, updateAlbumPage])

  const reorderPreviewSlot = useMemo(() => {
    if (!reorderPreview) return null
    if (reorderPreview.targetIndex < 0 || reorderPreview.targetIndex >= entries.length) return null
    const position = getDefaultArtboardPosition(reorderPreview.targetIndex)
    return {
      ...position,
      index: reorderPreview.targetIndex,
      width: ARTBOARD_FRAME_WIDTH,
      height: ARTBOARD_FRAME_HEIGHT,
    }
  }, [entries.length, reorderPreview])
  const draggedPreviewFrame = useMemo(() => {
    if (!reorderPreview) return null
    const draggedArtboard = artboards.find((artboard) => artboard.entry.id === reorderPreview.entryId)
    if (!draggedArtboard) return null
    return {
      x: reorderPreview.dragX,
      y: reorderPreview.dragY,
      width: draggedArtboard.width,
      height: draggedArtboard.height,
      pageNumber: draggedArtboard.entry.pageNumber ?? reorderPreview.sourceIndex + 1,
    }
  }, [artboards, reorderPreview])

  const showBoardChrome = entries.length > 1

  return (
    <div className="studio-canvas flex h-full flex-col">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <ContextualTextHud
          portalRoot={containerRef.current}
          region={selectedRegion}
          anchorRect={selectedRegionAnchorRect}
          visible={showTextHud}
          preferredPlacement={inlineEdit?.id === selectedRegion?.id ? 'bottom' : 'top'}
          isTranslating={hudTranslating}
          previewingOriginal={previewOriginalRegionId === selectedRegion?.id}
          onUpdate={(updates, options) => {
            if (!selectedRegion || !activeEntry) return
            applyEntryRegionUpdate(activeEntry.id, selectedRegion.id, updates, options)
          }}
          onDelete={() => {
            if (!selectedRegion) return
            deleteRegion(selectedRegion.id)
          }}
          onTranslate={handleTranslateSelectedRegion}
          onStartInlineEdit={() => {
            if (selectedRegion) startInlineEdit(selectedRegion)
          }}
          onPreviewOriginalStart={() => {
            if (selectedRegion?.originalText) setPreviewOriginalRegionId(selectedRegion.id)
          }}
          onPreviewOriginalEnd={() => setPreviewOriginalRegionId(null)}
        />
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={zoom}
          scaleY={zoom}
          draggable={isPanning}
          onWheel={handleWheel}
          onClick={(event) => {
            handleStageClick(event)
            handleEyedrop()
          }}
          onMouseDown={handlePaintStart}
          onMouseMove={(event) => {
            handlePaintMove()
            handleEyedropMove(event)
          }}
          onMouseUp={handlePaintEnd}
          onMouseLeave={() => {
            handlePaintEnd()
            setEyedropPreview(null)
          }}
          onDragEnd={(event) => {
            if (!shouldSyncStagePositionOnDragEnd(event.target)) return
            setStagePos({ x: event.target.x(), y: event.target.y() })
          }}
          style={{ cursor: getEditorToolCursor(activeTool) }}
        >
          <Layer listening={false}>
            {draggedPreviewFrame && (
              <>
                <Rect
                  x={draggedPreviewFrame.x - 14}
                  y={draggedPreviewFrame.y - 14}
                  width={draggedPreviewFrame.width + 28}
                  height={draggedPreviewFrame.height + 28}
                  cornerRadius={20}
                  fill="rgba(245,158,11,0.06)"
                  stroke="rgba(251,191,36,0.88)"
                  strokeWidth={2}
                  dash={[12, 7]}
                />
                <Text
                  x={draggedPreviewFrame.x}
                  y={draggedPreviewFrame.y - 34}
                  width={draggedPreviewFrame.width}
                  align="center"
                  text={`กำลังลาก หน้า ${draggedPreviewFrame.pageNumber}`}
                  fontSize={11}
                  fontStyle="bold"
                  fill="#fcd34d"
                />
              </>
            )}
            {reorderPreviewSlot && reorderPreview && reorderPreview.targetIndex !== reorderPreview.sourceIndex && (
              <>
                <Rect
                  x={reorderPreviewSlot.x - 12}
                  y={reorderPreviewSlot.y - 12}
                  width={reorderPreviewSlot.width + 24}
                  height={reorderPreviewSlot.height + 24}
                  cornerRadius={18}
                  fill="rgba(79,124,255,0.08)"
                  stroke="rgba(79,124,255,0.72)"
                  strokeWidth={2}
                  dash={[10, 6]}
                />
                <Text
                  x={reorderPreviewSlot.x}
                  y={reorderPreviewSlot.y + reorderPreviewSlot.height + 14}
                  width={reorderPreviewSlot.width}
                  align="center"
                  text={`แทนที่หน้า ${reorderPreviewSlot.index + 1}`}
                  fontSize={11}
                  fontStyle="bold"
                  fill="#8fb0ff"
                />
              </>
            )}
          </Layer>
          <Layer>
            {renderedArtboards.map((artboard) => (
              <ArtboardBase
                key={artboard.entry.id}
                artboard={artboard}
                isActive={artboard.entry.id === activeImageId}
                activeTool={activeTool}
                showBoardChrome={showBoardChrome}
                onActivate={() => {
                  if (artboard.entry.id !== activeImageId) switchImage(artboard.entry.id)
                }}
                onSelectRegion={selectRegion}
                isBeingDragged={reorderPreview?.entryId === artboard.entry.id}
                onReorderStart={(x, y) => startReorderPreview(artboard.entry.id, x, y)}
                onReorderPreview={(x, y) => updateReorderPreview(artboard.entry.id, x, y)}
                onReorderDrop={(x, y) => reorderFromDropPoint(artboard.entry.id, x, y)}
                onRequestDelete={() => setPendingDeleteEntry(artboard.entry)}
              />
            ))}
          </Layer>
          <Layer>
            {renderedArtboards.map((artboard) => (
              <ArtboardBrushOverlay
                key={`${artboard.entry.id}-brush`}
                artboard={artboard}
                drawingLine={artboard.entry.id === activeImageId ? drawingLine : null}
                activeTool={activeTool}
                isActive={artboard.entry.id === activeImageId}
                brushPreview={{
                  color: activeTool === 'eraser' ? '#ff000080' : brushColor,
                  size: brushSize,
                  opacity: activeTool === 'eraser' ? 0.5 : brushOpacity,
                  shadowBlur: brushShadowBlur,
                }}
              />
            ))}
          </Layer>
          <Layer>
            {renderedArtboards.map((artboard) => (
              <ArtboardTextOverlay
                key={`${artboard.entry.id}-text`}
                artboard={artboard}
                viewportZoom={zoom}
                isActive={artboard.entry.id === activeImageId}
                showTextOverlay={showTextOverlay}
                activeTool={activeTool}
                onActivate={() => {
                  if (artboard.entry.id !== activeImageId) switchImage(artboard.entry.id)
                }}
                onSelectRegion={selectRegion}
                onRegionUpdate={(regionId, updates, options) => applyEntryRegionUpdate(artboard.entry.id, regionId, updates, options)}
                previewOriginalRegionId={previewOriginalRegionId}
                onRegionInteractionStart={() => setHudHidden(true)}
                onRegionInteractionEnd={() => setHudHidden(false)}
                onStartInlineEdit={startInlineEdit}
              />
            ))}
            <Transformer
              ref={transformerRef}
              borderStroke="#6366f1"
              anchorStroke="#6366f1"
              anchorFill="#ffffff"
              anchorSize={8}
              anchorCornerRadius={4}
              padding={4}
              rotateEnabled
              keepRatio={transformerKeepRatio}
              shiftBehavior={transformerShiftBehavior}
              enabledAnchors={transformerAnchors}
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 16) return oldBox
                return newBox
              }}
            />
            {inlineEdit && inlineEditRegion && inlineEditPosition && inlineEditSize && inlineEditFont && (
              <Html
                groupProps={{
                  x: inlineEditPosition.x,
                  y: inlineEditPosition.y,
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
            {activeProcessCard && activeArtboard && (
              <ArtboardProcessCardOverlay
                artboard={activeArtboard}
                card={activeProcessCard}
              />
            )}
          </Layer>
        </Stage>
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
        <Modal
          isOpen={pendingDeleteEntry !== null}
          onClose={() => {
            if (!isDeletingPage) setPendingDeleteEntry(null)
          }}
          title="ลบหน้านี้?"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--mg-muted)]">
              {pendingDeleteEntry?.albumPageId
                ? `หน้า ${pendingDeleteEntry.pageNumber ?? '?'} จะถูกลบออกจากอัลบั้มและ canvas ถาวร`
                : `หน้า ${pendingDeleteEntry?.pageNumber ?? '?'} จะถูกลบออกจาก canvas นี้`}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeletingPage}
                onClick={() => setPendingDeleteEntry(null)}
              >
                ยกเลิก
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeletingPage}
                onClick={handleConfirmDeletePage}
              >
                {isDeletingPage ? 'กำลังลบ...' : 'ลบหน้า'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}

interface ArtboardRenderProps {
  artboard: {
    entry: ImageEntry
    x: number
    y: number
    targetX?: number
    targetY?: number
    scale: number
    width: number
    height: number
    loaded?: LoadedImage
  }
}

interface ArtboardBaseProps extends ArtboardRenderProps {
  isActive: boolean
  activeTool: string
  showBoardChrome: boolean
  isBeingDragged: boolean
  onActivate: () => void
  onSelectRegion: (id: string | null) => void
  onReorderStart: (x: number, y: number) => void
  onReorderPreview: (x: number, y: number) => void
  onReorderDrop: (x: number, y: number) => void
  onRequestDelete: () => void
}

const ArtboardBase = memo(function ArtboardBase({
  artboard,
  isActive,
  activeTool,
  showBoardChrome,
  isBeingDragged,
  onActivate,
  onSelectRegion,
  onReorderStart,
  onReorderPreview,
  onReorderDrop,
  onRequestDelete,
}: ArtboardBaseProps) {
  const { entry, loaded } = artboard
  const isBrushActive = activeTool === 'brush' || activeTool === 'eraser'
  const canReorderArtboard = showBoardChrome && activeTool === 'select'
  const surface = getArtboardSurfaceMetrics(artboard)
  const reorderHandlePosition = { x: surface.surfaceX - 30, y: surface.surfaceY - ARTBOARD_HEADER_HEIGHT + 4 }
  const deleteHandleX = surface.surfaceX + surface.surfaceWidth + 4
  const titleY = surface.surfaceY - ARTBOARD_HEADER_HEIGHT + 8
  const statusX = surface.surfaceX + Math.max(0, surface.surfaceWidth - 92)
  const getDroppedPosition = (offsetX: number, offsetY: number) => ({
    x: (artboard.targetX ?? artboard.x) + offsetX,
    y: (artboard.targetY ?? artboard.y) + offsetY,
  })

  return (
    <Group
      x={artboard.x}
      y={artboard.y}
      onClick={() => {
        onActivate()
        if (activeTool === 'select') onSelectRegion(null)
      }}
    >
      <Text
        x={surface.surfaceX}
        y={titleY}
        text={`หน้า ${entry.pageNumber ?? '?'}`}
        fontSize={12}
        fontStyle="bold"
        fill={isActive ? '#dbeafe' : '#f4f4f5'}
      />
      <Text
        x={statusX}
        y={titleY + 1}
        width={82}
        align="right"
        text={statusLabel[entry.status]}
        fontSize={10}
        fill={entry.status === 'error' ? '#ff8a8a' : entry.status === 'done' ? '#7ee787' : '#a1a1aa'}
      />
      {showBoardChrome && (
        <>
          <Group
            x={reorderHandlePosition.x}
            y={reorderHandlePosition.y}
            draggable={canReorderArtboard}
            onClick={(event) => {
              event.cancelBubble = true
              onActivate()
            }}
            onTap={(event) => {
              event.cancelBubble = true
              onActivate()
            }}
            onDragStart={(event) => {
              event.cancelBubble = true
              onActivate()
              onReorderStart(artboard.targetX ?? artboard.x, artboard.targetY ?? artboard.y)
            }}
            onDragMove={(event) => {
              event.cancelBubble = true
              const node = event.target
              const droppedPosition = getDroppedPosition(
                node.x() - reorderHandlePosition.x,
                node.y() - reorderHandlePosition.y,
              )
              onReorderPreview(droppedPosition.x, droppedPosition.y)
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true
              const node = event.target
              const droppedPosition = getDroppedPosition(
                node.x() - reorderHandlePosition.x,
                node.y() - reorderHandlePosition.y,
              )
              onReorderDrop(
                droppedPosition.x,
                droppedPosition.y,
              )
              node.position(reorderHandlePosition)
              node.getLayer()?.batchDraw()
            }}
          >
            <Rect
              width={22}
              height={24}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={1}
              cornerRadius={5}
              opacity={canReorderArtboard ? 1 : 0.35}
            />
            <Text
              x={0}
              y={5}
              width={22}
              text="⋮⋮"
              align="center"
              fontSize={11}
              fontStyle="bold"
              fill="#a1a1aa"
              listening={false}
            />
          </Group>
          <Group
            x={deleteHandleX}
            y={surface.surfaceY - ARTBOARD_HEADER_HEIGHT + 2}
            onClick={(event) => {
              event.cancelBubble = true
              onRequestDelete()
            }}
            onTap={(event) => {
              event.cancelBubble = true
              onRequestDelete()
            }}
          >
            <Rect
              width={24}
              height={24}
              fill="#000000"
              opacity={0}
            />
            <Text
              x={0}
              y={-1}
              width={24}
              height={24}
              text="×"
              align="center"
              verticalAlign="middle"
              fontSize={22}
              fontStyle="bold"
              fill="#ff4d4f"
              listening={false}
            />
          </Group>
        </>
      )}
      {isActive && (
        <Rect
          x={surface.surfaceX}
          y={surface.surfaceY - 7}
          width={Math.min(72, surface.surfaceWidth)}
          height={2}
          fill="#4f7cff"
          cornerRadius={1}
        />
      )}
      {loaded ? (
        <KonvaImage
          image={loaded.image}
          x={loaded.offsetX}
          y={loaded.offsetY}
          width={loaded.width}
          height={loaded.height}
          onClick={onActivate}
          listening={!isBrushActive}
          opacity={isBeingDragged ? 0.3 : 1}
        />
      ) : (
        <Rect width={artboard.width} height={artboard.height} fill="#151515" opacity={isBeingDragged ? 0.3 : 1} />
      )}
    </Group>
  )
})

function ArtboardProcessCardOverlay({
  artboard,
  card,
}: ArtboardRenderProps & { card: ArtboardProcessCard }) {
  const surface = getArtboardSurfaceMetrics(artboard)
  const cardWidth = card.type === 'error' ? 300 : 280
  const cardX = surface.surfaceX + surface.surfaceWidth / 2
  const cardY = surface.surfaceY
  const progress = Math.max(0, Math.min(100, card.progress ?? 0))
  const stopKonvaEvent = (event: Konva.KonvaEventObject<Event>) => {
    event.cancelBubble = true
  }
  const stopDomEvent = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
  }

  return (
    <Group x={artboard.x} y={artboard.y}>
      <Rect
        x={surface.surfaceX}
        y={surface.surfaceY}
        width={surface.surfaceWidth}
        height={surface.surfaceHeight}
        fill={card.type === 'error' ? 'rgba(69, 10, 10, 0.34)' : 'rgba(0, 0, 0, 0.42)'}
        cornerRadius={8}
        onMouseDown={stopKonvaEvent}
        onMouseMove={stopKonvaEvent}
        onMouseUp={stopKonvaEvent}
        onClick={stopKonvaEvent}
        onTap={stopKonvaEvent}
      />
      <Html
        groupProps={{ x: cardX, y: cardY }}
        transform
        transformFunc={(attrs) => ({
          ...attrs,
          scaleX: 1,
          scaleY: 1,
        })}
      >
        <div
          className={[
            'pointer-events-auto rounded-[8px] border px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-md',
            card.type === 'error'
              ? 'border-red-400/35 bg-red-950/80'
              : 'border-white/12 bg-black/82',
          ].join(' ')}
          style={{ width: cardWidth, transform: 'translate(-50%, calc(-100% - 12px))' }}
          onMouseDown={stopDomEvent}
          onClick={stopDomEvent}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--mg-text)]">{card.label}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--mg-muted)]">{card.message}</p>
            </div>
            {card.type === 'running' && (
              <div className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[var(--mg-accent)]" />
            )}
          </div>

          {card.type === 'running' && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--mg-accent)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {(card.actionLabel || card.secondaryActionLabel) && (
            <div className="mt-3 flex justify-end gap-2">
              {card.secondaryActionLabel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={card.onSecondaryAction}
                >
                  {card.secondaryActionLabel}
                </Button>
              )}
              {card.actionLabel && (
                <Button
                  variant={card.type === 'error' ? 'primary' : 'danger'}
                  size="sm"
                  onClick={card.onAction}
                >
                  {card.actionLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </Html>
    </Group>
  )
}

interface ArtboardBrushOverlayProps extends ArtboardRenderProps {
  drawingLine: number[] | null
  activeTool: string
  isActive: boolean
  brushPreview: { color: string; size: number; opacity: number; shadowBlur: number }
}

const ArtboardBrushOverlay = memo(function ArtboardBrushOverlay({
  artboard,
  drawingLine,
  activeTool,
  brushPreview,
}: ArtboardBrushOverlayProps) {
  const { entry, loaded, scale } = artboard
  if (!loaded || entry.imageLoaded === false) return null

  return (
    <Group x={artboard.x} y={artboard.y}>
      {entry.brushStrokes.map((stroke) => {
        const feather = computeBrushFeather(stroke.width, stroke.shadowBlur)
        return (
          <Line
            key={stroke.id}
            points={stroke.points.map((point, index) =>
              point * scale + (index % 2 === 0 ? loaded.offsetX : loaded.offsetY),
            )}
            stroke={stroke.color}
            strokeWidth={feather.strokeWidth * scale}
            opacity={stroke.opacity}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            shadowBlur={feather.shadowBlur * scale}
            shadowColor={stroke.tool === 'eraser' ? undefined : stroke.color}
            globalCompositeOperation={stroke.tool === 'eraser' ? 'destination-out' : 'source-over'}
          />
        )
      })}
      {drawingLine && drawingLine.length >= 2 && (
        <Line
          points={drawingLine.map((point, index) =>
            point * scale + (index % 2 === 0 ? loaded.offsetX : loaded.offsetY),
          )}
          stroke={brushPreview.color}
          strokeWidth={computeBrushFeather(brushPreview.size, brushPreview.shadowBlur).strokeWidth * scale}
          opacity={brushPreview.opacity}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          dash={activeTool === 'eraser' ? [5, 5] : undefined}
        />
      )}
    </Group>
  )
})

interface ArtboardTextOverlayProps extends ArtboardRenderProps {
  viewportZoom: number
  isActive: boolean
  showTextOverlay: boolean
  activeTool: ActiveTool
  onActivate: () => void
  onSelectRegion: (id: string | null) => void
  onRegionUpdate: (
    id: string,
    updates: Partial<TextRegion>,
    options?: RegionUpdateOptions,
  ) => void
  previewOriginalRegionId: string | null
  onRegionInteractionStart: () => void
  onRegionInteractionEnd: () => void
  onStartInlineEdit: (region: TextRegion) => void
}

const ArtboardTextOverlay = memo(function ArtboardTextOverlay({
  artboard,
  viewportZoom,
  isActive,
  showTextOverlay,
  activeTool,
  onActivate,
  onSelectRegion,
  onRegionUpdate,
  previewOriginalRegionId,
  onRegionInteractionStart,
  onRegionInteractionEnd,
  onStartInlineEdit,
}: ArtboardTextOverlayProps) {
  const { entry, loaded, scale } = artboard
  const canRenderTextOverlay = showTextOverlay && entry.imageLoaded !== false && Boolean(loaded)
  if (!canRenderTextOverlay || !loaded) return null

  return (
    <Group x={artboard.x} y={artboard.y}>
      {entry.regions.map((region) => (
        <ArtboardText
          key={`${entry.id}-${region.id}`}
          region={region}
          allRegions={entry.regions}
          scale={scale}
          viewportZoom={viewportZoom}
          offsetX={loaded.offsetX}
          offsetY={loaded.offsetY}
          isActiveArtboard={isActive}
          activeTool={activeTool}
          onSelect={() => {
            onActivate()
            onSelectRegion(region.id)
          }}
          onUpdate={(updates, options) => onRegionUpdate(region.id, updates, options)}
          onLiveResize={(updates) => onRegionUpdate(region.id, updates, { trackHistory: false })}
          previewOriginal={previewOriginalRegionId === region.id}
          onInteractionStart={onRegionInteractionStart}
          onInteractionEnd={onRegionInteractionEnd}
          onStartInlineEdit={() => onStartInlineEdit(region)}
        />
      ))}
    </Group>
  )
})

function ArtboardText({
  region,
  allRegions,
  scale,
  viewportZoom,
  offsetX,
  offsetY,
  isActiveArtboard,
  activeTool,
  onSelect,
  onUpdate,
  onLiveResize,
  previewOriginal,
  onInteractionStart,
  onInteractionEnd,
  onStartInlineEdit,
}: {
  region: TextRegion
  allRegions: TextRegion[]
  scale: number
  viewportZoom: number
  offsetX: number
  offsetY: number
  isActiveArtboard: boolean
  activeTool: ActiveTool
  onSelect: () => void
  onUpdate: (updates: Partial<TextRegion>, options?: RegionUpdateOptions) => void
  onLiveResize: (updates: Partial<TextRegion>) => void
  previewOriginal: boolean
  onInteractionStart: () => void
  onInteractionEnd: () => void
  onStartInlineEdit: () => void
}) {
  const font = resolveRegionFont(region)
  const selectedRegionId = useAppStore((s) => s.selectedRegionId)
  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
  const isArtistic = layoutMode === 'artistic'
  const text = (previewOriginal ? region.originalText : region.translatedText) || ' '
  const regionLayout = getRegionTextLayout(region, text, {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.style,
  })
  const isArtisticFree = isArtistic && regionLayout.artisticFit === 'free'
  const fontSize = regionLayout.fontSize * scale
  const transformStartRegionsRef = useRef<TextRegion[] | null>(null)
  const canEditText = isActiveArtboard && activeTool === 'select'

  const applyLiveTextBoxResize = (node: Konva.Text) => {
    const nextWidth = Math.max(20 * scale, node.width() * Math.abs(node.scaleX()))
    const nextHeight = Math.max(16 * scale, node.height() * Math.abs(node.scaleY()))
    node.scaleX(1)
    node.scaleY(1)
    node.width(nextWidth)
    node.height(nextHeight)
    node.getLayer()?.batchDraw()
    return { width: nextWidth, height: nextHeight }
  }

  return (
    <>
      <Text
        id={isActiveArtboard ? region.id : `${region.id}-readonly`}
        x={offsetX + region.bbox.x * scale}
        y={offsetY + region.bbox.y * scale}
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
        draggable={canEditText}
        rotation={region.rotation}
        opacity={1}
        listening={canEditText}
        onClick={(event) => {
          event.cancelBubble = true
          onSelect()
        }}
        onDblClick={(event) => {
          event.cancelBubble = true
          onStartInlineEdit()
        }}
        onDblTap={(event) => {
          event.cancelBubble = true
          onStartInlineEdit()
        }}
        onTap={(event) => {
          event.cancelBubble = true
          onSelect()
        }}
        onDragStart={(event) => {
          event.cancelBubble = true
          onInteractionStart()
          onSelect()
        }}
        onDragMove={(event) => {
          event.cancelBubble = true
        }}
        onDragEnd={(event) => {
          event.cancelBubble = true
          onInteractionEnd()
          const node = event.target
          onUpdate({
            bbox: {
              ...region.bbox,
              x: (node.x() - offsetX) / scale,
              y: (node.y() - offsetY) / scale,
            },
          })
        }}
        onTransformEnd={(event) => {
          event.cancelBubble = true
          onInteractionEnd()
          const node = event.target as Konva.Text
          const historyBefore = transformStartRegionsRef.current ?? undefined
          transformStartRegionsRef.current = null
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
              text,
              {
                fontFamily: font.family,
                fontWeight: font.weight,
                fontStyle: font.style,
              },
            )
            node.width(nextLayout.innerWidth * scale)
            node.height(nextLayout.contentHeight * scale)
            node.getLayer()?.batchDraw()
            onUpdate({
              bbox: {
                x: (node.x() - offsetX) / scale,
                y: (node.y() - offsetY) / scale,
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
            x: (node.x() - offsetX) / scale,
            y: (node.y() - offsetY) / scale,
            width: resized.width / scale,
            height: resized.height / scale,
          }
          const fitted = !isArtistic
            ? getRegionTextLayout({ ...region, bbox: nextBbox }, text, {
                fontFamily: font.family,
                fontWeight: font.weight,
                fontStyle: font.style,
              })
            : null
          onUpdate({
            bbox: nextBbox,
            ...(fitted ? { fontSize: fitted.fontSize } : {}),
            rotation: node.rotation(),
            textScaleX: 1,
            textScaleY: 1,
          }, historyOptions)
        }}
        onTransformStart={() => {
          onInteractionStart()
          transformStartRegionsRef.current = cloneRegions(allRegions)
        }}
        onTransform={(event) => {
          event.cancelBubble = true
          const node = event.target as Konva.Text
          if (isArtisticFree) {
            node.getLayer()?.batchDraw()
            return
          }
          const resized = applyLiveTextBoxResize(node)
          onLiveResize({
            bbox: {
              x: (node.x() - offsetX) / scale,
              y: (node.y() - offsetY) / scale,
              width: resized.width / scale,
              height: resized.height / scale,
            },
            textScaleX: 1,
            textScaleY: 1,
          })
        }}
      />
      {regionLayout.overflow && (
        <OversetTextBadge
          x={offsetX + (region.bbox.x + region.bbox.width) * scale}
          y={offsetY + (region.bbox.y + region.bbox.height) * scale}
          viewportZoom={viewportZoom}
          showLabel={selectedRegionId === region.id}
          labelText={regionLayout.overflowReason === 'readability' ? 'ตัวเล็ก/ล้น' : 'ข้อความยังล้น'}
        />
      )}
    </>
  )
}

function cloneRegions(regions: TextRegion[]): TextRegion[] {
  return regions.map((region) => ({
    ...region,
    bbox: { ...region.bbox },
  }))
}
