import type { ImageEntry, TextRegion } from '../types'

export interface OcrReviewSummary {
  total: number
  unknownConfidence: number
  lowConfidence: number
  emptyOriginalText: number
  emptyTranslatedText: number
  needsReview: boolean
}

export interface TranslationReviewSummary extends OcrReviewSummary {
  pages: number
  pagesWithErrors: number
  pagesNotTranslated: number
}

export function getRegionConfidence(region: TextRegion): number | null {
  return typeof region.confidence === 'number' && Number.isFinite(region.confidence)
    ? Math.max(0, Math.min(1, region.confidence))
    : null
}

export function buildOcrReviewSummary(regions: TextRegion[], threshold = 0.7): OcrReviewSummary {
  const summary: OcrReviewSummary = {
    total: regions.length,
    unknownConfidence: 0,
    lowConfidence: 0,
    emptyOriginalText: 0,
    emptyTranslatedText: 0,
    needsReview: false,
  }

  for (const region of regions) {
    const confidence = getRegionConfidence(region)
    if (confidence == null) summary.unknownConfidence += 1
    else if (confidence < threshold) summary.lowConfidence += 1
    if (!region.originalText.trim()) summary.emptyOriginalText += 1
    if (!region.translatedText.trim()) summary.emptyTranslatedText += 1
  }

  summary.needsReview = (
    summary.lowConfidence > 0 ||
    summary.emptyOriginalText > 0 ||
    summary.emptyTranslatedText > 0
  )
  return summary
}

export function buildTranslationReviewSummary(entries: ImageEntry[], threshold = 0.7): TranslationReviewSummary {
  const regions = entries.flatMap((entry) => entry.regions)
  const ocr = buildOcrReviewSummary(regions, threshold)
  return {
    ...ocr,
    pages: entries.length,
    pagesWithErrors: entries.filter((entry) => entry.status === 'error').length,
    pagesNotTranslated: entries.filter((entry) => entry.status !== 'done').length,
    needsReview: ocr.needsReview || entries.some((entry) => entry.status !== 'done'),
  }
}

export function sortRegionsForReview(regions: TextRegion[], threshold = 0.7): TextRegion[] {
  return [...regions].sort((a, b) => reviewRank(a, threshold) - reviewRank(b, threshold))
}

function reviewRank(region: TextRegion, threshold: number): number {
  if (!region.originalText.trim()) return 0
  const confidence = getRegionConfidence(region)
  if (confidence != null && confidence < threshold) return 1
  if (!region.translatedText.trim()) return 2
  if (confidence == null) return 3
  return 4
}
