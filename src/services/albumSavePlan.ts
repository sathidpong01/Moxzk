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

export function getPersistedPageStatus(entry: Pick<ImageEntry, 'cleanedImageUrl' | 'status'>): AlbumPage['status'] {
  if (entry.status === 'error') return 'error'
  if (entry.status === 'clean_done') return 'clean_done'
  if (entry.cleanedImageUrl) return 'translated'
  return 'pending'
}
