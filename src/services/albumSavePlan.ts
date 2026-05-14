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
): AlbumSaveTarget {
  const existingPage = entry.albumPageId
    ? pages.find((page) => page.id === entry.albumPageId) ?? null
    : null

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
