import { resolveRegionFont } from '../config/fonts.ts'
import type { TextRegion } from '../types'
import { layoutTextInBox, normalizeTextAlign } from '../utils/textLayout.ts'

/**
 * Convert a balloon-fit region to artistic layout.
 *
 * Key rules:
 * - DO NOT mutate `translatedText` (no injecting `\n`).
 *   Artistic mode uses `wrap:'word'` so Konva handles wrapping.
 * - Freeze the auto-fitted `fontSize` so artistic renders at the same size.
 * - Shrink bbox to the balloon's content area (strip padding) because
 *   artistic mode renders without padding.
 */
export function convertBalloonRegionToArtistic(region: TextRegion): Partial<TextRegion> {
  const font = resolveRegionFont(region)
  const layout = layoutTextInBox(region.translatedText || ' ', region.bbox, region.fontSize, {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.style,
  })
  const align = normalizeTextAlign(region.textAlign)

  // Balloon content area = bbox minus padding on each side.
  // Artistic mode has no padding, so this becomes the new bbox.
  const contentWidth = Math.max(20, region.bbox.width - layout.paddingX * 2)
  const contentHeight = Math.max(16, region.bbox.height - layout.paddingY * 2)

  return {
    // DO NOT include translatedText — keep original text unchanged.
    fontSize: layout.fontSize,
    textAlign: align,
    bbox: {
      x: region.bbox.x + layout.paddingX,
      y: region.bbox.y + layout.paddingY,
      width: contentWidth,
      height: contentHeight,
    },
    textScaleX: 1,
    textScaleY: 1,
  }
}

/**
 * Convert an artistic region back to balloon-fit layout.
 *
 * Re-expands bbox to add padding space that balloon mode needs.
 * Does NOT modify translatedText — layoutTextInBox will re-wrap automatically.
 */
export function convertArtisticRegionToBalloon(region: TextRegion): Partial<TextRegion> {
  // Estimate the padding that balloon mode will add, then expand bbox to compensate.
  // layoutTextInBox uses: paddingX = max(4, min(14, width * 0.06))
  //                       paddingY = max(3, min(12, height * 0.08))
  // We need to solve for the outer bbox given the current (inner) artistic bbox.
  const currentW = region.bbox.width
  const currentH = region.bbox.height
  // Approximate: if finalWidth = currentW + 2*px, px = max(4, min(14, finalWidth*0.06))
  // Use current dimensions to estimate padding (close enough).
  const estimatedPaddingX = Math.max(4, Math.min(14, (currentW + 28) * 0.06))
  const estimatedPaddingY = Math.max(3, Math.min(12, (currentH + 24) * 0.08))

  // Account for textScaleX/Y — the visual size may differ from bbox
  const scaleX = Math.abs(region.textScaleX ?? 1) || 1
  const scaleY = Math.abs(region.textScaleY ?? 1) || 1
  const visualWidth = currentW * scaleX
  const visualHeight = currentH * scaleY

  const balloonWidth = visualWidth + estimatedPaddingX * 2
  const balloonHeight = visualHeight + estimatedPaddingY * 2

  // Center the new balloon bbox around the artistic center
  const centerX = region.bbox.x + currentW / 2
  const centerY = region.bbox.y + currentH / 2

  return {
    bbox: {
      x: centerX - balloonWidth / 2,
      y: centerY - balloonHeight / 2,
      width: balloonWidth,
      height: balloonHeight,
    },
    textScaleX: 1,
    textScaleY: 1,
  }
}
