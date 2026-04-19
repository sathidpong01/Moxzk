interface BoxLike {
  width: number
  height: number
}

export type NormalizedTextLayoutMode = 'balloon_fit' | 'artistic'

export interface TextLayoutOptions {
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  lineHeight?: number
  minFontSize?: number
  maxFontSize?: number
  paddingX?: number
  paddingY?: number
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
  overflow: boolean
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

export function normalizeTextLayoutMode(mode?: string): NormalizedTextLayoutMode {
  return mode === 'artistic' ? 'artistic' : 'balloon_fit'
}

export function layoutTextInBox(
  text: string,
  bbox: BoxLike,
  preferredFontSize: number,
  options: TextLayoutOptions = {},
): TextLayoutResult {
  const lineHeight = options.lineHeight ?? 1.18
  const paddingX = options.paddingX ?? Math.max(4, Math.min(14, bbox.width * 0.06))
  const paddingY = options.paddingY ?? Math.max(3, Math.min(12, bbox.height * 0.08))
  const availableWidth = Math.max(1, bbox.width - paddingX * 2)
  const availableHeight = Math.max(1, bbox.height - paddingY * 2)
  const minFontSize = Math.max(6, options.minFontSize ?? 8)
  const maxFontSize = Math.max(minFontSize, options.maxFontSize ?? 72)
  const preferred = Number.isFinite(preferredFontSize) ? preferredFontSize : 18
  const upperBound = Math.min(maxFontSize, Math.max(minFontSize, preferred), availableHeight * 0.82)

  const measure = buildMeasure(options)
  let low = minFontSize
  let high = Math.max(minFontSize, upperBound)
  let best = minFontSize
  let bestLines = wrapTextToWidth(text, availableWidth, minFontSize, measure)

  for (let i = 0; i < 12; i += 1) {
    const size = (low + high) / 2
    const lines = wrapTextToWidth(text, availableWidth, size, measure)
    const contentHeight = lines.length * size * lineHeight
    if (contentHeight <= availableHeight && lines.every((line) => measure(line, size) <= availableWidth + 0.5)) {
      best = size
      bestLines = lines
      low = size
    } else {
      high = size
    }
  }

  const fontSize = Math.max(minFontSize, Math.floor(best * 10) / 10)
  const lines = wrapTextToWidth(text, availableWidth, fontSize, measure)
  const lineHeightPx = fontSize * lineHeight
  const contentHeight = lines.length * lineHeightPx
  const overflow = contentHeight > availableHeight + 0.5 ||
    lines.some((line) => measure(line, fontSize) > availableWidth + 0.5)

  return {
    fontSize,
    lines: lines.length ? lines : bestLines,
    lineHeight,
    lineHeightPx,
    contentHeight,
    paddingX,
    paddingY,
    overflow,
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

export function estimateWrappedLineCount(text: string, width: number, fontSize: number): number {
  return wrapTextToWidth(text, width, fontSize, buildMeasure({})).length
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
