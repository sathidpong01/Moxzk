import type { MoodType, TextRegion } from '../types'

interface BoxLike {
  width: number
  height: number
}

export type NormalizedTextLayoutMode = 'balloon_fit' | 'artistic'
export type NormalizedTextAlign = 'left' | 'center' | 'right'
export type NormalizedTextBalloonShape = 'round' | 'cloud' | 'box'
export type NormalizedTextArtisticFit = 'free' | 'bubble_guided'
export type TextOverflowReason = 'width' | 'height' | 'min_font' | 'clipped' | 'readability'

export interface TextLayoutOptions {
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  lineHeight?: number
  minFontSize?: number
  readableMinFontSize?: number
  maxFontSize?: number
  paddingX?: number
  paddingY?: number
  shape?: NormalizedTextBalloonShape | 'bubble'
  canvas?: HTMLCanvasElement
  measureText?: (text: string, fontSize: number) => number
}

export interface TextLayoutResult {
  fontSize: number
  lines: string[]
  lineHeight: number
  lineHeightPx: number
  contentHeight: number
  paddingX: number
  paddingY: number
  lineWidths: number[]
  overflow: boolean
  overflowReason?: TextOverflowReason
}

export interface ArtisticTextSizeResult {
  width: number
  height: number
  lines: string[]
  lineHeight: number
  lineHeightPx: number
}

export interface RegionTextLayoutResult {
  mode: NormalizedTextLayoutMode
  balloonShape: NormalizedTextBalloonShape
  artisticFit: NormalizedTextArtisticFit
  textAlign: NormalizedTextAlign
  lines: string[]
  fontSize: number
  lineHeight: number
  lineHeightPx: number
  contentHeight: number
  paddingX: number
  paddingY: number
  lineWidths: number[]
  innerWidth: number
  innerHeight: number
  startX: number
  startY: number
  scaleX: number
  scaleY: number
  overflow: boolean
  overflowReason?: TextOverflowReason
}

const segmenter = typeof Intl !== 'undefined' && (Intl as typeof Intl & {
  Segmenter?: new (locale?: string, options?: { granularity?: 'grapheme' | 'word' }) => {
    segment: (input: string) => Iterable<{ segment: string; isWordLike?: boolean }>
  }
}).Segmenter
  ? new ((Intl as typeof Intl & {
      Segmenter: new (locale?: string, options?: { granularity?: 'grapheme' | 'word' }) => {
        segment: (input: string) => Iterable<{ segment: string; isWordLike?: boolean }>
      }
    }).Segmenter)('th', { granularity: 'word' })
  : null

let sharedCanvas: HTMLCanvasElement | null = null
export const READABLE_MIN_BALLOON_FONT_SIZE = 12

export function normalizeTextLayoutMode(mode?: string): NormalizedTextLayoutMode {
  return mode === 'artistic' ? 'artistic' : 'balloon_fit'
}

export function normalizeTextAlign(align?: string): NormalizedTextAlign {
  return align === 'left' || align === 'right' ? align : 'center'
}

export function normalizeTextBalloonShape(
  shape?: string,
  mood?: MoodType,
): NormalizedTextBalloonShape {
  if (shape === 'box') return 'box'
  if (shape === 'cloud') return 'cloud'
  if (shape === 'round' || shape === 'bubble') return 'round'
  return mood === 'narration' ? 'box' : 'round'
}

export function normalizeTextArtisticFit(fit?: string): NormalizedTextArtisticFit {
  return fit === 'bubble_guided' ? 'bubble_guided' : 'free'
}

export function layoutTextInBox(
  text: string,
  bbox: BoxLike,
  preferredFontSize: number,
  options: TextLayoutOptions = {},
): TextLayoutResult {
  const lineHeight = options.lineHeight ?? 1.1
  const shape = normalizeTextBalloonShape(options.shape)
  const paddingX = options.paddingX ?? getLayoutPaddingX(bbox, shape)
  const paddingY = options.paddingY ?? getLayoutPaddingY(bbox, shape)
  const availableWidth = Math.max(1, bbox.width - paddingX * 2)
  const availableHeight = Math.max(1, bbox.height - paddingY * 2)
  const minFontSize = Math.max(6, options.minFontSize ?? 8)
  const readableMinFontSize = Math.max(minFontSize, options.readableMinFontSize ?? READABLE_MIN_BALLOON_FONT_SIZE)
  const maxFontSize = Math.max(minFontSize, options.maxFontSize ?? 72)
  const preferred = Number.isFinite(preferredFontSize) ? preferredFontSize : 18
  const upperBound = Math.min(maxFontSize, Math.max(minFontSize, preferred), availableHeight * 0.82)

  const measure = buildMeasure(options)
  let low = minFontSize
  let high = Math.max(minFontSize, upperBound)
  let best = minFontSize
  let bestLines = wrapTextToShape(text, availableWidth, availableHeight, minFontSize, lineHeight, shape, measure)

  for (let i = 0; i < 12; i += 1) {
    const size = (low + high) / 2
    const lines = wrapTextToShape(text, availableWidth, availableHeight, size, lineHeight, shape, measure)
    const lineWidths = buildLineWidths(availableWidth, lines.length, shape)
    const contentHeight = lines.length * size * lineHeight
    const fitsHeight = contentHeight <= availableHeight + 0.5
    const fitsWidth = lines.every((line, index) => measure(line, size) <= lineWidths[index] + 0.5)
    if (fitsHeight && fitsWidth) {
      best = size
      bestLines = lines
      low = size
    } else {
      high = size
    }
  }

  const fittedFontSize = Math.max(minFontSize, Math.floor(best * getFitComfortScale(shape) * 10) / 10)
  const didClampForReadability = fittedFontSize < readableMinFontSize
  const fontSize = didClampForReadability ? readableMinFontSize : fittedFontSize
  const lines = wrapTextToShape(text, availableWidth, availableHeight, fontSize, lineHeight, shape, measure)
  const lineWidths = buildLineWidths(availableWidth, lines.length, shape)
  const lineHeightPx = fontSize * lineHeight
  const contentHeight = lines.length * lineHeightPx
  const widthOverflow = lines.some((line, index) => measure(line, fontSize) > lineWidths[index] + 0.5)
  const heightOverflow = contentHeight > availableHeight + 0.5
  const overflow = didClampForReadability || widthOverflow || heightOverflow

  return {
    fontSize,
    lines: lines.length ? lines : bestLines,
    lineHeight,
    lineHeightPx,
    contentHeight,
    paddingX,
    paddingY,
    lineWidths,
    overflow,
    overflowReason: overflow
      ? didClampForReadability
        ? 'readability'
        : fontSize <= minFontSize + 0.05
        ? 'min_font'
        : heightOverflow
          ? 'height'
          : 'width'
      : undefined,
  }
}

export function getRegionTextLayout(
  region: Pick<
    TextRegion,
    'bbox' | 'fontSize' | 'textLayoutMode' | 'textAlign' | 'textScaleX' | 'textScaleY' | 'mood' | 'balloonShape' | 'artisticFit'
  >,
  text: string,
  options: TextLayoutOptions = {},
): RegionTextLayoutResult {
  const mode = normalizeTextLayoutMode(region.textLayoutMode)
  const textAlign = normalizeTextAlign(region.textAlign)
  const balloonShape = normalizeTextBalloonShape(region.balloonShape, region.mood)
  const artisticFit = normalizeTextArtisticFit(region.artisticFit)

  if (mode === 'balloon_fit') {
    const layout = layoutTextInBox(text, region.bbox, region.fontSize, {
      ...options,
      shape: balloonShape,
    })
    const innerWidth = Math.max(1, region.bbox.width - layout.paddingX * 2)
    const innerHeight = Math.max(1, region.bbox.height - layout.paddingY * 2)
    return {
      mode,
      balloonShape,
      artisticFit,
      textAlign,
      lines: layout.lines,
      fontSize: layout.fontSize,
      lineHeight: layout.lineHeight,
      lineHeightPx: layout.lineHeightPx,
      contentHeight: layout.contentHeight,
      paddingX: layout.paddingX,
      paddingY: layout.paddingY,
      lineWidths: layout.lineWidths,
      innerWidth,
      innerHeight,
      startX: textAlign === 'left'
        ? layout.paddingX
        : textAlign === 'right'
          ? region.bbox.width - layout.paddingX
          : region.bbox.width / 2,
      startY: layout.paddingY + Math.max(0, (innerHeight - layout.contentHeight) / 2),
      scaleX: 1,
      scaleY: 1,
      overflow: layout.overflow,
      overflowReason: layout.overflowReason,
    }
  }

  // Artistic free behaves like a natural text object. Bubble-guided is the
  // framed variant that wraps inside the detected/edited bubble bbox.
  const scaleX = 1
  const scaleY = 1
  const fontSize = Math.max(8, Number.isFinite(region.fontSize) ? region.fontSize : 18)
  const measure = buildMeasure(options)
  const lineHeight = options.lineHeight ?? 1.18
  const widthSpace = region.bbox.width / scaleX
  const heightSpace = region.bbox.height / scaleY
  const padding = artisticFit === 'bubble_guided'
    ? getTextLayoutPadding({ width: widthSpace, height: heightSpace }, balloonShape)
    : { x: 0, y: 0 }
  const framedInnerWidth = Math.max(1, widthSpace - padding.x * 2)
  const framedInnerHeight = Math.max(1, heightSpace - padding.y * 2)
  const lines = artisticFit === 'bubble_guided'
    ? wrapTextToWidth(text || ' ', framedInnerWidth, fontSize, measure)
    : normalizeTextLines(text || ' ')
  const lineWidths = lines.map((line) => measure(line, fontSize))
  const lineHeightPx = fontSize * lineHeight
  const contentHeight = Math.max(lineHeightPx, lines.length * lineHeightPx)
  const naturalWidth = Math.max(1, ...lineWidths)
  const innerWidth = artisticFit === 'bubble_guided' ? framedInnerWidth : naturalWidth
  const innerHeight = artisticFit === 'bubble_guided' ? framedInnerHeight : contentHeight
  const overflow = artisticFit === 'bubble_guided'
    ? lineWidths.some((width) => width > innerWidth + 0.5) || contentHeight > innerHeight + 0.5
    : false

  return {
    mode,
    balloonShape,
    artisticFit,
    textAlign,
    lines,
    fontSize,
    lineHeight,
    lineHeightPx,
    contentHeight,
    paddingX: padding.x,
    paddingY: padding.y,
    lineWidths,
    innerWidth,
    innerHeight,
    startX: textAlign === 'left'
      ? padding.x
      : textAlign === 'right'
        ? padding.x + innerWidth
        : padding.x + innerWidth / 2,
    startY: padding.y,
    scaleX,
    scaleY,
    overflow,
    overflowReason: overflow ? 'clipped' : undefined,
  }
}

export function calculateBalloonFitFontSize(
  text: string,
  bbox: BoxLike,
  preferredFontSize: number,
): number {
  if (bbox.width <= 0 || bbox.height <= 0) return Math.max(8, Math.round(preferredFontSize || 14))
  return Math.round(layoutTextInBox(text, bbox, preferredFontSize).fontSize)
}

export function getTextLayoutPadding(
  bbox: BoxLike,
  shape: TextLayoutOptions['shape'] = 'bubble',
): { x: number; y: number } {
  const normalizedShape = normalizeTextBalloonShape(shape)
  return {
    x: getLayoutPaddingX(bbox, normalizedShape),
    y: getLayoutPaddingY(bbox, normalizedShape),
  }
}

export function estimateWrappedLineCount(text: string, width: number, fontSize: number): number {
  return wrapTextToWidth(text, width, fontSize, buildMeasure({})).length
}

export function measureArtisticTextSize(
  text: string,
  fontSize: number,
  options: TextLayoutOptions = {},
): ArtisticTextSizeResult {
  const lineHeight = options.lineHeight ?? 1.18
  const size = Math.max(1, Number.isFinite(fontSize) ? fontSize : 18)
  const lines = normalizeTextLines(text)
  const measure = buildMeasure(options)
  const width = Math.max(1, ...lines.map((line) => measure(line, size)))
  const lineHeightPx = size * lineHeight

  return {
    width,
    height: Math.max(lineHeightPx, lines.length * lineHeightPx),
    lines,
    lineHeight,
    lineHeightPx,
  }
}

export function wrapTextToWidth(
  text: string,
  width: number,
  fontSize: number,
  measure: (text: string, fontSize: number) => number = buildMeasure({}),
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.trim()) return ['']

  const lines: string[] = []
  for (const paragraph of normalized.split('\n')) {
    const tokens = tokenizeForWrap(paragraph)
    if (tokens.length === 0) {
      lines.push('')
      continue
    }

    let current = ''
    for (const token of tokens) {
      const next = current ? current + token : token.trimStart()
      if (!current || measure(next, fontSize) <= width) {
        current = next
        continue
      }

      if (current.trim()) lines.push(current.trimEnd())
      if (measure(token, fontSize) <= width) {
        current = token.trimStart()
      } else {
        const forced = breakLongToken(token, width, fontSize, measure)
        lines.push(...forced.slice(0, -1))
        current = forced[forced.length - 1] ?? ''
      }
    }
    if (current || lines.length === 0) lines.push(current.trimEnd())
  }
  return lines.length ? lines : ['']
}

function wrapTextToShape(
  text: string,
  width: number,
  height: number,
  fontSize: number,
  lineHeight: number,
  shape: NormalizedTextBalloonShape,
  measure: (text: string, fontSize: number) => number,
): string[] {
  if (shape === 'box') return wrapTextToWidth(text, width, fontSize, measure)

  const maxLines = Math.max(1, Math.floor(height / Math.max(1, fontSize * lineHeight)))
  const uniformLines = wrapTextToWidth(text, width, fontSize, measure)
  const preferredLineCount = getPreferredShapeLineCount(text, width, height, fontSize, lineHeight, shape, measure)
  let targetLineCount = Math.max(1, Math.min(maxLines, Math.max(uniformLines.length, preferredLineCount)))
  let bestLines = uniformLines

  for (let i = 0; i < 6; i += 1) {
    const lineWidths = buildLineWidths(width, targetLineCount, shape)
    const lines = splitLinesToTarget(
      wrapTextToLineWidths(text, lineWidths, fontSize, measure),
      targetLineCount,
      fontSize,
      measure,
    )
    const actualWidths = buildLineWidths(width, lines.length, shape)
    bestLines = lines
    if (
      lines.length <= maxLines &&
      lines.every((line, index) => measure(line, fontSize) <= actualWidths[index] + 0.5)
    ) {
      return lines
    }
    const nextTargetLineCount = Math.min(maxLines, Math.max(targetLineCount + 1, lines.length))
    if (nextTargetLineCount === targetLineCount) break
    targetLineCount = nextTargetLineCount
  }

  return bestLines
}

function splitLinesToTarget(
  lines: string[],
  targetLineCount: number,
  fontSize: number,
  measure: (text: string, fontSize: number) => number,
): string[] {
  const next = [...lines]
  while (next.length < targetLineCount) {
    const splitIndex = next
      .map((line, index) => ({ index, width: measure(line, fontSize), parts: tokenizeForWrap(line).filter((part) => part.trim()) }))
      .filter((item) => item.parts.length > 1)
      .sort((left, right) => right.width - left.width)[0]?.index
    if (splitIndex === undefined) break

    const split = splitLineNearHalf(next[splitIndex], fontSize, measure)
    if (!split) break
    next.splice(splitIndex, 1, split.left, split.right)
  }
  return next
}

function splitLineNearHalf(
  line: string,
  fontSize: number,
  measure: (text: string, fontSize: number) => number,
): { left: string; right: string } | null {
  const tokens = tokenizeForWrap(line).filter((token) => token.length > 0)
  if (tokens.length <= 1) return null

  const totalWidth = Math.max(1, measure(line, fontSize))
  let bestIndex = -1
  let bestScore = Number.POSITIVE_INFINITY
  let current = ''
  for (let index = 0; index < tokens.length - 1; index += 1) {
    current += tokens[index]
    const left = current.trim()
    const right = tokens.slice(index + 1).join('').trim()
    if (!left || !right) continue
    const score = Math.abs(measure(left, fontSize) - totalWidth / 2)
    if (score < bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  if (bestIndex < 0) return null
  return {
    left: tokens.slice(0, bestIndex + 1).join('').trim(),
    right: tokens.slice(bestIndex + 1).join('').trim(),
  }
}

function wrapTextToLineWidths(
  text: string,
  lineWidths: number[],
  fontSize: number,
  measure: (text: string, fontSize: number) => number,
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.trim()) return ['']

  const lines: string[] = []
  for (const paragraph of normalized.split('\n')) {
    const tokens = tokenizeForWrap(paragraph)
    if (tokens.length === 0) {
      lines.push('')
      continue
    }

    let current = ''
    for (const token of tokens) {
      const width = lineWidths[Math.min(lines.length, lineWidths.length - 1)] ?? lineWidths[0] ?? 1
      const next = current ? current + token : token.trimStart()
      if (!current || measure(next, fontSize) <= width) {
        current = next
        continue
      }

      if (current.trim()) lines.push(current.trimEnd())
      const nextWidth = lineWidths[Math.min(lines.length, lineWidths.length - 1)] ?? width
      if (measure(token, fontSize) <= nextWidth) {
        current = token.trimStart()
      } else {
        const forced = breakLongToken(token, nextWidth, fontSize, measure)
        lines.push(...forced.slice(0, -1))
        current = forced[forced.length - 1] ?? ''
      }
    }
    if (current || lines.length === 0) lines.push(current.trimEnd())
  }
  return lines.length ? lines : ['']
}

function buildLineWidths(width: number, lineCount: number, shape: NormalizedTextBalloonShape): number[] {
  if (shape === 'box' || lineCount <= 1) return Array(Math.max(1, lineCount)).fill(width)

  return Array.from({ length: lineCount }, (_, index) => {
    const normalized = lineCount === 1 ? 0 : (index / (lineCount - 1)) * 2 - 1
    const edgePressure = Math.abs(normalized)
    if (shape === 'cloud') {
      const ratio = Math.max(0.54, Math.sqrt(Math.max(0, 1 - (edgePressure * 0.92) ** 2)) * 0.92)
      return width * ratio
    }

    const ratio = Math.max(0.62, Math.sqrt(Math.max(0, 1 - (edgePressure * 0.78) ** 2)) * 0.96)
    return width * ratio
  })
}

function getLayoutPaddingX(bbox: BoxLike, shape: NormalizedTextBalloonShape): number {
  if (shape === 'box') return Math.max(4, Math.min(14, bbox.width * 0.06))
  if (shape === 'cloud') return Math.max(12, Math.min(36, bbox.width * 0.17))
  return Math.max(10, Math.min(30, bbox.width * 0.145))
}

function getLayoutPaddingY(bbox: BoxLike, shape: NormalizedTextBalloonShape): number {
  if (shape === 'box') return Math.max(3, Math.min(12, bbox.height * 0.08))
  if (shape === 'cloud') return Math.max(8, Math.min(24, bbox.height * 0.16))
  return Math.max(7, Math.min(22, bbox.height * 0.14))
}

function getFitComfortScale(shape: NormalizedTextBalloonShape): number {
  if (shape === 'box') return 0.97
  if (shape === 'cloud') return 0.9
  return 0.92
}

function getPreferredShapeLineCount(
  text: string,
  width: number,
  height: number,
  fontSize: number,
  lineHeight: number,
  shape: NormalizedTextBalloonShape,
  measure: (text: string, fontSize: number) => number,
): number {
  const maxLines = Math.max(1, Math.floor(height / Math.max(1, fontSize * lineHeight)))
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return 1

  const fillRatio = shape === 'cloud' ? 0.58 : 0.64
  const estimated = paragraphs.reduce((sum, paragraph) => {
    const measured = measure(paragraph.replace(/\s+/g, ' '), fontSize)
    return sum + Math.max(1, Math.ceil(measured / Math.max(1, width * fillRatio)))
  }, 0)
  return Math.max(1, Math.min(maxLines, estimated))
}

function normalizeTextLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  return lines.length ? lines : ['']
}

function buildMeasure(options: TextLayoutOptions): (text: string, fontSize: number) => number {
  if (options.measureText) return options.measureText

  const canvas = options.canvas ?? getSharedCanvas()
  const ctx = canvas?.getContext('2d') ?? null
  const fontFamily = options.fontFamily ?? 'sans-serif'
  const fontStyle = options.fontStyle ?? 'normal'
  const fontWeight = options.fontWeight ?? 400
  return (value, fontSize) => {
    if (!value) return 0
    if (ctx) {
      const family = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${family}, sans-serif`
      return ctx.measureText(value).width
    }
    return estimateTextWidthFallback(value, fontSize)
  }
}

function getSharedCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas')
  return sharedCanvas
}

function tokenizeForWrap(paragraph: string): string[] {
  if (!paragraph) return []
  if (segmenter) {
    const tokens = Array.from(segmenter.segment(paragraph), (part) => part.segment)
    if (tokens.length > 0) return tokens
  }
  return Array.from(paragraph)
}

function breakLongToken(
  token: string,
  width: number,
  fontSize: number,
  measure: (text: string, fontSize: number) => number,
): string[] {
  const chunks: string[] = []
  let current = ''
  for (const char of Array.from(token)) {
    const next = current + char
    if (!current || measure(next, fontSize) <= width) {
      current = next
    } else {
      chunks.push(current)
      current = char
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function estimateTextWidthFallback(text: string, fontSize: number): number {
  let units = 0
  for (const char of Array.from(text)) {
    if (/\s/.test(char)) units += 0.28
    else if (/[\u0E00-\u0E7F]/.test(char)) units += 0.62
    else if (/[\u3000-\u9FFF\u3040-\u30FF]/.test(char)) units += 0.95
    else if (/[A-Z0-9]/.test(char)) units += 0.68
    else units += 0.55
  }
  return units * fontSize
}
