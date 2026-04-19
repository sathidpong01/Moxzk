import { Line, Rect } from 'react-konva'

interface CanvasGridProps {
  stageSize: { width: number; height: number }
  stagePos: { x: number; y: number }
  zoom: number
  cellSize?: number
}

export default function CanvasGrid({
  stageSize,
  stagePos,
  zoom,
  cellSize = 28,
}: CanvasGridProps) {
  const safeZoom = Math.max(0.05, zoom)
  const left = -stagePos.x / safeZoom
  const top = -stagePos.y / safeZoom
  const right = left + stageSize.width / safeZoom
  const bottom = top + stageSize.height / safeZoom
  const startX = Math.floor(left / cellSize) * cellSize
  const endX = Math.ceil(right / cellSize) * cellSize
  const startY = Math.floor(top / cellSize) * cellSize
  const endY = Math.ceil(bottom / cellSize) * cellSize
  const lines = []

  for (let x = startX; x <= endX; x += cellSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, top, x, bottom]}
        stroke="rgba(255, 255, 255, 0.04)"
        strokeWidth={1 / safeZoom}
        listening={false}
      />,
    )
  }

  for (let y = startY; y <= endY; y += cellSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[left, y, right, y]}
        stroke="rgba(255, 255, 255, 0.04)"
        strokeWidth={1 / safeZoom}
        listening={false}
      />,
    )
  }

  return (
    <>
      <Rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        fill="#121212"
        listening={false}
      />
      {lines}
    </>
  )
}
