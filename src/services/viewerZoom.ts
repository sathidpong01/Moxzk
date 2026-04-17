export const VIEWER_ZOOM_MIN = 0.25
export const VIEWER_ZOOM_MAX = 5
export const VIEWER_ZOOM_STEP = 0.1

export function clampViewerZoom(value: number): number {
  return Math.max(VIEWER_ZOOM_MIN, Math.min(VIEWER_ZOOM_MAX, value))
}

export function stepViewerZoom(
  currentZoom: number,
  direction: 'in' | 'out',
  step = VIEWER_ZOOM_STEP,
): number {
  return clampViewerZoom(currentZoom + (direction === 'in' ? step : -step))
}

export function wheelViewerZoom(currentZoom: number, deltaY: number): number {
  return stepViewerZoom(currentZoom, deltaY < 0 ? 'in' : 'out')
}
