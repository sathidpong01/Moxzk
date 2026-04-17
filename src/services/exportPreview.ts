import type { ImageEntry } from '../types'

type ExportPreviewEntry = Pick<ImageEntry, 'id' | 'cleanedImageUrl' | 'originalUrl'>

export function getExportPreviewUrl(entry: ExportPreviewEntry): string | null {
  return entry.cleanedImageUrl || entry.originalUrl || null
}

export function getExportCompareOriginalUrl(entry: ExportPreviewEntry): string | null {
  return entry.originalUrl || null
}

export function getExportThumbnailUrl(
  entry: ExportPreviewEntry,
  renderedUrls: Record<string, string>,
): string | null {
  return renderedUrls[entry.id] || getExportPreviewUrl(entry)
}

export function getNextExportPreviewId(
  selectedEntries: Array<Pick<ImageEntry, 'id'>>,
  currentId: string | null,
): string | null {
  if (selectedEntries.length === 0) return null
  if (currentId && selectedEntries.some((entry) => entry.id === currentId)) return currentId
  return selectedEntries[0].id
}
