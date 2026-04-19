import type { BrushStroke, ImageEntry } from '../types'

export interface BrushHistoryState {
  brushStrokes: BrushStroke[]
  redoStack: BrushStroke[]
}

export function syncActiveEntryBrushStrokes(
  entries: ImageEntry[],
  activeImageId: string | null,
  brushStrokes: BrushStroke[],
): ImageEntry[] {
  if (!activeImageId) return entries
  return entries.map((entry) =>
    entry.id === activeImageId ? { ...entry, brushStrokes } : entry,
  )
}

export function appendBrushStroke(
  state: BrushHistoryState,
  stroke: BrushStroke,
): BrushHistoryState {
  return {
    brushStrokes: [...state.brushStrokes, stroke],
    redoStack: [],
  }
}

export function undoBrushStroke(state: BrushHistoryState): BrushHistoryState {
  if (state.brushStrokes.length === 0) return state
  const brushStrokes = [...state.brushStrokes]
  const removed = brushStrokes.pop()!
  return {
    brushStrokes,
    redoStack: [...state.redoStack, removed],
  }
}

export function redoBrushStroke(state: BrushHistoryState): BrushHistoryState {
  if (state.redoStack.length === 0) return state
  const redoStack = [...state.redoStack]
  const restored = redoStack.pop()!
  return {
    brushStrokes: [...state.brushStrokes, restored],
    redoStack,
  }
}

export function clearBrushStrokes(): BrushHistoryState {
  return {
    brushStrokes: [],
    redoStack: [],
  }
}

export function computeBrushFeather(size: number, feather: number) {
  const strokeWidth = Math.max(1, size)
  const featherRadius = Math.max(0, feather)
  return {
    strokeWidth,
    shadowBlur: featherRadius,
    coreRadius: strokeWidth / 2,
    featherRadius,
    totalWidth: strokeWidth + featherRadius * 2,
  }
}

export function getBrushCompositeOperation(tool: BrushStroke['tool']): GlobalCompositeOperation {
  return tool === 'eraser' ? 'destination-out' : 'source-over'
}

export function drawBrushStrokesOnContext(
  ctx: CanvasRenderingContext2D,
  strokes: BrushStroke[],
): void {
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    const feather = computeBrushFeather(stroke.width, stroke.shadowBlur)

    ctx.save()
    ctx.globalAlpha = stroke.opacity
    ctx.globalCompositeOperation = getBrushCompositeOperation(stroke.tool)
    if (feather.featherRadius <= 0) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = feather.strokeWidth
      ctx.beginPath()
      ctx.moveTo(stroke.points[0], stroke.points[1])
      for (let i = 2; i < stroke.points.length; i += 2) {
        ctx.lineTo(stroke.points[i], stroke.points[i + 1])
      }
      ctx.stroke()
    } else {
      drawSoftStroke(ctx, stroke, feather)
    }
    ctx.restore()
  }
}

function drawSoftStroke(
  ctx: CanvasRenderingContext2D,
  stroke: BrushStroke,
  feather: ReturnType<typeof computeBrushFeather>,
): void {
  const spacing = Math.max(1, feather.coreRadius / 2)
  let previousX = stroke.points[0]
  let previousY = stroke.points[1]
  stampSoftBrush(ctx, previousX, previousY, stroke, feather)

  for (let i = 2; i < stroke.points.length; i += 2) {
    const x = stroke.points[i]
    const y = stroke.points[i + 1]
    const distance = Math.hypot(x - previousX, y - previousY)
    const steps = Math.max(1, Math.ceil(distance / spacing))
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      stampSoftBrush(
        ctx,
        previousX + (x - previousX) * t,
        previousY + (y - previousY) * t,
        stroke,
        feather,
      )
    }
    previousX = x
    previousY = y
  }
}

function stampSoftBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stroke: BrushStroke,
  feather: ReturnType<typeof computeBrushFeather>,
): void {
  const outerRadius = feather.coreRadius + feather.featherRadius
  const gradient = ctx.createRadialGradient(x, y, feather.coreRadius, x, y, outerRadius)
  const solid = stroke.tool === 'eraser' ? 'rgba(0, 0, 0, 1)' : colorToRgba(stroke.color, 1)
  const transparent = stroke.tool === 'eraser' ? 'rgba(0, 0, 0, 0)' : colorToRgba(stroke.color, 0)
  gradient.addColorStop(0, solid)
  gradient.addColorStop(1, transparent)

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, outerRadius, 0, Math.PI * 2)
  ctx.fill()
}

function colorToRgba(value: string, alpha: number): string {
  const short = value.match(/^#([0-9a-f]{3})$/i)
  if (short) {
    const [r, g, b] = short[1].split('').map((char) => Number.parseInt(char + char, 16))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const full = value.match(/^#([0-9a-f]{6})$/i)
  if (full) {
    const int = Number.parseInt(full[1], 16)
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`
  }
  return alpha === 0 ? 'rgba(0, 0, 0, 0)' : value
}

export function drawBrushOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: BrushStroke[],
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): void {
  if (strokes.length === 0) return
  const overlay = createCanvas()
  overlay.width = width
  overlay.height = height
  const overlayCtx = overlay.getContext('2d')
  if (!overlayCtx) return
  drawBrushStrokesOnContext(overlayCtx, strokes)
  ctx.drawImage(overlay, 0, 0)
}
