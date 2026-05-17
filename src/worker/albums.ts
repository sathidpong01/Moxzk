import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import * as schema from './db/schema'
import { json, jsonError, readJson, stringifyJsonInput } from './http'
import type { AuthUser, RequestContext } from './types'

export async function listAlbums(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const rows = await ctx.db.select().from(schema.albums)
    .where(eq(schema.albums.userId, user.id))
    .orderBy(desc(schema.albums.updatedAt))
    .all()
  return json({ data: rows })
}

const FREE_ALBUM_LIMIT = 1
const FREE_PAGE_LIMIT = 50

export async function createAlbum(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const input = await readJson<{ title?: unknown; description?: unknown; sourceLang?: unknown }>(ctx.request)
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return jsonError('VALIDATION_ERROR', 'Album title is required', 422)

  const now = Date.now()
  const row = {
    id: crypto.randomUUID(),
    userId: user.id,
    title,
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null,
    sourceLang: typeof input.sourceLang === 'string' && input.sourceLang.trim() ? input.sourceLang.trim() : 'auto',
    createdAt: now,
    updatedAt: now,
  }

  if (!user.supporterUnlocked) {
    // Atomic: INSERT only if the user is under the free-tier limit.
    // A plain SELECT-then-INSERT check would be vulnerable to a race condition
    // where concurrent requests both pass the count guard before either inserts.
    const result = await ctx.db.run(
      sql`INSERT INTO albums (id, user_id, title, description, source_lang, created_at, updated_at)
          SELECT ${row.id}, ${row.userId}, ${row.title}, ${row.description}, ${row.sourceLang}, ${row.createdAt}, ${row.updatedAt}
          WHERE (SELECT COUNT(*) FROM albums WHERE user_id = ${user.id}) < ${FREE_ALBUM_LIMIT}`
    )
    if (result.meta.changes === 0) {
      return jsonError('FORBIDDEN', `Free accounts are limited to ${FREE_ALBUM_LIMIT} album. Become a Supporter for unlimited albums.`, 403)
    }
  } else {
    await ctx.db.insert(schema.albums).values(row).run()
  }
  return json({ data: row }, 201)
}

export async function updateAlbum(ctx: RequestContext, user: AuthUser, albumId: string): Promise<Response> {
  const album = await getOwnedAlbum(ctx, user.id, albumId)
  if (!album) return jsonError('NOT_FOUND', 'Album not found', 404)
  const input = await readJson<Record<string, unknown>>(ctx.request)
  const updates: Partial<typeof schema.albums.$inferInsert> = { updatedAt: Date.now() }
  if (typeof input.title === 'string') updates.title = input.title.trim()
  if (typeof input.description === 'string' || input.description === null) updates.description = input.description
  if (typeof input.coverKey === 'string' || input.coverKey === null) updates.coverKey = input.coverKey
  if (typeof input.sourceLang === 'string') updates.sourceLang = input.sourceLang.trim()
  await ctx.db.update(schema.albums).set(updates).where(eq(schema.albums.id, album.id)).run()
  return json({ ok: true })
}

export async function deleteAlbum(ctx: RequestContext, user: AuthUser, albumId: string): Promise<Response> {
  const album = await getOwnedAlbum(ctx, user.id, albumId)
  if (!album) return jsonError('NOT_FOUND', 'Album not found', 404)
  const objectRows = await ctx.db.select({ key: schema.objects.key }).from(schema.objects).where(eq(schema.objects.albumId, album.id)).all()
  await Promise.all(objectRows.map((row) => ctx.env.IMAGES.delete(row.key)))
  await ctx.db.delete(schema.albums).where(eq(schema.albums.id, album.id)).run()
  return json({ ok: true })
}

export async function listPages(ctx: RequestContext, user: AuthUser, albumId: string): Promise<Response> {
  const album = await getOwnedAlbum(ctx, user.id, albumId)
  if (!album) return jsonError('NOT_FOUND', 'Album not found', 404)
  const url = new URL(ctx.request.url)
  const summaryOnly = url.searchParams.get('detail') === 'summary'
  if (summaryOnly) {
    const rows = await ctx.db.select({
      id: schema.albumPages.id,
      albumId: schema.albumPages.albumId,
      pageNumber: schema.albumPages.pageNumber,
      originalKey: schema.albumPages.originalKey,
      cleanedKey: schema.albumPages.cleanedKey,
      thumbnailKey: schema.albumPages.thumbnailKey,
      artboardX: schema.albumPages.artboardX,
      artboardY: schema.albumPages.artboardY,
      status: schema.albumPages.status,
      processingMode: schema.albumPages.processingMode,
      errorMessage: schema.albumPages.errorMessage,
      createdAt: schema.albumPages.createdAt,
      updatedAt: schema.albumPages.updatedAt,
    }).from(schema.albumPages)
      .where(eq(schema.albumPages.albumId, album.id))
      .orderBy(schema.albumPages.pageNumber)
      .all()
    return json({
      data: rows.map((row) => ({
        ...row,
        regionsJson: '[]',
        brushStrokesJson: '[]',
      })),
    })
  }

  const rows = await ctx.db.select().from(schema.albumPages)
    .where(eq(schema.albumPages.albumId, album.id))
    .orderBy(schema.albumPages.pageNumber)
    .all()
  return json({ data: rows })
}

export async function createPage(ctx: RequestContext, user: AuthUser, albumId: string): Promise<Response> {
  const album = await getOwnedAlbum(ctx, user.id, albumId)
  if (!album) return jsonError('NOT_FOUND', 'Album not found', 404)
  const input = await readJson<Record<string, unknown>>(ctx.request)
  const pageNumber = Number(input.pageNumber)
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return jsonError('VALIDATION_ERROR', 'Valid pageNumber is required', 422)

  const now = Date.now()
  const row = {
    id: crypto.randomUUID(),
    albumId: album.id,
    pageNumber,
    originalKey: typeof input.originalKey === 'string' ? input.originalKey : null,
    cleanedKey: typeof input.cleanedKey === 'string' ? input.cleanedKey : null,
    thumbnailKey: typeof input.thumbnailKey === 'string' ? input.thumbnailKey : null,
    artboardX: typeof input.artboardX === 'number' && Number.isFinite(input.artboardX) ? Math.round(input.artboardX) : null,
    artboardY: typeof input.artboardY === 'number' && Number.isFinite(input.artboardY) ? Math.round(input.artboardY) : null,
    regionsJson: stringifyJsonInput(input.regions, '[]'),
    brushStrokesJson: stringifyJsonInput(input.brushStrokes, '[]'),
    status: isPageStatus(input.status) ? input.status : 'pending',
    processingMode: isProcessingMode(input.processingMode) ? input.processingMode : 'full',
    errorMessage: typeof input.errorMessage === 'string' ? input.errorMessage : null,
    createdAt: now,
    updatedAt: now,
  }

  if (!user.supporterUnlocked) {
    // Atomic: INSERT only if the album is under the free-tier page limit.
    const result = await ctx.db.run(
      sql`INSERT INTO album_pages (id, album_id, page_number, original_key, cleaned_key, thumbnail_key, artboard_x, artboard_y, regions_json, brush_strokes_json, status, processing_mode, error_message, created_at, updated_at)
          SELECT ${row.id}, ${row.albumId}, ${row.pageNumber}, ${row.originalKey}, ${row.cleanedKey}, ${row.thumbnailKey}, ${row.artboardX}, ${row.artboardY}, ${row.regionsJson}, ${row.brushStrokesJson}, ${row.status}, ${row.processingMode}, ${row.errorMessage}, ${row.createdAt}, ${row.updatedAt}
          WHERE (SELECT COUNT(*) FROM album_pages WHERE album_id = ${album.id}) < ${FREE_PAGE_LIMIT}`
    )
    if (result.meta.changes === 0) {
      return jsonError('FORBIDDEN', `Free accounts are limited to ${FREE_PAGE_LIMIT} pages per album. Become a Supporter for unlimited pages.`, 403)
    }
  } else {
    await ctx.db.insert(schema.albumPages).values(row).run()
  }
  await touchAlbum(ctx, album.id)
  return json({ data: row }, 201)
}

export async function updatePage(ctx: RequestContext, user: AuthUser, pageId: string): Promise<Response> {
  const page = await getOwnedPage(ctx, user.id, pageId)
  if (!page) return jsonError('NOT_FOUND', 'Page not found', 404)
  const input = await readJson<Record<string, unknown>>(ctx.request)
  const updates: Partial<typeof schema.albumPages.$inferInsert> = { updatedAt: Date.now() }
  if (Number.isInteger(input.pageNumber)) updates.pageNumber = Number(input.pageNumber)
  if (typeof input.originalKey === 'string' || input.originalKey === null) updates.originalKey = input.originalKey
  if (typeof input.cleanedKey === 'string' || input.cleanedKey === null) updates.cleanedKey = input.cleanedKey
  if (typeof input.thumbnailKey === 'string' || input.thumbnailKey === null) updates.thumbnailKey = input.thumbnailKey
  if (typeof input.artboardX === 'number' && Number.isFinite(input.artboardX)) updates.artboardX = Math.round(input.artboardX)
  if (input.artboardX === null) updates.artboardX = null
  if (typeof input.artboardY === 'number' && Number.isFinite(input.artboardY)) updates.artboardY = Math.round(input.artboardY)
  if (input.artboardY === null) updates.artboardY = null
  if ('regions' in input) updates.regionsJson = stringifyJsonInput(input.regions, '[]')
  if ('brushStrokes' in input) updates.brushStrokesJson = stringifyJsonInput(input.brushStrokes, '[]')
  if (isPageStatus(input.status)) updates.status = input.status
  if (isProcessingMode(input.processingMode)) updates.processingMode = input.processingMode
  if (typeof input.errorMessage === 'string' || input.errorMessage === null) updates.errorMessage = input.errorMessage
  await ctx.db.update(schema.albumPages).set(updates).where(eq(schema.albumPages.id, page.id)).run()
  await attachPageObjects(ctx, user.id, page.albumId, page.id, [
    updates.originalKey,
    updates.cleanedKey,
    updates.thumbnailKey,
  ])
  await touchAlbum(ctx, page.albumId)
  return json({ ok: true })
}

export async function deletePage(ctx: RequestContext, user: AuthUser, pageId: string): Promise<Response> {
  const page = await getOwnedPage(ctx, user.id, pageId)
  if (!page) return jsonError('NOT_FOUND', 'Page not found', 404)
  const objectRows = await ctx.db.select({ key: schema.objects.key }).from(schema.objects).where(eq(schema.objects.pageId, page.id)).all()
  const keys = new Set([
    ...objectRows.map((row) => row.key),
    page.originalKey,
    page.cleanedKey,
    page.thumbnailKey,
  ].filter(isR2ObjectKey))
  await Promise.all([...keys].map((key) => ctx.env.IMAGES.delete(key)))
  for (const key of keys) {
    await ctx.db.delete(schema.objects).where(and(eq(schema.objects.key, key), eq(schema.objects.userId, user.id))).run()
  }
  await ctx.db.delete(schema.albumPages).where(eq(schema.albumPages.id, page.id)).run()
  await touchAlbum(ctx, page.albumId)
  return json({ ok: true })
}

export async function reorderPages(ctx: RequestContext, user: AuthUser, albumId: string): Promise<Response> {
  const album = await getOwnedAlbum(ctx, user.id, albumId)
  if (!album) return jsonError('NOT_FOUND', 'Album not found', 404)
  const input = await readJson<{ pageIds?: unknown }>(ctx.request)
  if (!Array.isArray(input.pageIds) || input.pageIds.some((id) => typeof id !== 'string')) {
    return jsonError('VALIDATION_ERROR', 'pageIds must be an array of page ids', 422)
  }
  const pageIds = input.pageIds as string[]
  if (pageIds.length === 0) return json({ ok: true })
  const owned = await ctx.db.select({ id: schema.albumPages.id }).from(schema.albumPages)
    .where(and(eq(schema.albumPages.albumId, album.id), inArray(schema.albumPages.id, pageIds)))
    .all()
  if (owned.length !== pageIds.length) return jsonError('FORBIDDEN', 'One or more pages do not belong to this album', 403)
  for (let i = 0; i < pageIds.length; i += 1) {
    await ctx.db.update(schema.albumPages).set({ pageNumber: -(i + 1), updatedAt: Date.now() }).where(eq(schema.albumPages.id, pageIds[i])).run()
  }
  for (let i = 0; i < pageIds.length; i += 1) {
    await ctx.db.update(schema.albumPages).set({ pageNumber: i + 1, updatedAt: Date.now() }).where(eq(schema.albumPages.id, pageIds[i])).run()
  }
  await touchAlbum(ctx, album.id)
  return json({ ok: true })
}

export async function getOwnedAlbum(ctx: RequestContext, userId: string, albumId: string) {
  return ctx.db.select().from(schema.albums).where(and(eq(schema.albums.id, albumId), eq(schema.albums.userId, userId))).get()
}

export async function getOwnedPage(ctx: RequestContext, userId: string, pageId: string) {
  const row = await ctx.db.select({
    id: schema.albumPages.id,
    albumId: schema.albumPages.albumId,
    pageNumber: schema.albumPages.pageNumber,
    originalKey: schema.albumPages.originalKey,
    cleanedKey: schema.albumPages.cleanedKey,
    thumbnailKey: schema.albumPages.thumbnailKey,
    artboardX: schema.albumPages.artboardX,
    artboardY: schema.albumPages.artboardY,
  })
    .from(schema.albumPages)
    .innerJoin(schema.albums, eq(schema.albumPages.albumId, schema.albums.id))
    .where(and(eq(schema.albumPages.id, pageId), eq(schema.albums.userId, userId)))
    .get()
  return row ? {
    id: row.id,
    albumId: row.albumId,
    pageNumber: row.pageNumber,
    originalKey: row.originalKey,
    cleanedKey: row.cleanedKey,
    thumbnailKey: row.thumbnailKey,
  } : null
}

export async function touchAlbum(ctx: RequestContext, albumId: string): Promise<void> {
  await ctx.db.update(schema.albums).set({ updatedAt: Date.now() }).where(eq(schema.albums.id, albumId)).run()
}

function isPageStatus(value: unknown): value is typeof schema.pageStatuses[number] {
  return typeof value === 'string' && (schema.pageStatuses as readonly string[]).includes(value)
}

function isProcessingMode(value: unknown): value is typeof schema.processingModes[number] {
  return typeof value === 'string' && (schema.processingModes as readonly string[]).includes(value)
}

async function attachPageObjects(
  ctx: RequestContext,
  userId: string,
  albumId: string,
  pageId: string,
  keys: unknown[],
): Promise<void> {
  const uniqueKeys = [...new Set(keys.filter(isR2ObjectKey))]
  for (const key of uniqueKeys) {
    await ctx.db.update(schema.objects)
      .set({ pageId })
      .where(and(eq(schema.objects.key, key), eq(schema.objects.userId, userId), eq(schema.objects.albumId, albumId)))
      .run()
  }
}

function isR2ObjectKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith('users/') && key.length <= 1024
}
