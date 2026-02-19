/**
 * Storage Service — handles image upload/download via Supabase Edge Functions → R2
 * with IndexedDB local caching (stale-while-revalidate + LRU eviction).
 *
 * Flow:
 *   Upload: Client → Edge Function (r2-upload) → Cloudflare R2
 *   Download: Check IndexedDB cache → if miss/stale → Edge Function (r2-url) → R2 presigned URL → fetch blob → cache
 */

import { supabase } from '../lib/supabase'
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

/** Generate a storage key for R2: `{userId}/{albumId}/{pageNumber}_{type}.webp` */
export function buildStorageKey(
  userId: string,
  albumId: string,
  pageNumber: number,
  type: 'original' | 'cleaned' | 'thumbnail',
): string {
  return `${userId}/${albumId}/${String(pageNumber).padStart(4, '0')}_${type}.webp`
}

// ── Upload ───────────────────────────────────────────────────────────

interface UploadResult {
  key: string
  size: number
}

/**
 * Upload an image blob to R2 via Supabase Edge Function.
 * Converts to WebP lossless before upload.
 */
export async function uploadImage(
  blob: Blob,
  key: string,
): Promise<UploadResult> {
  const webpBlob = await convertToWebP(blob)

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const supabaseUrl = import.meta.env.MG_PUBLIC_SUPABASE_URL

  const formData = new FormData()
  formData.append('file', webpBlob, key)
  formData.append('key', key)

  const res = await fetch(`${supabaseUrl}/functions/v1/r2-upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Upload failed: ${res.status} ${errorText}`)
  }

  const result = await res.json()

  // Cache locally after successful upload
  await putCache(key, webpBlob)

  return { key: result.key ?? key, size: webpBlob.size }
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

  // 2. Cache miss → fetch from R2 via Edge Function
  const blob = await fetchFromR2(key)
  await putCache(key, blob)
  return URL.createObjectURL(blob)
}

/** Fetch a blob from R2 via the presigned URL Edge Function */
async function fetchFromR2(key: string): Promise<Blob> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const supabaseUrl = import.meta.env.MG_PUBLIC_SUPABASE_URL

  // Get presigned URL
  const res = await fetch(`${supabaseUrl}/functions/v1/r2-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key }),
  })

  if (!res.ok) {
    throw new Error(`Failed to get download URL: ${res.status}`)
  }

  const { url } = await res.json()

  // Fetch the actual blob
  const blobRes = await fetch(url)
  if (!blobRes.ok) throw new Error(`Failed to download image: ${blobRes.status}`)
  return blobRes.blob()
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
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token

  if (token) {
    const supabaseUrl = import.meta.env.MG_PUBLIC_SUPABASE_URL
    // Best-effort delete on R2
    await fetch(`${supabaseUrl}/functions/v1/r2-upload`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    }).catch(() => {})
  }

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
