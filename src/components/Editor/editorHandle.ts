/**
 * Imperative handle exposed by the editor workspace to its parent shell
 * (toolbar, panel toggles, keyboard shortcuts).
 */
export interface CanvasEditorHandle {
  deselectAll: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
  setZoomPercent: (percent: number) => void
}
