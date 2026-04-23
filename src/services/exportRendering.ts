import type { ImageEntry, TextRegion } from '../types'
import { resolveRegionFont } from '../config/fonts'
import {
  layoutTextInBox,
  normalizeTextAlign,
  normalizeTextLayoutMode,
  wrapTextToWidth,
} from '../utils/textLayout'
import { downloadImage } from './storageService'

interface ResolvedExportImageSource {
  src: string
  revokeAfterUse: boolean
}

export interface ExportTextRegionLayout {
  mode: 'balloon_fit' | 'artistic'
  lines: string[]
  fontSize: number
  lineHeightPx: number
  textAlign: ReturnType<typeof normalizeTextAlign>
  startX: number
  startY: number
  paddingX: number
  paddingY: number
  innerWidth: number
  scaleX: number
  scaleY: number
}

export async function resolveImageEntryExportSource(
  entry: Pick<ImageEntry, 'cleanedImageUrl' | 'originalUrl' | 'cleanedR2Key' | 'originalR2Key' | 'imageLoaded'>,
  download: (key: string) => Promise<string> = downloadImage,
): Promise<ResolvedExportImageSource> {
  if (entry.cleanedImageUrl) {
    return { src: entry.cleanedImageUrl, revokeAfterUse: false }
  }
  if (entry.imageLoaded !== false && entry.originalUrl) {
    return { src: entry.originalUrl, revokeAfterUse: false }
  }
  if (entry.cleanedR2Key) {
    return { src: await download(entry.cleanedR2Key), revokeAfterUse: true }
  }
  if (entry.originalR2Key) {
    return { src: await download(entry.originalR2Key), revokeAfterUse: true }
  }
  if (entry.originalUrl) {
    return { src: entry.originalUrl, revokeAfterUse: false }
  }
  throw new Error('ไม่มีภาพต้นฉบับสำหรับ export')
}

export function getExportTextRegionLayout(
  region: TextRegion,
  measureText?: (text: string, fontSize: number) => number,
): ExportTextRegionLayout | null {
  const text = region.translatedText || ''
  if (!text.trim()) return null

  const font = resolveRegionFont(region)
  const textAlign = normalizeTextAlign(region.textAlign)
  const weight = font.weight >= 700 ? '700' : '400'
  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)

  if (layoutMode === 'artistic') {
    const fontSize = Math.max(8, region.fontSize)
    const scaleX = region.textScaleX ?? 1
    const scaleY = region.textScaleY ?? 1
    const innerWidth = region.bbox.width / Math.max(0.0001, Math.abs(scaleX))
    const lines = wrapTextToWidth(text, innerWidth, fontSize, measureText)
    return {
      mode: 'artistic',
      lines,
      fontSize,
      lineHeightPx: fontSize * 1.18,
      textAlign,
      startX: textAlign === 'left'
        ? 0
        : textAlign === 'right'
          ? innerWidth
          : innerWidth / 2,
      startY: 0,
      paddingX: 0,
      paddingY: 0,
      innerWidth,
      scaleX,
      scaleY,
    }
  }

  const layout = layoutTextInBox(text, region.bbox, region.fontSize, {
    fontFamily: font.family,
    fontWeight: weight,
    fontStyle: font.style,
    measureText,
  })
  const availableHeight = Math.max(0, region.bbox.height - layout.paddingY * 2)
  return {
    mode: 'balloon_fit',
    lines: layout.lines,
    fontSize: layout.fontSize,
    lineHeightPx: layout.lineHeightPx,
    textAlign,
    startX: textAlign === 'left'
      ? layout.paddingX
      : textAlign === 'right'
        ? region.bbox.width - layout.paddingX
        : region.bbox.width / 2,
    startY: layout.paddingY + Math.max(0, (availableHeight - layout.contentHeight) / 2),
    paddingX: layout.paddingX,
    paddingY: layout.paddingY,
    innerWidth: Math.max(1, region.bbox.width - layout.paddingX * 2),
    scaleX: 1,
    scaleY: 1,
  }
}
