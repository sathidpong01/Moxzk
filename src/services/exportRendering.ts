import type { ImageEntry, TextRegion } from '../types'
import { resolveRegionFont } from '../config/fonts'
import {
  getRegionTextLayout,
  type TextOverflowReason,
  type NormalizedTextArtisticFit,
  type NormalizedTextBalloonShape,
  normalizeTextAlign,
} from '../utils/textLayout'
import { downloadImage } from './storageService'

interface ResolvedExportImageSource {
  src: string
  revokeAfterUse: boolean
}

export interface ExportTextRegionLayout {
  mode: 'balloon_fit' | 'artistic'
  balloonShape: NormalizedTextBalloonShape
  artisticFit: NormalizedTextArtisticFit
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
  overflow: boolean
  overflowReason?: TextOverflowReason
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
  const layout = getRegionTextLayout(region, text, {
    fontFamily: font.family,
    fontWeight: weight,
    fontStyle: font.style,
    measureText,
  })
  return {
    mode: layout.mode,
    balloonShape: layout.balloonShape,
    artisticFit: layout.artisticFit,
    lines: layout.lines,
    fontSize: layout.fontSize,
    lineHeightPx: layout.lineHeightPx,
    textAlign,
    startX: layout.startX,
    startY: layout.startY,
    paddingX: layout.paddingX,
    paddingY: layout.paddingY,
    innerWidth: layout.innerWidth,
    scaleX: layout.scaleX,
    scaleY: layout.scaleY,
    overflow: layout.overflow,
    overflowReason: layout.overflowReason,
  }
}
