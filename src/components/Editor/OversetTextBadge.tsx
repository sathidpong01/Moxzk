import { Group, Rect, Text } from 'react-konva'

interface OversetTextBadgeProps {
  x: number
  y: number
  viewportZoom: number
  showLabel?: boolean
  labelText?: string
}

export default function OversetTextBadge({
  x,
  y,
  viewportZoom,
  showLabel = false,
  labelText = 'ข้อความยังล้น',
}: OversetTextBadgeProps) {
  const inverseZoom = 1 / Math.max(0.0001, viewportZoom)
  const badgeWidth = 28 * inverseZoom
  const badgeHeight = 18 * inverseZoom
  const labelWidth = 92 * inverseZoom
  const labelHeight = 18 * inverseZoom
  const gap = 6 * inverseZoom

  return (
    <Group x={x - badgeWidth} y={y - badgeHeight} listening={false}>
      {showLabel && (
        <Group x={badgeWidth - labelWidth} y={-labelHeight - gap}>
          <Rect
            width={labelWidth}
            height={labelHeight}
            cornerRadius={labelHeight / 2}
            fill="rgba(120, 31, 31, 0.94)"
            stroke="rgba(255, 204, 204, 0.38)"
            strokeWidth={inverseZoom}
          />
          <Text
            x={labelWidth / 2}
            y={labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            offsetX={labelWidth / 2}
            offsetY={labelHeight / 2}
            text={labelText}
            fontSize={10 * inverseZoom}
            fontStyle="bold"
            fill="#ffe4e6"
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
      <Rect
        width={badgeWidth}
        height={badgeHeight}
        cornerRadius={badgeHeight / 2}
        fill="rgba(127, 29, 29, 0.96)"
        stroke="rgba(254, 202, 202, 0.44)"
        strokeWidth={inverseZoom}
      />
      <Text
        x={badgeWidth / 2}
        y={badgeHeight / 2}
        width={badgeWidth}
        height={badgeHeight}
        offsetX={badgeWidth / 2}
        offsetY={badgeHeight / 2}
        text="…+"
        fontSize={11 * inverseZoom}
        fontStyle="bold"
        fill="#fff1f2"
        align="center"
        verticalAlign="middle"
      />
    </Group>
  )
}
