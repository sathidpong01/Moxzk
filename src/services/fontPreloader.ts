import Konva from 'konva'
import { BUILT_IN_FONTS } from '../config/fonts'

// Built-in fonts are declared via CSS @font-face, which the browser only loads
// lazily when a DOM element actually uses them. Editor text is painted on a
// Konva <canvas>, which never triggers that load, so every non-default family
// silently falls back. Force-load the families up front, then repaint every
// live Konva stage so already-painted text picks up the real glyphs.
export async function preloadEditorFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return

  await Promise.all(
    BUILT_IN_FONTS.map((font) => {
      const spec = `${font.style === 'italic' ? 'italic ' : ''}${font.weight} 16px "${font.family}"`
      return document.fonts.load(spec).catch(() => undefined)
    }),
  )

  for (const stage of Konva.stages) {
    for (const layer of stage.getLayers()) {
      layer.batchDraw()
    }
  }
}
