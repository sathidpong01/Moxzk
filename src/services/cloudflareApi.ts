import type { Album, AlbumPage, Profile } from '../types/database'

export function getCloudflareApiBase(): string {
  const configuredBaseUrl = (import.meta.env.VITE_CLOUDFLARE_API_URL || '').trim().replace(/\/+$/, '')
  if (import.meta.env.DEV) return ''
  if (isElectronRenderer() && !configuredBaseUrl) {
    throw new Error('Set VITE_CLOUDFLARE_API_URL for Electron production builds.')
  }
  return configuredBaseUrl
}

export interface AppUser {
  id: string
  email: string
  emailNormalized: string
  user_metadata?: {
    name?: string
    full_name?: string
    avatar_url?: string
    picture?: string
  }
}

export interface AppSession {
  user: AppUser
}

interface ApiUser {
  id: string
  email: string
  emailNormalized: string
  username: string | null
  avatarUrl: string | null
  plan: 'free' | 'pro' | 'team'
}

interface ApiAlbum {
  id: string
  userId: string
  title: string
  description: string | null
  coverKey: string | null
  sourceLang: string
  createdAt: number
  updatedAt: number
}

interface ApiPage {
  id: string
  albumId: string
  pageNumber: number
  originalKey: string | null
  cleanedKey: string | null
  thumbnailKey: string | null
  artboardX: number | null
  artboardY: number | null
  regionsJson?: string
  brushStrokesJson?: string
  status: AlbumPage['status']
  processingMode: AlbumPage['processing_mode']
  errorMessage: string | null
  createdAt: number
  updatedAt: number
}

export class CloudflareApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'CloudflareApiError'
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const hasBody = init.body !== undefined && init.body !== null
  if (hasBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${getCloudflareApiBase()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    let code = 'HTTP_ERROR'
    let message = `Request failed with status ${response.status}`
    try {
      const payload = await response.json() as { error?: { code?: string; message?: string } }
      code = payload.error?.code || code
      message = payload.error?.message || message
    } catch {
      // Keep the status-based fallback.
    }
    throw new CloudflareApiError(response.status, code, message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && Boolean(window.moxzkRuntime ?? window.mgRuntime)
}

export async function registerWithEmail(email: string, password: string, username?: string): Promise<{ user: AppUser; profile: Profile; session: AppSession }> {
  const { user } = await apiFetch<{ user: ApiUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  })
  return authPayload(user)
}

export async function loginWithEmail(email: string, password: string): Promise<{ user: AppUser; profile: Profile; session: AppSession }> {
  const { user } = await apiFetch<{ user: ApiUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return authPayload(user)
}

export async function getCurrentUser(): Promise<{ user: AppUser; profile: Profile; session: AppSession } | null> {
  const { user } = await apiFetch<{ user: ApiUser | null }>('/api/auth/me')
  if (!user) return null
  return authPayload(user)
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' })
}

export async function getGoogleRedirectUrl(redirectTarget = `${window.location.origin}/auth/callback`): Promise<string> {
  const params = new URLSearchParams({ redirectTarget })
  const { redirectUrl } = await apiFetch<{ redirectUrl: string }>(`/api/auth/google/start?${params.toString()}`)
  return redirectUrl
}

export async function fetchAlbums(): Promise<Album[]> {
  const { data } = await apiFetch<{ data: ApiAlbum[] }>('/api/albums')
  return data.map(toAlbum)
}

export async function createAlbum(input: { title: string; description?: string; sourceLang?: string }): Promise<Album> {
  const { data } = await apiFetch<{ data: ApiAlbum }>('/api/albums', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return toAlbum(data)
}

export async function updateAlbum(id: string, updates: Partial<Pick<Album, 'title' | 'description' | 'cover_key' | 'source_lang'>>): Promise<void> {
  await apiFetch(`/api/albums/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: updates.title,
      description: updates.description,
      coverKey: updates.cover_key,
      sourceLang: updates.source_lang,
    }),
  })
}

export async function deleteAlbum(id: string): Promise<void> {
  await apiFetch(`/api/albums/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function fetchPages(albumId: string): Promise<AlbumPage[]> {
  const { data } = await apiFetch<{ data: ApiPage[] }>(`/api/albums/${encodeURIComponent(albumId)}/pages`)
  return data.map(toPage)
}

export async function fetchPageSummaries(albumId: string): Promise<AlbumPage[]> {
  const params = new URLSearchParams({ detail: 'summary' })
  const { data } = await apiFetch<{ data: ApiPage[] }>(`/api/albums/${encodeURIComponent(albumId)}/pages?${params.toString()}`)
  return data.map(toPage)
}

export async function createPage(albumId: string, input: { pageNumber: number }): Promise<AlbumPage> {
  const { data } = await apiFetch<{ data: ApiPage }>(`/api/albums/${encodeURIComponent(albumId)}/pages`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return toPage(data)
}

export async function updatePage(
  pageId: string,
  updates: Partial<Pick<AlbumPage, 'page_number' | 'original_key' | 'cleaned_key' | 'thumbnail_key' | 'artboard_x' | 'artboard_y' | 'regions' | 'brush_strokes' | 'status' | 'processing_mode' | 'error_message'>>,
): Promise<void> {
  await apiFetch(`/api/pages/${encodeURIComponent(pageId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      pageNumber: updates.page_number,
      originalKey: updates.original_key,
      cleanedKey: updates.cleaned_key,
      thumbnailKey: updates.thumbnail_key,
      artboardX: updates.artboard_x,
      artboardY: updates.artboard_y,
      regions: updates.regions,
      brushStrokes: updates.brush_strokes,
      status: updates.status,
      processingMode: updates.processing_mode,
      errorMessage: updates.error_message,
    }),
  })
}

export async function deletePage(pageId: string): Promise<void> {
  await apiFetch(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' })
}

export async function reorderPages(albumId: string, pageIds: string[]): Promise<void> {
  await apiFetch(`/api/albums/${encodeURIComponent(albumId)}/pages/reorder`, {
    method: 'POST',
    body: JSON.stringify({ pageIds }),
  })
}

function authPayload(user: ApiUser): { user: AppUser; profile: Profile; session: AppSession } {
  const appUser: AppUser = {
    id: user.id,
    email: user.email,
    emailNormalized: user.emailNormalized,
    user_metadata: {
      name: user.username || user.email.split('@')[0],
      full_name: user.username || user.email.split('@')[0],
      avatar_url: user.avatarUrl || undefined,
      picture: user.avatarUrl || undefined,
    },
  }
  return {
    user: appUser,
    profile: {
      id: user.id,
      username: user.username,
      avatar_url: user.avatarUrl,
      plan: user.plan,
      created_at: '',
      updated_at: '',
    },
    session: { user: appUser },
  }
}

function toAlbum(row: ApiAlbum): Album {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    description: row.description,
    cover_key: row.coverKey,
    source_lang: row.sourceLang,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  }
}

function toPage(row: ApiPage): AlbumPage {
  return {
    id: row.id,
    album_id: row.albumId,
    page_number: row.pageNumber,
    original_key: row.originalKey,
    cleaned_key: row.cleanedKey,
    thumbnail_key: row.thumbnailKey,
    artboard_x: row.artboardX,
    artboard_y: row.artboardY,
    regions: parseJson(row.regionsJson ?? '[]', []),
    brush_strokes: parseJson(row.brushStrokesJson ?? '[]', []),
    status: row.status,
    processing_mode: row.processingMode,
    error_message: row.errorMessage,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  }
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function toIso(value: number): string {
  return new Date(value).toISOString()
}
