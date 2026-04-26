interface StageSize {
  width: number
  height: number
}

interface ArtboardBounds {
  x: number
  y: number
  width: number
  height: number
}

interface WorkspaceViewport {
  zoom: number
  x: number
  y: number
}

const MIN_FIT_ZOOM = 0.2
const MAX_FIT_ZOOM = 3

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundZoom(value: number): number {
  return Number(value.toFixed(2))
}

export function computeBoardViewport({
  stageSize,
  artboards,
  paddingX = 120,
  paddingY = 120,
}: {
  stageSize: StageSize
  artboards: ArtboardBounds[]
  paddingX?: number
  paddingY?: number
}): WorkspaceViewport {
  if (artboards.length === 0 || stageSize.width <= 0 || stageSize.height <= 0) {
    return { zoom: 1, x: 0, y: 0 }
  }

  const minX = Math.min(...artboards.map((artboard) => artboard.x))
  const minY = Math.min(...artboards.map((artboard) => artboard.y))
  const maxX = Math.max(...artboards.map((artboard) => artboard.x + artboard.width))
  const maxY = Math.max(...artboards.map((artboard) => artboard.y + artboard.height))
  const contentWidth = Math.max(1, maxX - minX)
  const contentHeight = Math.max(1, maxY - minY)
  const zoom = clamp(
    Math.min(
      (stageSize.width - paddingX) / contentWidth,
      (stageSize.height - paddingY) / contentHeight,
    ),
    MIN_FIT_ZOOM,
    MAX_FIT_ZOOM,
  )

  return {
    zoom: roundZoom(zoom),
    x: stageSize.width / 2 - (minX + contentWidth / 2) * zoom,
    y: stageSize.height / 2 - (minY + contentHeight / 2) * zoom,
  }
}

export function getViewportZoomPercent(zoom: number, artboardScale: number): number {
  const effectiveScale = Math.max(0.0001, zoom * artboardScale)
  return Math.max(1, Math.round(effectiveScale * 100))
}

export function getZoomFromViewportPercent(percent: number, artboardScale: number): number {
  const safeScale = Math.max(0.0001, artboardScale)
  return roundZoom(percent / 100 / safeScale)
}
