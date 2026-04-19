import type { ActiveTool } from '../types'

const ICON_PATHS: Record<ActiveTool, string[]> = {
  select: [
    'M4 3 18 17 12 18.5 9.5 24 4 3Z',
  ],
  brush: [
    'M18.4 2.6 21.4 5.6 12 15 9 12 18.4 2.6Z',
    'M9 12 5.5 15.5C3.8 17.2 3 18.7 3 21C5.3 21 6.8 20.2 8.5 18.5L12 15',
  ],
  eraser: [
    'M7 21 3 17 13.5 6.5 21 14 14 21H7Z',
    'M10.5 9.5 17.5 16.5',
  ],
  eyedropper: [
    'M2 22 3 21H6L15 12',
    'M3 21V18L12 9',
    'M15 6 18.4 2.6A2.1 2.1 0 1 1 21.4 5.6L18 9L18.4 9.4A2.1 2.1 0 1 1 15.4 12.4L11.6 8.6A2.1 2.1 0 1 1 14.6 5.6L15 6Z',
  ],
  pan: [
    'M7 12V7A2 2 0 0 1 11 7V11',
    'M11 11V5A2 2 0 0 1 15 5V11',
    'M15 11V7A2 2 0 0 1 19 7V17A6 6 0 0 1 13 23H11A6 6 0 0 1 5.8 20L2.6 16.2A2 2 0 0 1 5.5 13.5L7 15',
  ],
}

const HOTSPOTS: Record<ActiveTool, { x: number; y: number }> = {
  select: { x: 4, y: 3 },
  brush: { x: 5, y: 20 },
  eraser: { x: 5, y: 18 },
  eyedropper: { x: 2, y: 22 },
  pan: { x: 12, y: 12 },
}

const FALLBACKS: Record<ActiveTool, string> = {
  select: 'default',
  brush: 'crosshair',
  eraser: 'crosshair',
  eyedropper: 'crosshair',
  pan: 'grab',
}

export function getEditorToolCursor(tool: ActiveTool): string {
  const hotspot = HOTSPOTS[tool]
  const paths = ICON_PATHS[tool]
  const shadowPaths = paths.map((path) => `<path d="${path}" />`).join('')
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    `<g stroke="black" stroke-width="4" opacity="0.72">${shadowPaths}</g>`,
    `<g stroke="white" stroke-width="2.15">${shadowPaths}</g>`,
    `</svg>`,
  ].join('')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot.x} ${hotspot.y}, ${FALLBACKS[tool]}`
}
