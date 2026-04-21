import type { AlbumPage } from '../types/database'

export interface AlbumOpenPlan {
  shouldOpenEditor: boolean
  activePageId: string | null
}

export function getAlbumOpenPlan(pages: AlbumPage[]): AlbumOpenPlan {
  const firstPage = pages[0] ?? null
  return {
    shouldOpenEditor: Boolean(firstPage),
    activePageId: firstPage?.id ?? null,
  }
}
