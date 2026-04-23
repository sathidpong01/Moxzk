import type { ExportPreviewMode } from './exportDrawer'

export interface ExportPreviewPan {
  x: number
  y: number
}

export function canPanExportPreview(mode: ExportPreviewMode, zoom: number): boolean {
  return zoom > 1 && mode !== 'slider'
}

export function normalizeExportPreviewPan(zoom: number, pan: ExportPreviewPan): ExportPreviewPan {
  if (zoom <= 1) {
    return { x: 0, y: 0 }
  }

  return pan
}

export function createExportPreviewTransform(zoom: number, pan: ExportPreviewPan): string {
  return `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
}
