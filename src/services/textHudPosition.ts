export type TextHudPlacement = 'top' | 'bottom'

interface RectLike {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeTextHudPosition({
  anchorRect,
  containerWidth,
  containerHeight,
  hudWidth,
  hudHeight,
  preferredPlacement = 'top',
  gap = 12,
  padding = 12,
}: {
  anchorRect: RectLike
  containerWidth: number
  containerHeight: number
  hudWidth: number
  hudHeight: number
  preferredPlacement?: TextHudPlacement
  gap?: number
  padding?: number
}): { left: number; top: number; placement: TextHudPlacement } {
  const safeHudWidth = Math.max(1, hudWidth)
  const safeHudHeight = Math.max(1, hudHeight)
  const canPlaceAbove = anchorRect.y - safeHudHeight - gap >= padding
  const canPlaceBelow = anchorRect.y + anchorRect.height + safeHudHeight + gap <= containerHeight - padding

  let placement: TextHudPlacement = preferredPlacement
  if (preferredPlacement === 'top' && !canPlaceAbove && canPlaceBelow) placement = 'bottom'
  if (preferredPlacement === 'bottom' && !canPlaceBelow && canPlaceAbove) placement = 'top'

  const unclampedLeft = anchorRect.x + anchorRect.width / 2 - safeHudWidth / 2
  const left = clamp(unclampedLeft, padding, Math.max(padding, containerWidth - safeHudWidth - padding))
  const unclampedTop = placement === 'top'
    ? anchorRect.y - safeHudHeight - gap
    : anchorRect.y + anchorRect.height + gap
  const top = clamp(unclampedTop, padding, Math.max(padding, containerHeight - safeHudHeight - padding))

  return { left, top, placement }
}
