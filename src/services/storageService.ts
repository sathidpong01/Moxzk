/**
 * Storage Service — handles image upload/download via the Cloudflare Worker → R2
 * with IndexedDB local caching (stale-while-revalidate + LRU eviction).
 *
 * Flow:
 *   Upload: Client → Worker API → Cloudflare R2
 *   Download: Check IndexedDB cache → if miss/stale → Worker API → R2 stream → cache
 */

import { apiFetch, getCloudflareApiBase } from './cloudflareApi'
import { getCached, putCache, isStale, removeCache } from './imageCache'

// ── Helpers ──────────────────────────────────────────────────────────

/** Convert any image blob to WebP lossless before upload */
export async function convertToWebP(blob: Blob): Promise<Blob> {
  // If already WebP, skip
  if (blob.type === 'image/webp') return blob

  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 1.0 })
  return webpBlob
}

/** Generate a storage key for R2: `users/{userId}/albums/{albumId}/{pageNumber}_{type}.webp` */
export function buildStorageKey(
  userId: string,
  albumId: string,
  pageNumber: number,
  type: 'original' | 'cleaned' | 'thumbnail',
): string {
  return `users/${userId}/albums/${albumId}/${String(pageNumber).padStart(4, '0')}_${type}.webp`
}

// ── Upload ───────────────────────────────────────────────────────────

export interface PreparedImageUpload {
  blob: Blob
  sha256: string
  size: number
}

interface UploadResult {
  key: string
  size: number
  sha256: string
  skipped: boolean
}

export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function prepareImageUpload(blob: Blob): Promise<PreparedImageUpload> {
  const webpBlob = await convertToWebP(blob)
  return {
    blob: webpBlob,
    sha256: await hashBlob(webpBlob),
    size: webpBlob.size,
  }
}

/**
 * Upload an image blob to R2 via the Cloudflare Worker.
 * Converts to WebP lossless before upload.
 */
export async function uploadImage(
  blob: Blob,
  key: string,
): Promise<UploadResult> {
  return uploadPreparedImage(await prepareImageUpload(blob), key)
}

export async function uploadPreparedImage(
  prepared: PreparedImageUpload,
  key: string,
): Promise<UploadResult> {
  const keyParts = parseStorageKey(key)

  const formData = new FormData()
  formData.append('file', prepared.blob, key)
  formData.append('albumId', keyParts.albumId)
  formData.append('pageNumber', String(keyParts.pageNumber))
  formData.append('kind', keyParts.kind)
  formData.append('sha256', prepared.sha256)

  const result = await apiFetch<UploadResult>('/api/storage/upload', {
    method: 'POST',
    body: formData,
  })

  // Cache locally after successful upload
  await putCache(key, prepared.blob)

  return {
    key: result.key ?? key,
    size: result.size ?? prepared.size,
    sha256: result.sha256 ?? prepared.sha256,
    skipped: Boolean(result.skipped),
  }
}

// ── Download ─────────────────────────────────────────────────────────

/**
 * Download an image by R2 key.
 * Uses stale-while-revalidate: returns cache immediately, refreshes in background if stale.
 */
export async function downloadImage(key: string): Promise<string> {
  // 1. Check IndexedDB cache
  const cached = await getCached(key)
  if (cached) {
    const stale = await isStale(key)
    const url = URL.createObjectURL(cached)

    if (stale) {
      // Revalidate in background (don't block)
      revalidateInBackground(key).catch(() => {})
    }

    return url
  }

  // 2. Cache miss → fetch from R2 via Worker API
  const blob = await fetchFromR2(key)
  await putCache(key, blob)
  return URL.createObjectURL(blob)
}

/** Fetch a blob from R2 via the Worker API */
async function fetchFromR2(key: string): Promise<Blob> {
  const apiBase = getCloudflareApiBase()
  const response = await fetch(`${apiBase}/api/storage/object/${encodeURIComponent(key)}`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)
  return response.blob()
}

/** Background revalidation — re-fetch and update cache silently */
async function revalidateInBackground(key: string): Promise<void> {
  try {
    const blob = await fetchFromR2(key)
    await putCache(key, blob)
  } catch (e) {
    console.warn('[storage] Background revalidation failed for', key, e)
  }
}

// ── Delete ───────────────────────────────────────────────────────────

/** Delete an image from R2 and local cache */
export async function deleteImage(key: string): Promise<void> {
  await apiFetch(`/api/storage/object/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {})

  // Always remove from local cache
  await removeCache(key)
}

// ── Blob utilities ───────────────────────────────────────────────────

/** Convert a File to a Blob (passthrough, typed convenience) */
export function fileToBlob(file: File): Blob {
  return file as Blob
}

/** Convert a data URL to Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/png'
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** Convert a data URL, blob URL, or remote image URL into a Blob. */
export async function imageUrlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) return dataUrlToBlob(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to read image URL: ${response.status}`)
  return response.blob()
}

/** Generate a small thumbnail blob (max 200px) from a source blob */
export async function generateThumbnail(source: Blob, maxSize = 200): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1)
  const w = Math.round(bitmap.width * ratio)
  const h = Math.round(bitmap.height * ratio)

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
}

function parseStorageKey(key: string): {
  albumId: string
  pageNumber: number
  kind: 'original' | 'cleaned' | 'thumbnail'
} {
  const match = key.match(/^users\/[^/]+\/albums\/([^/]+)\/(\d+)_(original|cleaned|thumbnail)\.webp$/)
  if (!match?.[1] || !match[2] || !match[3]) throw new Error(`Invalid storage key: ${key}`)
  return {
    albumId: match[1],
    pageNumber: Number(match[2]),
    kind: match[3] as 'original' | 'cleaned' | 'thumbnail',
  }
}
