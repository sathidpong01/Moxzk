import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import * as schema from './db/schema'
import { hashPassword, hashToken, optionalHash, passwordParamsJson, verifyPassword } from './crypto'
import { expireSessionCookies, readSessionToken } from './auth'
import { json, jsonError, normalizeEmail, parsePassword, readJson } from './http'
import { recordSecurityEvent } from './security'
import type { AuthUser, RequestContext } from './types'

export async function getProfile(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const [identities, sessionRows, albumSummaries] = await Promise.all([
    listIdentities(ctx, user.id),
    listSessions(ctx, user.id),
    listAlbumSummaries(ctx, user.id),
  ])
  const objectUsage = await getObjectUsage(ctx, user.id)
  const currentTokenHash = await getCurrentSessionTokenHash(ctx)
  return json({
    user,
    identities: identities.map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      email: identity.email,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    })),
    sessions: sessionRows.map((session) => ({
      id: session.id,
      current: Boolean(currentTokenHash && session.tokenHash === currentTokenHash),
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    })),
    albums: albumSummaries,
    usage: {
      albumCount: albumSummaries.length,
      pageCount: albumSummaries.reduce((total, album) => total + album.pageCount, 0),
      objectCount: objectUsage.objectCount,
      storageBytes: objectUsage.storageBytes,
    },
  })
}

export async function updateProfile(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const input = await readJson<{ username?: unknown; avatarUrl?: unknown }>(ctx.request)
  const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: Date.now() }

  if ('username' in input) {
    if (input.username === null || input.username === '') {
      updates.username = null
    } else if (typeof input.username === 'string' && isValidUsername(input.username.trim())) {
      const username = input.username.trim()
      const existing = await ctx.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).get()
      if (existing && existing.id !== user.id) return jsonError('CONFLICT', 'Username is already taken', 409)
      updates.username = username
    } else {
      return jsonError('VALIDATION_ERROR', 'Username must be 3-40 letters, numbers, underscores, or hyphens', 422)
    }
  }

  if ('avatarUrl' in input) {
    if (input.avatarUrl === null || input.avatarUrl === '') {
      updates.avatarUrl = null
    } else if (typeof input.avatarUrl === 'string' && isAllowedAvatarUrl(input.avatarUrl)) {
      updates.avatarUrl = input.avatarUrl.trim()
    } else {
      return jsonError('VALIDATION_ERROR', 'Avatar URL must be an http, https, or data image URL', 422)
    }
  }

  await ctx.db.update(schema.users).set(updates).where(eq(schema.users.id, user.id)).run()
  await recordSecurityEvent(ctx, 'profile_updated', await requestProtection(ctx), { userId: user.id })
  const updated = await ctx.db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()
  return json({ user: updated ? publicUserFromRow(updated) : user })
}

export async function changePassword(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const input = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(ctx.request)
  const newPassword = parsePassword(input.newPassword)
  if (!newPassword) return jsonError('VALIDATION_ERROR', 'New password must be at least 8 characters', 422)

  const existingIdentity = await ctx.db.select().from(schema.authIdentities)
    .where(and(eq(schema.authIdentities.userId, user.id), eq(schema.authIdentities.provider, 'password')))
    .get()

  if (existingIdentity?.credentialHash && existingIdentity.credentialSalt) {
    const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : ''
    const valid = await verifyPassword(currentPassword, existingIdentity.credentialSalt, existingIdentity.credentialHash)
    if (!valid) return jsonError('UNAUTHORIZED', 'Current password is invalid', 401)
  }

  const now = Date.now()
  const passwordRecord = await hashPassword(newPassword)
  if (existingIdentity) {
    await ctx.db.update(schema.authIdentities).set({
      credentialHash: passwordRecord.hash,
      credentialSalt: passwordRecord.salt,
      credentialAlgo: 'PBKDF2_SHA256',
      credentialParamsJson: passwordParamsJson(),
      updatedAt: now,
    }).where(eq(schema.authIdentities.id, existingIdentity.id)).run()
  } else {
    await ctx.db.insert(schema.authIdentities).values({
      id: crypto.randomUUID(),
      userId: user.id,
      provider: 'password',
      providerSubject: normalizeEmail(user.email),
      email: user.email,
      emailNormalized: normalizeEmail(user.email),
      credentialHash: passwordRecord.hash,
      credentialSalt: passwordRecord.salt,
      credentialAlgo: 'PBKDF2_SHA256',
      credentialParamsJson: passwordParamsJson(),
      createdAt: now,
      updatedAt: now,
    }).run()
  }

  await recordSecurityEvent(ctx, 'password_changed', await requestProtection(ctx), { userId: user.id })
  return json({ ok: true })
}

export async function revokeSessions(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const input = await readJson<{ scope?: unknown; sessionId?: unknown }>(ctx.request)
  const scope = input.scope === 'current' || input.scope === 'others' || input.scope === 'all' ? input.scope : 'others'
  const now = Date.now()
  const currentTokenHash = await getCurrentSessionTokenHash(ctx)

  if (typeof input.sessionId === 'string' && input.sessionId) {
    await ctx.db.update(schema.sessions)
      .set({ revokedAt: now })
      .where(and(eq(schema.sessions.id, input.sessionId), eq(schema.sessions.userId, user.id)))
      .run()
  } else if (scope === 'current' && currentTokenHash) {
    await ctx.db.update(schema.sessions)
      .set({ revokedAt: now })
      .where(and(eq(schema.sessions.tokenHash, currentTokenHash), eq(schema.sessions.userId, user.id)))
      .run()
  } else if (scope === 'all') {
    await ctx.db.update(schema.sessions)
      .set({ revokedAt: now })
      .where(eq(schema.sessions.userId, user.id))
      .run()
  } else if (scope === 'others') {
    const sessions = await ctx.db.select().from(schema.sessions).where(eq(schema.sessions.userId, user.id)).all()
    const otherSessionIds = sessions
      .filter((session) => !currentTokenHash || session.tokenHash !== currentTokenHash)
      .map((session) => session.id)
    if (otherSessionIds.length > 0) {
      await ctx.db.update(schema.sessions)
        .set({ revokedAt: now })
        .where(and(eq(schema.sessions.userId, user.id), inArray(schema.sessions.id, otherSessionIds)))
        .run()
    }
  }

  await recordSecurityEvent(ctx, 'session_revoked', await requestProtection(ctx), { userId: user.id, metadata: { scope } })
  return json({ ok: true })
}

export async function deleteAccount(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const input = await readJson<{ confirmation?: unknown }>(ctx.request)
  const confirmation = typeof input.confirmation === 'string' ? input.confirmation.trim().toLowerCase() : ''
  if (confirmation !== normalizeEmail(user.email) && confirmation !== 'delete') {
    return jsonError('VALIDATION_ERROR', 'Type your email or DELETE to confirm account deletion', 422)
  }

  const objectRows = await ctx.db.select({ key: schema.objects.key }).from(schema.objects).where(eq(schema.objects.userId, user.id)).all()
  await Promise.all(objectRows.map((row) => ctx.env.IMAGES.delete(row.key)))
  await recordSecurityEvent(ctx, 'account_deleted', await requestProtection(ctx), { metadata: { userHash: await hashToken(user.id) } })
  await ctx.db.delete(schema.users).where(eq(schema.users.id, user.id)).run()
  const response = json({ ok: true })
  for (const cookie of expireSessionCookies(ctx)) response.headers.append('Set-Cookie', cookie)
  return response
}

async function listIdentities(ctx: RequestContext, userId: string) {
  return ctx.db.select().from(schema.authIdentities).where(eq(schema.authIdentities.userId, userId)).all()
}

async function listSessions(ctx: RequestContext, userId: string) {
  return ctx.db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId)).all()
}

async function listAlbumSummaries(ctx: RequestContext, userId: string) {
  const albums = await ctx.db.select({
    id: schema.albums.id,
    title: schema.albums.title,
    description: schema.albums.description,
    coverKey: schema.albums.coverKey,
    updatedAt: schema.albums.updatedAt,
  }).from(schema.albums)
    .where(eq(schema.albums.userId, userId))
    .orderBy(desc(schema.albums.updatedAt))
    .all()

  if (albums.length === 0) return []

  const pageRows = await ctx.db.select({
    albumId: schema.albumPages.albumId,
    value: count(),
  }).from(schema.albumPages)
    .where(inArray(schema.albumPages.albumId, albums.map((album) => album.id)))
    .groupBy(schema.albumPages.albumId)
    .all()
  const pageCountByAlbum = new Map(pageRows.map((row) => [row.albumId, Number(row.value ?? 0)]))

  return albums.map((album) => ({
    id: album.id,
    title: album.title,
    description: album.description,
    coverKey: album.coverKey,
    pageCount: pageCountByAlbum.get(album.id) ?? 0,
    updatedAt: album.updatedAt,
  }))
}

async function getObjectUsage(ctx: RequestContext, userId: string) {
  const objectRow = await ctx.db.select({
    count: count(),
    bytes: sql<number>`coalesce(sum(${schema.objects.sizeBytes}), 0)`,
  }).from(schema.objects).where(eq(schema.objects.userId, userId)).get()
  return {
    objectCount: Number(objectRow?.count ?? 0),
    storageBytes: Number(objectRow?.bytes ?? 0),
  }
}

async function getCurrentSessionTokenHash(ctx: RequestContext): Promise<string | null> {
  const token = readSessionToken(ctx)
  return token ? hashToken(token) : null
}

async function requestProtection(ctx: RequestContext) {
  return {
    ipHash: await optionalHash(ctx.request.headers.get('CF-Connecting-IP') || ctx.request.headers.get('X-Forwarded-For')),
    userAgentHash: await optionalHash(ctx.request.headers.get('User-Agent')),
  }
}

function publicUserFromRow(row: typeof schema.users.$inferSelect): AuthUser {
  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.emailNormalized,
    username: row.username,
    avatarUrl: row.avatarUrl,
    plan: row.plan,
  }
}

function isValidUsername(value: string): boolean {
  return /^[A-Za-z0-9_-]{3,40}$/.test(value)
}

function isAllowedAvatarUrl(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.startsWith('data:image/')) return trimmed.length <= 256_000
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
