import type { BoundingBox, TextLayoutMode } from '../types'

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

export interface InlineTextEditorTheme {
  backgroundColor: string
  textColor: string
  caretColor: string
  textShadow: string
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

export function getInlineTextEditorBboxSize({
  metrics,
  scale,
  minWidth = 20,
  minHeight = 16,
}: InlineTextEditorBboxSizeInput): { width: number; height: number } {
  const denominator = Math.max(0.0001, scale)
  const measuredWidth = metrics.layoutMode === 'artistic'
    ? Math.max(metrics.width, metrics.scrollWidth ?? 0)
    : metrics.width
  const measuredHeight = metrics.layoutMode === 'artistic'
    ? Math.max(metrics.height, metrics.scrollHeight ?? 0)
    : metrics.height
  return {
    width: Math.max(minWidth, measuredWidth / denominator),
    height: Math.max(minHeight, measuredHeight / denominator),
  }
}

export function getTextTransformerAnchors(_layoutMode?: TextLayoutMode): TextTransformerAnchor[] {
  return [...TEXT_TRANSFORMER_ANCHORS]
}

export function getInlineTextEditorTheme(sourceTextColor: string): InlineTextEditorTheme {
  const rgb = parseHexColor(sourceTextColor)
  if (!rgb) {
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      textColor: '#111827',
      caretColor: '#111827',
      textShadow: '0 0 3px rgba(255, 255, 255, 0.95), 0 0 8px rgba(255, 255, 255, 0.65)',
    }
  }

  const luminance = relativeLuminance(rgb)
  if (luminance < 0.45) {
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      textColor: '#111827',
      caretColor: '#111827',
      textShadow: '0 0 3px rgba(255, 255, 255, 0.95), 0 0 8px rgba(255, 255, 255, 0.65)',
    }
  }

  return {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    textColor: '#f9fafb',
    caretColor: '#f9fafb',
    textShadow: '0 0 3px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.65)',
  }
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim()
  const short = trimmed.match(/^#([0-9a-f]{3})$/i)
  if (short) {
    const [r, g, b] = short[1].split('').map((char) => Number.parseInt(char + char, 16))
    return { r, g, b }
  }

  const full = trimmed.match(/^#([0-9a-f]{6})$/i)
  if (!full) return null
  const int = Number.parseInt(full[1], 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}
