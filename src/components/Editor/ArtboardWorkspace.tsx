import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { Html } from 'react-konva-utils'
import Konva from 'konva'
import { Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { ImageEntry, TextRegion } from '../../types'
import {
  ARTBOARD_COLUMNS,
  ARTBOARD_GAP_X,
  ARTBOARD_HEADER_HEIGHT,
  ARTBOARD_MAX_PREVIEW_WIDTH,
  ARTBOARD_ROW_HEIGHT,
  getDefaultArtboardPosition,
  useAppStore,
} from '../../store/appStore'
import { useAlbumStore } from '../../store/albumStore'
import { resolveFont } from '../../config/fonts'
import { calculateBalloonFitFontSize, normalizeTextLayoutMode } from '../../utils/textLayout'
import {
  getInlineTextEditorBboxSize,
  getInlineTextEditorLayerSize,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import type { CanvasEditorHandle } from './CanvasEditor'
import InlineTextEditor from './InlineTextEditor'
import { Button, Modal } from '../ui/primitives'

interface ArtboardWorkspaceProps {
  entries: ImageEntry[]
  stageRef?: React.RefObject<Konva.Stage | null>
  editorRef?: React.RefObject<CanvasEditorHandle | null>
  onViewportChange?: (state: { zoom: number; imageWidth: number; imageHeight: number }) => void
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

const statusLabel: Record<ImageEntry['status'], string> = {
  pending: 'รอทำงาน',
  clean_queued: 'รอคลีน',
  cleaning: 'กำลังคลีน',
  clean_done: 'คลีนแล้ว',
  translate_queued: 'รอแปล',
  translating: 'กำลังแปล',
  processing: 'กำลังทำงาน',
  done: 'เสร็จแล้ว',
  error: 'ผิดพลาด',
}

const ARTBOARD_FRAME_WIDTH = ARTBOARD_MAX_PREVIEW_WIDTH
const ARTBOARD_FRAME_HEIGHT = Math.round(ARTBOARD_MAX_PREVIEW_WIDTH * 1.42)
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

export default function ArtboardWorkspace({
  entries,
  stageRef: externalStageRef,
  editorRef,
  onViewportChange,
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
  const updateImageEntry = useAppStore((s) => s.updateImageEntry)
  const removeImageEntry = useAppStore((s) => s.removeImageEntry)
  const reorderImages = useAppStore((s) => s.reorderImages)
  const resetArtboardLayout = useAppStore((s) => s.resetArtboardLayout)
  const updateAlbumPage = useAlbumStore((s) => s.updatePage)
  const deleteAlbumPage = useAlbumStore((s) => s.deletePage)
  const reorderAlbumPages = useAlbumStore((s) => s.reorderPages)
  const currentAlbum = useAlbumStore((s) => s.currentAlbum)
  const setActiveTool = useAppStore((s) => s.setActiveTool)
  const selectedRegionId = useAppStore((s) => s.selectedRegionId)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const updateRegion = useAppStore((s) => s.updateRegion)
  const addBrushStroke = useAppStore((s) => s.addBrushStroke)
  const brushColor = useAppStore((s) => s.brushColor)
  const brushSize = useAppStore((s) => s.brushSize)
  const brushOpacity = useAppStore((s) => s.brushOpacity)
  const brushShadowBlur = useAppStore((s) => s.brushShadowBlur)
  const showTextOverlay = useAppStore((s) => s.showTextOverlay)

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('100')
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [loadedImages, setLoadedImages] = useState<Record<string, LoadedImage>>({})
  const [drawingLine, setDrawingLine] = useState<number[] | null>(null)
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<ImageEntry | null>(null)
  const [isDeletingPage, setIsDeletingPage] = useState(false)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; text: string } | null>(null)

  const activeEntry = entries.find((entry) => entry.id === activeImageId) ?? entries[0]
  const isPanning = activeTool === 'pan'
  const isBrushActive = activeTool === 'brush' || activeTool === 'eraser'

  useImperativeHandle(editorRef, () => ({
    deselectAll: () => {
      selectRegion(null)
      transformerRef.current?.nodes([])
      transformerRef.current?.getLayer()?.batchDraw()
    },
  }), [selectRegion])

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
    const activeImage = activeEntry ? loadedImages[activeEntry.id] : null
    onViewportChange?.({
      zoom,
      imageWidth: activeImage?.image.naturalWidth ?? 0,
      imageHeight: activeImage?.image.naturalHeight ?? 0,
    })
  }, [activeEntry, loadedImages, onViewportChange, zoom])

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
      x: fallback.x,
      y: fallback.y,
      scale: loaded?.scale ?? 0.25,
      width: ARTBOARD_FRAME_WIDTH,
      height: ARTBOARD_FRAME_HEIGHT,
      loaded,
    }
  }), [entries, loadedImages])

  const activeArtboard = artboards.find((artboard) => artboard.entry.id === activeImageId)

  const applyZoom = useCallback((nextZoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    setZoom(clamped)
    setZoomInput(Math.round(clamped * 100).toString())
  }, [])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer) return
    const oldZoom = zoom
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, e.evt.deltaY > 0 ? oldZoom * 0.9 : oldZoom * 1.1))
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
  }, [stageRef, stagePos, zoom])

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

  const handlePaintStart = useCallback(() => {
    if (!isBrushActive || !activeEntry) return
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

  const commitZoomInput = () => {
    const value = Number.parseInt(zoomInput, 10)
    if (Number.isFinite(value)) applyZoom(value / 100)
    else setZoomInput(Math.round(zoom * 100).toString())
  }

  const resetView = () => {
    setZoom(1)
    setZoomInput('100')
    setStagePos({ x: 0, y: 0 })
  }

  const resetLayout = () => {
    resetArtboardLayout()
    entries.forEach((entry, index) => {
      if (!entry.albumPageId) return
      const position = getDefaultArtboardPosition(index)
      void updateAlbumPage(entry.albumPageId, {
        artboard_x: Math.round(position.x),
        artboard_y: Math.round(position.y),
      })
    })
  }

  const updateEntryRegion = (entry: ImageEntry, regionId: string, updates: Partial<TextRegion>) => {
    if (entry.id === activeImageId) {
      updateRegion(regionId, updates)
      return
    }
    updateImageEntry(entry.id, {
      regions: entry.regions.map((region) =>
        region.id === regionId ? { ...region, ...updates } : region,
      ),
    })
  }

  const selectedRegion = activeEntry?.regions.find((region) => region.id === selectedRegionId) ?? null
  const inlineEditRegion = inlineEdit ? activeEntry?.regions.find((region) => region.id === inlineEdit.id) ?? null : null
  const inlineEditLayoutMode = normalizeTextLayoutMode(inlineEditRegion?.textLayoutMode)
  const inlineEditFont = inlineEditRegion ? resolveFont(inlineEditRegion.suggestedFont, inlineEditRegion.mood) : null
  const inlineEditScale = activeArtboard?.scale ?? 1
  const inlineEditFontSize = inlineEditRegion
    ? (
        inlineEditLayoutMode === 'artistic'
          ? Math.max(8, inlineEditRegion.fontSize * inlineEditScale)
          : calculateBalloonFitFontSize(inlineEdit?.text ?? '', inlineEditRegion.bbox, inlineEditRegion.fontSize) * inlineEditScale
      )
    : 14
  const inlineEditSize = inlineEditRegion
    ? getInlineTextEditorLayerSize({
        bbox: inlineEditRegion.bbox,
        scale: inlineEditScale,
        minWidth: 96 / zoom,
        minHeight: 44 / zoom,
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
      setInlineEdit({ id: region.id, text: region.translatedText })
    },
    [isBrushActive, selectRegion],
  )
  const commitInlineEdit = useCallback((metrics?: InlineTextEditorCommitMetrics) => {
    if (!inlineEdit || !activeEntry) return
    const region = activeEntry.regions.find((item) => item.id === inlineEdit.id)
    const bboxSize = metrics
      ? getInlineTextEditorBboxSize({ metrics, scale: inlineEditScale })
      : null
    updateEntryRegion(activeEntry, inlineEdit.id, {
      translatedText: inlineEdit.text,
      ...(region && bboxSize ? { bbox: { ...region.bbox, ...bboxSize } } : {}),
    })
    setInlineEdit(null)
  }, [activeEntry, inlineEdit, inlineEditScale])
  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null)
  }, [])
  const selectedRegionLayout = selectedRegion ? normalizeTextLayoutMode(selectedRegion.textLayoutMode) : 'balloon_fit'
  const transformerAnchors = selectedRegionLayout === 'artistic'
    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    : ['middle-left', 'middle-right', 'top-center', 'bottom-center']

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

  const reorderFromDropPoint = useCallback((entryId: string, worldX: number, worldY: number) => {
    const fromIndex = entries.findIndex((entry) => entry.id === entryId)
    if (fromIndex < 0) return
    const columnWidth = ARTBOARD_FRAME_WIDTH + ARTBOARD_GAP_X
    const column = Math.max(0, Math.min(ARTBOARD_COLUMNS - 1, Math.round((worldX - 40) / columnWidth)))
    const row = Math.max(0, Math.round((worldY - 48) / ARTBOARD_ROW_HEIGHT))
    const toIndex = Math.max(0, Math.min(entries.length - 1, row * ARTBOARD_COLUMNS + column))
    if (toIndex === fromIndex) return

    const orderedEntries = [...entries]
    const [moved] = orderedEntries.splice(fromIndex, 1)
    orderedEntries.splice(toIndex, 0, moved)
    reorderImages(fromIndex, toIndex)
    if (currentAlbum && orderedEntries.every((entry) => entry.albumPageId)) {
      void reorderAlbumPages(currentAlbum.id, orderedEntries.map((entry) => entry.albumPageId!))
    }
  }, [currentAlbum, entries, reorderAlbumPages, reorderImages])

  return (
    <div className="flex h-full flex-col bg-[var(--mg-bg)]">
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex items-center gap-1 rounded-[8px] border border-[var(--mg-border)] bg-black/50 p-1 backdrop-blur">
        <button className="mg-icon-button h-7 w-7" onClick={() => applyZoom(zoom - 0.1)} aria-label="Zoom out">
          <ZoomOut size={14} />
        </button>
        <input
          className="h-7 w-12 rounded-[6px] border border-[var(--mg-border)] bg-black/40 text-center text-xs text-[var(--mg-text)]"
          value={zoomInput}
          onChange={(event) => setZoomInput(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
          onBlur={commitZoomInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitZoomInput()
          }}
          aria-label="Zoom percent"
        />
        <button className="mg-icon-button h-7 w-7" onClick={() => applyZoom(zoom + 0.1)} aria-label="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button
          className={`mg-icon-button h-7 w-7 ${isPanning ? 'mg-tool-active' : ''}`}
          onClick={() => setActiveTool(isPanning ? 'select' : 'pan')}
          aria-label="Pan mode"
        >
          <Hand size={14} />
        </button>
        <button className="mg-icon-button h-7 w-7" onClick={resetView} aria-label="Reset view">
          <RotateCcw size={14} />
        </button>
        <button className="mg-button mg-button-ghost mg-button-sm" onClick={resetLayout}>
          Reset layout
        </button>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
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
          onMouseDown={handlePaintStart}
          onMouseMove={handlePaintMove}
          onMouseUp={handlePaintEnd}
          onMouseLeave={handlePaintEnd}
          onDragEnd={(event) => {
            if (event.target === event.target.getStage()) {
              setStagePos({ x: event.target.x(), y: event.target.y() })
            }
          }}
          style={{ cursor: isPanning ? 'grab' : isBrushActive ? 'crosshair' : 'default' }}
        >
          <Layer>
            {artboards.map((artboard) => (
              <ArtboardNode
                key={artboard.entry.id}
                artboard={artboard}
                isActive={artboard.entry.id === activeImageId}
                showTextOverlay={showTextOverlay}
                drawingLine={artboard.entry.id === activeImageId ? drawingLine : null}
                activeTool={activeTool}
                selectedRegionId={selectedRegionId}
                onActivate={() => {
                  if (artboard.entry.id !== activeImageId) switchImage(artboard.entry.id)
                }}
                onSelectRegion={selectRegion}
                onReorderDrop={(x, y) => reorderFromDropPoint(artboard.entry.id, x, y)}
                onRequestDelete={() => setPendingDeleteEntry(artboard.entry)}
                onRegionUpdate={(regionId, updates) => updateEntryRegion(artboard.entry, regionId, updates)}
                editingRegionId={inlineEdit?.id ?? null}
                onStartInlineEdit={startInlineEdit}
                brushPreview={{
                  color: activeTool === 'eraser' ? '#ff000080' : brushColor,
                  size: brushSize,
                  opacity: activeTool === 'eraser' ? 0.5 : brushOpacity,
                  shadowBlur: brushShadowBlur,
                }}
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
              keepRatio={false}
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
                  fontFamily={inlineEditFont.family}
                  fontWeight={inlineEditFont.weight}
                  fontStyle={inlineEditFont.style}
                  fontSize={inlineEditFontSize}
                  padding={inlineEditLayoutMode === 'artistic' ? 0 : 8 * inlineEditScale}
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

interface ArtboardNodeProps {
  artboard: {
    entry: ImageEntry
    x: number
    y: number
    scale: number
    width: number
    height: number
    loaded?: LoadedImage
  }
  isActive: boolean
  showTextOverlay: boolean
  drawingLine: number[] | null
  activeTool: string
  selectedRegionId: string | null
  brushPreview: { color: string; size: number; opacity: number; shadowBlur: number }
  onActivate: () => void
  onSelectRegion: (id: string | null) => void
  onReorderDrop: (x: number, y: number) => void
  onRequestDelete: () => void
  onRegionUpdate: (id: string, updates: Partial<TextRegion>) => void
  editingRegionId: string | null
  onStartInlineEdit: (region: TextRegion) => void
}

function ArtboardNode({
  artboard,
  isActive,
  showTextOverlay,
  drawingLine,
  activeTool,
  brushPreview,
  onActivate,
  onSelectRegion,
  onReorderDrop,
  onRequestDelete,
  onRegionUpdate,
  editingRegionId,
  onStartInlineEdit,
}: ArtboardNodeProps) {
  const { entry, loaded, scale } = artboard
  const isBrushActive = activeTool === 'brush' || activeTool === 'eraser'
  const canReorderArtboard = activeTool === 'select'
  const canRenderTextOverlay = showTextOverlay && entry.imageLoaded !== false && Boolean(loaded)
  const reorderHandlePosition = { x: -30, y: -ARTBOARD_HEADER_HEIGHT + 4 }

  return (
    <Group
      x={artboard.x}
      y={artboard.y}
      onClick={(event) => {
        onActivate()
        if (event.target === event.currentTarget) onSelectRegion(null)
      }}
    >
      <Rect
        x={0}
        y={0}
        width={artboard.width}
        height={artboard.height}
        fill="rgba(0,0,0,0.01)"
        shadowColor="black"
        shadowBlur={isActive ? 20 : 12}
        shadowOpacity={isActive ? 0.36 : 0.24}
        shadowOffsetY={isActive ? 10 : 6}
      />
      <Text
        x={0}
        y={-ARTBOARD_HEADER_HEIGHT + 8}
        text={`หน้า ${entry.pageNumber ?? '?'}`}
        fontSize={12}
        fontStyle="bold"
        fill={isActive ? '#dbeafe' : '#f4f4f5'}
      />
      <Text
        x={artboard.width - 120}
        y={-ARTBOARD_HEADER_HEIGHT + 9}
        width={110}
        align="right"
        text={statusLabel[entry.status]}
        fontSize={10}
        fill={entry.status === 'error' ? '#ff8a8a' : entry.status === 'done' ? '#7ee787' : '#a1a1aa'}
      />
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
        }}
        onDragEnd={(event) => {
          event.cancelBubble = true
          const node = event.target
          onReorderDrop(artboard.x + node.x(), artboard.y + node.y())
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
        x={artboard.width + 4}
        y={-ARTBOARD_HEADER_HEIGHT + 2}
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
      {isActive && (
        <Rect
          x={0}
          y={-7}
          width={Math.min(72, artboard.width)}
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
        />
      ) : (
        <Rect width={artboard.width} height={artboard.height} fill="#151515" />
      )}
      {entry.brushStrokes.map((stroke) => {
        const feather = computeFeather(stroke.width, stroke.shadowBlur)
        return (
          <Line
            key={stroke.id}
            points={stroke.points.map((point, index) =>
              point * scale + (index % 2 === 0 ? (loaded?.offsetX ?? 0) : (loaded?.offsetY ?? 0)),
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
            point * scale + (index % 2 === 0 ? (loaded?.offsetX ?? 0) : (loaded?.offsetY ?? 0)),
          )}
          stroke={brushPreview.color}
          strokeWidth={computeFeather(brushPreview.size, brushPreview.shadowBlur).strokeWidth * scale}
          opacity={brushPreview.opacity}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          dash={activeTool === 'eraser' ? [5, 5] : undefined}
        />
      )}
      {canRenderTextOverlay && entry.regions.map((region) => (
        <ArtboardText
          key={`${entry.id}-${region.id}`}
          region={region}
          scale={scale}
          offsetX={loaded?.offsetX ?? 0}
          offsetY={loaded?.offsetY ?? 0}
          isActiveArtboard={isActive}
          onSelect={() => {
            onActivate()
            onSelectRegion(region.id)
          }}
          onUpdate={(updates) => onRegionUpdate(region.id, updates)}
          onLiveResize={(updates) => onRegionUpdate(region.id, updates)}
          isEditing={editingRegionId === region.id}
          onStartInlineEdit={() => onStartInlineEdit(region)}
        />
      ))}
    </Group>
  )
}

function ArtboardText({
  region,
  scale,
  offsetX,
  offsetY,
  isActiveArtboard,
  onSelect,
  onUpdate,
  onLiveResize,
  isEditing,
  onStartInlineEdit,
}: {
  region: TextRegion
  scale: number
  offsetX: number
  offsetY: number
  isActiveArtboard: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<TextRegion>) => void
  onLiveResize: (updates: Partial<TextRegion>) => void
  isEditing: boolean
  onStartInlineEdit: () => void
}) {
  const font = resolveFont(region.suggestedFont, region.mood)
  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
  const isArtistic = layoutMode === 'artistic'
  const text = region.translatedText || ' '
  const fontSize = isArtistic
    ? Math.max(8, region.fontSize * scale)
    : calculateBalloonFitFontSize(text, region.bbox, region.fontSize) * scale

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
    <Text
      id={isActiveArtboard ? region.id : `${region.id}-readonly`}
      x={offsetX + region.bbox.x * scale}
      y={offsetY + region.bbox.y * scale}
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
      draggable={isActiveArtboard}
      rotation={region.rotation}
      opacity={isEditing ? 0.12 : 1}
      listening={isActiveArtboard}
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
        onSelect()
      }}
      onDragMove={(event) => {
        event.cancelBubble = true
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true
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
        const node = event.target as Konva.Text
        if (!isArtistic) {
          const resized = applyLiveTextBoxResize(node)
          onUpdate({
            bbox: {
              x: (node.x() - offsetX) / scale,
              y: (node.y() - offsetY) / scale,
              width: resized.width / scale,
              height: resized.height / scale,
            },
            rotation: node.rotation(),
            textScaleX: 1,
            textScaleY: 1,
          })
          return
        }

        const textScaleX = node.scaleX()
        const textScaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onUpdate({
          bbox: {
            x: (node.x() - offsetX) / scale,
            y: (node.y() - offsetY) / scale,
            width: (node.width() * Math.abs(textScaleX)) / scale,
            height: (node.height() * Math.abs(textScaleY)) / scale,
          },
          textScaleX: isArtistic ? textScaleX : region.textScaleX,
          textScaleY: isArtistic ? textScaleY : region.textScaleY,
          rotation: node.rotation(),
        })
      }}
      onTransform={(event) => {
        event.cancelBubble = true
        const node = event.target as Konva.Text
        if (!isArtistic) {
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
          return
        }
        node.getLayer()?.batchDraw()
      }}
    />
  )
}

function computeFeather(size: number, feather: number) {
  return {
    strokeWidth: Math.max(1, size - 2 * feather),
    shadowBlur: feather,
  }
}
