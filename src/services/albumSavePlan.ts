import type { AlbumPage } from '../types/database'
import type { ImageEntry } from '../types'

export interface AlbumSaveTarget {
  existingPage: AlbumPage | null
  pageNumber: number
}

export function getNextAlbumPageNumber(pages: Pick<AlbumPage, 'page_number'>[]): number {
  if (pages.length === 0) return 1
  return Math.max(...pages.map((page) => page.page_number)) + 1
}

export function resolveAlbumSaveTarget(
  entry: Pick<ImageEntry, 'albumPageId' | 'pageNumber'>,
  pages: AlbumPage[],
  nextPageNumber: number,
  originalHash?: string | null,
): AlbumSaveTarget {
  // Match an existing page by its page id first, then fall back to matching the
  // original image content hash. The hash fallback prevents a freshly imported
  // copy of an image (no albumPageId) from being saved as a duplicate page.
  const existingPage = (entry.albumPageId
    ? pages.find((page) => page.id === entry.albumPageId)
    : undefined)
    ?? (originalHash
      ? pages.find((page) => page.original_hash != null && page.original_hash === originalHash)
      : undefined)
    ?? null

  if (existingPage) {
    return {
      existingPage,
      pageNumber: existingPage.page_number,
    }
  }

  return {
    existingPage: null,
    pageNumber: nextPageNumber,
  }
}

export function getPersistedPageStatus(entry: Pick<ImageEntry, 'status'>): AlbumPage['status'] {
  switch (entry.status) {
    case 'error':
      return 'error'
    case 'clean_done':
      return 'clean_done'
    case 'done':
      return 'translated'
    case 'clean_queued':
    case 'cleaning':
    case 'translate_queued':
    case 'translating':
    case 'processing':
      return 'processing'
    case 'pending':
    default:
      return 'pending'
  }
}
