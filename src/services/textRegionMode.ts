import { resolveRegionFont } from '../config/fonts.ts'
import type { TextRegion } from '../types'
import {
  getRegionTextLayout,
  getTextLayoutPadding,
  normalizeTextArtisticFit,
  normalizeTextAlign,
  normalizeTextBalloonShape,
  normalizeTextLayoutMode,
} from '../utils/textLayout.ts'

/**
 * Convert a balloon-fit region to artistic layout.
 *
 * Key rules:
 * - DO NOT mutate `translatedText` (no injecting `\n`).
 *   Artistic mode wraps through the shared text-frame layout helper.
 * - Freeze the auto-fitted `fontSize` so artistic renders at the same size.
 * - Shrink bbox to the balloon's content area (strip padding) because
 *   artistic mode renders without padding.
 */
export function convertBalloonRegionToArtistic(region: TextRegion): Partial<TextRegion> {
  const font = resolveRegionFont(region)
  const layout = getRegionTextLayout(region, region.translatedText || ' ', {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.style,
  })
  const align = normalizeTextAlign(region.textAlign)

  // Artistic conversion keeps the visible text area stable. Bubble fit uses
  // extra-safe padding for round edges, but stripping all of it would make old
  // artistic boxes unexpectedly narrow.
  const conversionPaddingX = Math.min(layout.paddingX, Math.max(8, Math.min(24, region.bbox.width * 0.12)))
  const conversionPaddingY = Math.min(layout.paddingY, Math.max(6, Math.min(18, region.bbox.height * 0.12)))
  const contentWidth = Math.max(20, region.bbox.width - conversionPaddingX * 2)
  const contentHeight = Math.max(16, region.bbox.height - conversionPaddingY * 2)

  return {
    // DO NOT include translatedText — keep original text unchanged.
    fontSize: layout.fontSize,
    textAlign: align,
    bbox: {
      x: region.bbox.x + conversionPaddingX,
      y: region.bbox.y + conversionPaddingY,
      width: contentWidth,
      height: contentHeight,
    },
    textScaleX: 1,
    textScaleY: 1,
    balloonShape: normalizeTextBalloonShape(region.balloonShape, region.mood),
  }
}

/**
 * Convert an artistic region back to balloon-fit layout.
 *
 * Re-expands bbox to add padding space that balloon mode needs.
 * Does NOT modify translatedText — layoutTextInBox will re-wrap automatically.
 */
export function convertArtisticRegionToBalloon(region: TextRegion): Partial<TextRegion> {
  const currentW = region.bbox.width
  const currentH = region.bbox.height

  // Artistic mode now treats bbox as the text frame. Legacy textScaleX/Y values
  // are reset by editor actions and should not make balloon conversion stretch.
  const visualWidth = currentW
  const visualHeight = currentH
  const padding = getTextLayoutPadding(
    { width: visualWidth, height: visualHeight },
    normalizeTextBalloonShape(region.balloonShape, region.mood),
  )

  const balloonWidth = visualWidth + padding.x * 2
  const balloonHeight = visualHeight + padding.y * 2

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
    balloonShape: normalizeTextBalloonShape(region.balloonShape, region.mood),
  }
}

export function expandTextRegionBox(region: TextRegion): Partial<TextRegion> {
  const growX = Math.max(12, region.bbox.width * 0.12)
  const growY = Math.max(8, region.bbox.height * 0.12)
  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)

  return {
    bbox: {
      x: region.bbox.x - growX / 2,
      y: region.bbox.y - growY / 2,
      width: region.bbox.width + growX,
      height: region.bbox.height + growY,
    },
    ...(layoutMode === 'artistic'
      ? {
          textScaleX: 1,
          textScaleY: 1,
          artisticFit: normalizeTextArtisticFit(region.artisticFit),
        }
      : {}),
  }
}
