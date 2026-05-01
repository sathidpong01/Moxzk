import { resolveRegionFont } from '../config/fonts.ts'
import type { TextRegion } from '../types'
import {
  getRegionTextLayout,
  getTextLayoutPadding,
  layoutTextInBox,
  normalizeTextArtisticFit,
  normalizeTextAlign,
  normalizeTextBalloonShape,
  normalizeTextLayoutMode,
} from '../utils/textLayout.ts'
import type { TextLayoutOptions } from '../utils/textLayout.ts'

/**
 * Compute a lightweight dirty-detection string for balloon↔artistic round trips.
 * Combines translated text, font identity, and rendered font size so that any
 * content or manual type edit marks the snapshot as stale and triggers a re-fit
 * on the next balloon restore.
 */
function computeContentHash(region: Pick<TextRegion, 'translatedText' | 'fontId' | 'suggestedFont' | 'mood' | 'fontSize'>): string {
  const text = region.translatedText ?? ''
  const fontKey = region.fontId ?? region.suggestedFont ?? region.mood ?? ''
  const fontSize = Number.isFinite(region.fontSize) ? Math.round(region.fontSize * 1000) / 1000 : ''
  return `${text}|${fontKey}|${fontSize}`
}

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
  const artisticFit = normalizeTextArtisticFit(region.artisticFit)
  const artisticLayout = getRegionTextLayout(
    {
      ...region,
      bbox: {
        ...region.bbox,
        width: contentWidth,
        height: contentHeight,
      },
      fontSize: layout.fontSize,
      textLayoutMode: 'artistic',
      artisticFit,
    },
    region.translatedText || ' ',
    {
      fontFamily: font.family,
      fontWeight: font.weight,
      fontStyle: font.style,
    },
  )
  const visualWidth = artisticFit === 'free' ? artisticLayout.innerWidth : contentWidth
  const visualHeight = artisticFit === 'free' ? artisticLayout.contentHeight : contentHeight
  const centerX = region.bbox.x + region.bbox.width / 2
  const centerY = region.bbox.y + region.bbox.height / 2

  return {
    // DO NOT include translatedText — keep original text unchanged.
    fontSize: layout.fontSize,
    textAlign: align,
    bbox: {
      x: centerX - visualWidth / 2,
      y: centerY - visualHeight / 2,
      width: visualWidth,
      height: visualHeight,
    },
    textScaleX: 1,
    textScaleY: 1,
    artisticFit,
    balloonFitBbox: { ...region.bbox },
    balloonFitFontSize: region.fontSize,
    balloonFitTextHash: computeContentHash({ ...region, fontSize: layout.fontSize }),
    balloonShape: normalizeTextBalloonShape(region.balloonShape, region.mood),
  }
}

/**
 * Convert an artistic region back to balloon-fit layout.
 *
 * Uses a hybrid restore policy:
 * - If text and font are unchanged since the balloon snapshot was taken
 *   ("clean" round-trip), restore the exact saved fontSize and bbox size.
 * - If text or font changed while in artistic mode ("dirty"), keep the saved
 *   bbox size as the target frame but re-fit fontSize via layoutTextInBox so
 *   the new content fits correctly.
 * - If no snapshot exists, fall back to computing bbox from artistic bbox + padding.
 *
 * In all cases the center is derived from the current artistic bbox position so
 * that moving the box in artistic mode still takes effect.
 */
export function convertArtisticRegionToBalloon(
  region: TextRegion,
  fontOptions?: Pick<TextLayoutOptions, 'fontFamily' | 'fontWeight' | 'fontStyle'>,
): Partial<TextRegion> {
  const currentW = region.bbox.width
  const currentH = region.bbox.height
  const preservedBalloonBbox = region.balloonFitBbox
  const preservedFontSize = region.balloonFitFontSize
  const preservedTextHash = region.balloonFitTextHash
  const balloonShape = normalizeTextBalloonShape(region.balloonShape, region.mood)

  // Dirty detection: snapshot is stale if text or font changed during artistic mode.
  const currentHash = computeContentHash(region)
  const isDirty = !preservedTextHash || preservedTextHash !== currentHash

  // Artistic mode now treats bbox as the text frame. Legacy textScaleX/Y values
  // are reset by editor actions and should not make balloon conversion stretch.
  const visualWidth = currentW
  const visualHeight = currentH
  const padding = getTextLayoutPadding({ width: visualWidth, height: visualHeight }, balloonShape)

  const balloonWidth = visualWidth + padding.x * 2
  const balloonHeight = visualHeight + padding.y * 2

  // Center the new balloon bbox around the current artistic center so that
  // moving the box in artistic mode takes effect when restoring.
  const centerX = region.bbox.x + currentW / 2
  const centerY = region.bbox.y + currentH / 2
  const nextWidth = preservedBalloonBbox?.width ?? balloonWidth
  const nextHeight = preservedBalloonBbox?.height ?? balloonHeight

  // Determine fontSize: exact restore when clean, re-fit when dirty.
  let nextFontSize: number | undefined
  if (!isDirty && preservedFontSize !== undefined) {
    // Clean round-trip — restore the exact snapshot fontSize.
    nextFontSize = preservedFontSize
  } else if (preservedBalloonBbox !== undefined) {
    // Dirty — content changed, re-fit into the original balloon frame size.
    const refit = layoutTextInBox(
      region.translatedText || ' ',
      { width: nextWidth, height: nextHeight },
      region.fontSize,
      { shape: balloonShape, ...fontOptions },
    )
    nextFontSize = refit.fontSize
  }
  // If no snapshot at all, leave fontSize unchanged (the balloon renderer will
  // auto-fit on its own via getRegionTextLayout).

  return {
    bbox: {
      x: centerX - nextWidth / 2,
      y: centerY - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
    },
    textScaleX: 1,
    textScaleY: 1,
    ...(nextFontSize !== undefined ? { fontSize: nextFontSize } : {}),
    balloonFitBbox: undefined,
    balloonFitFontSize: undefined,
    balloonFitTextHash: undefined,
    balloonShape,
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
