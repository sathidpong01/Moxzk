interface BoxLike {
  width: number
  height: number
}

export type NormalizedTextLayoutMode = 'balloon_fit' | 'artistic'

export function normalizeTextLayoutMode(mode?: string): NormalizedTextLayoutMode {
  return mode === 'artistic' ? 'artistic' : 'balloon_fit'
}

export function calculateBalloonFitFontSize(
  text: string,
  bbox: BoxLike,
  preferredFontSize: number,
): number {
  if (bbox.width <= 0 || bbox.height <= 0) return Math.max(8, Math.round(preferredFontSize || 14))

  const content = text.trim() || ' '
  const paddingX = Math.max(4, Math.min(14, bbox.width * 0.06))
  const paddingY = Math.max(3, Math.min(12, bbox.height * 0.08))
  const availableWidth = Math.max(1, bbox.width - paddingX * 2)
  const availableHeight = Math.max(1, bbox.height - paddingY * 2)
  const lineHeight = 1.18
  const preferred = Number.isFinite(preferredFontSize) ? preferredFontSize : 18
  let size = Math.min(72, Math.max(8, preferred), availableHeight * 0.82)

  while (size > 8) {
    const lines = estimateWrappedLineCount(content, availableWidth, size)
    if (lines * size * lineHeight <= availableHeight) break
    size -= 0.5
  }

  return Math.max(8, Math.round(size))
}

export function estimateWrappedLineCount(text: string, width: number, fontSize: number): number {
  if (!text.trim()) return 1
  const averageGlyphWidth = fontSize * 0.62
  const charsPerLine = Math.max(1, Math.floor(width / Math.max(1, averageGlyphWidth)))

  return text
    .split(/\r?\n/)
    .reduce((lines, paragraph) => lines + Math.max(1, Math.ceil([...paragraph].length / charsPerLine)), 0)
}
