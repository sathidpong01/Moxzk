import { and, eq } from 'drizzle-orm'
import { getOwnedAlbum, getOwnedPage } from './albums'
import * as schema from './db/schema'
import { json, jsonError } from './http'
import type { AuthUser, RequestContext } from './types'

export async function uploadObject(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const form = await ctx.request.formData()
  const file = form.get('file')
  const albumId = form.get('albumId')
  const pageId = form.get('pageId')
  const pageNumberRaw = form.get('pageNumber')
  const kindRaw = form.get('kind')

  if (!(file instanceof File)) return jsonError('VALIDATION_ERROR', 'file is required', 422)
  if (typeof albumId !== 'string') return jsonError('VALIDATION_ERROR', 'albumId is required', 422)
  if (!isObjectKind(kindRaw)) return jsonError('VALIDATION_ERROR', 'kind is invalid', 422)

  const album = await getOwnedAlbum(ctx, user.id, albumId)
  if (!album) return jsonError('NOT_FOUND', 'Album not found', 404)

  const pageNumber = Number(pageNumberRaw)
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return jsonError('VALIDATION_ERROR', 'pageNumber is required', 422)

  let ownedPage: Awaited<ReturnType<typeof getOwnedPage>> = null
  if (typeof pageId === 'string' && pageId) {
    ownedPage = await getOwnedPage(ctx, user.id, pageId)
    if (!ownedPage || ownedPage.albumId !== album.id) return jsonError('FORBIDDEN', 'Page does not belong to this album', 403)
  }

  const key = `users/${user.id}/albums/${album.id}/${String(pageNumber).padStart(4, '0')}_${kindRaw}.webp`
  const contentType = file.type || 'image/webp'
  await ctx.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType } })

  const now = Date.now()
  await ctx.db.insert(schema.objects).values({
    key,
    userId: user.id,
    albumId: album.id,
    pageId: ownedPage?.id ?? null,
    kind: kindRaw,
    contentType,
    sizeBytes: file.size,
    createdAt: now,
  }).onConflictDoUpdate({
    target: schema.objects.key,
    set: {
      userId: user.id,
      albumId: album.id,
      pageId: ownedPage?.id ?? null,
      kind: kindRaw,
      contentType,
      sizeBytes: file.size,
      createdAt: now,
    },
  }).run()

  if (ownedPage) {
    const update = objectKindPageUpdate(kindRaw, key)
    if (update) {
      await ctx.db.update(schema.albumPages).set({ ...update, updatedAt: now }).where(eq(schema.albumPages.id, ownedPage.id)).run()
    }
  }

  return json({ key, size: file.size })
}

export async function getObject(ctx: RequestContext, user: AuthUser, key: string): Promise<Response> {
  const object = await ctx.db.select().from(schema.objects).where(and(eq(schema.objects.key, key), eq(schema.objects.userId, user.id))).get()
  if (!object) return jsonError('NOT_FOUND', 'Object not found', 404)
  const r2Object = await ctx.env.IMAGES.get(key)
  if (!r2Object) return jsonError('NOT_FOUND', 'Object blob not found', 404)
  return new Response(r2Object.body, {
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

export async function deleteObject(ctx: RequestContext, user: AuthUser, key: string): Promise<Response> {
  const object = await ctx.db.select().from(schema.objects).where(and(eq(schema.objects.key, key), eq(schema.objects.userId, user.id))).get()
  if (!object) return jsonError('NOT_FOUND', 'Object not found', 404)
  await ctx.env.IMAGES.delete(key)
  await ctx.db.delete(schema.objects).where(eq(schema.objects.key, key)).run()
  return json({ ok: true })
}

function isObjectKind(value: unknown): value is typeof schema.objectKinds[number] {
  return typeof value === 'string' && (schema.objectKinds as readonly string[]).includes(value)
}

function objectKindPageUpdate(kind: typeof schema.objectKinds[number], key: string): Partial<typeof schema.albumPages.$inferInsert> | null {
  if (kind === 'original') return { originalKey: key }
  if (kind === 'cleaned') return { cleanedKey: key }
  if (kind === 'thumbnail') return { thumbnailKey: key }
  return null
}
