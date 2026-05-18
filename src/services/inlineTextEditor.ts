import type { BoundingBox, TextLayoutMode } from '../types'
import { getRegionTextLayout, measureArtisticTextSize, normalizeTextLayoutMode, type RegionTextLayoutResult } from '../utils/textLayout.ts'
import type { TextRegion } from '../types'

export const TEXT_TRANSFORMER_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

export type TextTransformerAnchor = typeof TEXT_TRANSFORMER_ANCHORS[number]
export type TextTransformerShiftBehavior = 'default' | 'inverted' | 'none'

export const TEXT_TRANSFORMER_KEEP_RATIO = true
export const TEXT_TRANSFORMER_SHIFT_BEHAVIOR: TextTransformerShiftBehavior = 'none'

export interface InlineTextEditorLayerSizeInput {
  bbox: BoundingBox
  scale: number
  minWidth?: number
  minHeight?: number
}

export interface InlineTextEditorLayerSize {
  width: number
  height: number
}

export interface InlineTextEditorFontSizeInput {
  fontSize: number
  scale: number
  minFontSize?: number
}

export interface ArtisticInlineTextEditorLayerSizeInput {
  text: string
  bbox: BoundingBox
  scale: number
  fontSize: number
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  textScaleX?: number
  textScaleY?: number
  minWidth?: number
  minHeight?: number
  lineHeight?: number
  measureText?: (text: string, fontSize: number) => number
}

export interface InlineTextEditorCommitMetrics {
  width: number
  height: number
  scrollWidth?: number
  scrollHeight?: number
  layoutMode?: TextLayoutMode
}

export interface InlineTextEditorBboxSizeInput {
  metrics: InlineTextEditorCommitMetrics
  scale: number
  minWidth?: number
  minHeight?: number
}

export interface InlineTextEditorCommitValueInput {
  value: string
  editorValue: string
  editedValue: string
  constrainToFrame: boolean
  dirty: boolean
}

export interface TextBoxResizeResultInput {
  region: Pick<
    TextRegion,
    'bbox' | 'fontSize' | 'textLayoutMode' | 'textAlign' | 'textScaleX' | 'textScaleY' | 'mood' | 'balloonShape' | 'artisticFit'
  >
  bbox: BoundingBox
  text: string
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  rotation?: number
}

export interface TextBoxResizeResult {
  updates: Partial<TextRegion>
  layout?: RegionTextLayoutResult
}

export function getInlineTextEditorLayerSize({
  bbox,
  scale,
  minWidth = 96,
  minHeight = 44,
}: InlineTextEditorLayerSizeInput): InlineTextEditorLayerSize {
  return {
    width: Math.max(minWidth, bbox.width * scale),
    height: Math.max(minHeight, bbox.height * scale),
  }
}

export function getArtisticInlineTextEditorLayerSize({
  text,
  scale,
  fontSize,
  fontFamily,
  fontWeight,
  fontStyle,
  minWidth = 96,
  minHeight = 44,
  lineHeight = 1.18,
  measureText,
}: ArtisticInlineTextEditorLayerSizeInput): InlineTextEditorLayerSize {
  const content = measureArtisticTextSize(text || ' ', fontSize, {
    fontFamily,
    fontWeight,
    fontStyle,
    lineHeight,
    measureText,
  })
  return {
    width: Math.max(minWidth, content.width * scale),
    height: Math.max(minHeight, content.height * scale),
  }
}

export function getInlineTextEditorFontSize({
  fontSize,
  scale,
  minFontSize = 1,
}: InlineTextEditorFontSizeInput): number {
  return Math.max(minFontSize, fontSize * scale)
}

export function getInlineTextEditorBboxSize({
  metrics,
  scale,
  minWidth = 20,
  minHeight = 16,
}: InlineTextEditorBboxSizeInput): { width: number; height: number } {
  const denominator = Math.max(0.0001, scale)
  return {
    width: Math.max(minWidth, metrics.width / denominator),
    height: Math.max(minHeight, metrics.height / denominator),
  }
}

export interface InlineTextEditorCommitGeometryInput {
  region: Pick<TextRegion, 'bbox' | 'textLayoutMode' | 'artisticFit'>
  metrics: InlineTextEditorCommitMetrics | undefined
  scale: number
  minWidth?: number
  minHeight?: number
}

export interface InlineTextEditorCommitGeometry {
  bbox?: BoundingBox
}

/**
 * Resolves the bbox a finished inline edit should persist.
 *
 * Frame-constrained text (balloon_fit, and artistic bubble-guided) keeps its
 * detected box untouched: the textarea is only a transparent caret surface and
 * its clamped on-screen size must never feed back into the bbox, or the box
 * drifts larger on every edit. Only artistic-free text grows its box to hug
 * the typed glyphs.
 *
 * A commit never persists fontSize. For balloon_fit the font is a value
 * derived live from (text, box, shape) on every render; writing a fitted size
 * back would ratchet the preferred ceiling down each edit and make the
 * committed render diverge from the live editing preview.
 */
export function getInlineTextEditorCommitGeometry({
  region,
  metrics,
  scale,
  minWidth,
  minHeight,
}: InlineTextEditorCommitGeometryInput): InlineTextEditorCommitGeometry {
  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
  const constrainToFrame = layoutMode !== 'artistic' || region.artisticFit === 'bubble_guided'
  if (constrainToFrame || !metrics) return {}

  return {
    bbox: { ...region.bbox, ...getInlineTextEditorBboxSize({ metrics, scale, minWidth, minHeight }) },
  }
}

export function normalizeInlineTextEditorValue(value: string, constrainToFrame: boolean): string {
  if (!constrainToFrame) return value
  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines.reduce((result, line, index) => {
    const normalizedLine = line.trim()
    if (index === 0) return normalizedLine
    const needsSpace = /[A-Za-z0-9]$/.test(result) && /^[A-Za-z0-9]/.test(normalizedLine)
    return `${result}${needsSpace ? ' ' : ''}${normalizedLine}`
  }, '')
}

export function getInlineTextEditorCommitValue({
  value,
  editorValue,
  editedValue,
  constrainToFrame,
  dirty,
}: InlineTextEditorCommitValueInput): string {
  if (!dirty || editedValue === editorValue) return value
  return normalizeInlineTextEditorValue(editedValue, constrainToFrame)
}

export function getTextBoxResizeResult({
  region,
  bbox,
  text,
  fontFamily,
  fontWeight,
  fontStyle,
  rotation,
}: TextBoxResizeResultInput): TextBoxResizeResult {
  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
  // Resizing a balloon scales its preferred font ceiling by the box ratio.
  // We persist that scaled *preferred* size — never the fitted `layout.fontSize`.
  // The fitted size depends on text length, so writing it back would ratchet
  // the ceiling down on every resize and diverge from the live render, which
  // re-fits from the preferred ceiling on each draw.
  const preferredFontSize = layoutMode === 'balloon_fit'
    ? getResizedPreferredFontSize(region, bbox)
    : undefined
  const layout = preferredFontSize !== undefined
    ? getRegionTextLayout({ ...region, bbox, fontSize: preferredFontSize }, text || ' ', {
        fontFamily,
        fontWeight,
        fontStyle,
      })
    : undefined

  return {
    updates: {
      bbox,
      ...(preferredFontSize !== undefined ? { fontSize: preferredFontSize } : {}),
      ...(rotation !== undefined ? { rotation } : {}),
      ...(layoutMode === 'artistic' ? { textScaleX: 1, textScaleY: 1 } : {}),
    },
    layout,
  }
}

function getResizedPreferredFontSize(
  region: Pick<TextRegion, 'bbox' | 'fontSize'>,
  bbox: BoundingBox,
): number {
  const baseFontSize = Number.isFinite(region.fontSize) ? region.fontSize : 18
  const widthRatio = bbox.width > 0 && region.bbox.width > 0 ? bbox.width / region.bbox.width : 1
  const heightRatio = bbox.height > 0 && region.bbox.height > 0 ? bbox.height / region.bbox.height : 1
  const resizeRatio = Math.max(0.1, Math.max(widthRatio, heightRatio))
  return Math.max(1, baseFontSize * resizeRatio)
}

export function getTextTransformerAnchors(_layoutMode?: TextLayoutMode): TextTransformerAnchor[] {
  return [...TEXT_TRANSFORMER_ANCHORS]
}

export function getTextTransformerKeepRatio(_layoutMode?: TextLayoutMode): boolean {
  return TEXT_TRANSFORMER_KEEP_RATIO
}

export function getTextTransformerShiftBehavior(_layoutMode?: TextLayoutMode): TextTransformerShiftBehavior {
  return TEXT_TRANSFORMER_SHIFT_BEHAVIOR
}

export function shouldFinishInlineTextEditorOnPointerDown(
  editorRoot: Pick<HTMLElement, 'contains'> | null,
  target: EventTarget | null,
): boolean {
  return Boolean(editorRoot && target && !editorRoot.contains(target as Node))
}
