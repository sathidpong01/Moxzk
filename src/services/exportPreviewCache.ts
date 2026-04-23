import type { ExportFormat } from '../types'

export interface ExportPreviewCacheSnapshot {
  cacheKey: string | null
  renderedUrls: Record<string, string>
  renderedErrors: Record<string, string>
}

export interface ExportPreviewCacheResolution {
  cacheKey: string | null
  renderedUrls: Record<string, string>
  renderedErrors: Record<string, string>
  shouldReset: boolean
}

export function createExportPreviewCacheKey(format: ExportFormat, quality: number): string {
  return `${format}:${quality}`
}

export function reconcileExportPreviewCache(
  current: ExportPreviewCacheSnapshot,
  nextCacheKey: string | null,
): ExportPreviewCacheResolution {
  if (current.cacheKey === nextCacheKey) {
    return {
      cacheKey: current.cacheKey,
      renderedUrls: current.renderedUrls,
      renderedErrors: current.renderedErrors,
      shouldReset: false,
    }
  }

  return {
    cacheKey: nextCacheKey,
    renderedUrls: {},
    renderedErrors: {},
    shouldReset: true,
  }
}
