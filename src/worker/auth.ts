import { and, eq } from 'drizzle-orm'
import * as schema from './db/schema'
import { base64UrlDecodeToString, hashPassword, hashToken, optionalHash, passwordParamsJson, randomToken, verifyPassword } from './crypto'
import { ApiError, json, jsonError, normalizeEmail, parseCsv, parseEmail, parsePassword, readJson, requiredEnv } from './http'
import type { AuthUser, RequestContext } from './types'

const SESSION_COOKIE_FALLBACK = 'mg_session'

export async function register(ctx: RequestContext): Promise<Response> {
  const input = await readJson<{ email?: unknown; password?: unknown; username?: unknown }>(ctx.request)
  const email = parseEmail(input.email)
  const password = parsePassword(input.password)
  const username = typeof input.username === 'string' && input.username.trim() ? input.username.trim() : null
  if (!email || !password) return jsonError('VALIDATION_ERROR', 'Valid email and password are required', 422)

  const emailNormalized = normalizeEmail(email)
  const existing = await ctx.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.emailNormalized, emailNormalized)).get()
  if (existing) return jsonError('CONFLICT', 'Email is already registered', 409)

  const now = Date.now()
  const userId = crypto.randomUUID()
  const passwordRecord = await hashPassword(password)

  await ctx.db.insert(schema.users).values({
    id: userId,
    email,
    emailNormalized,
    emailVerifiedAt: now,
    username,
    plan: 'free',
    createdAt: now,
    updatedAt: now,
  }).run()

  await ctx.db.insert(schema.authIdentities).values({
    id: crypto.randomUUID(),
    userId,
    provider: 'password',
    providerSubject: emailNormalized,
    email,
    emailNormalized,
    credentialHash: passwordRecord.hash,
    credentialSalt: passwordRecord.salt,
    credentialAlgo: 'PBKDF2_SHA256',
    credentialParamsJson: passwordParamsJson(),
    createdAt: now,
    updatedAt: now,
  }).run()

  const session = await createSession(ctx, userId)
  const response = json({
    user: publicUser({ id: userId, email, emailNormalized, username, avatarUrl: null, plan: 'free' }),
    emailVerificationRequired: false,
  }, 201)
  response.headers.append('Set-Cookie', buildSessionCookie(ctx, session.token, session.expiresAt))
  return response
}

export async function login(ctx: RequestContext): Promise<Response> {
  const input = await readJson<{ email?: unknown; password?: unknown }>(ctx.request)
  const email = parseEmail(input.email)
  const password = parsePassword(input.password)
  if (!email || !password) return jsonError('VALIDATION_ERROR', 'Valid email and password are required', 422)

  const emailNormalized = normalizeEmail(email)
  const identity = await ctx.db.select().from(schema.authIdentities)
    .where(and(eq(schema.authIdentities.provider, 'password'), eq(schema.authIdentities.providerSubject, emailNormalized)))
    .get()
  if (!identity?.credentialHash || !identity.credentialSalt) return jsonError('UNAUTHORIZED', 'Invalid credentials', 401)

  const valid = await verifyPassword(password, identity.credentialSalt, identity.credentialHash)
  if (!valid) return jsonError('UNAUTHORIZED', 'Invalid credentials', 401)

  const user = await ctx.db.select().from(schema.users).where(eq(schema.users.id, identity.userId)).get()
  if (!user) return jsonError('UNAUTHORIZED', 'Invalid credentials', 401)

  const session = await createSession(ctx, user.id)
  const response = json({ user: publicUser(user) })
  response.headers.append('Set-Cookie', buildSessionCookie(ctx, session.token, session.expiresAt))
  return response
}

export async function logout(ctx: RequestContext): Promise<Response> {
  const token = readSessionToken(ctx)
  if (token) {
    await ctx.db.update(schema.sessions)
      .set({ revokedAt: Date.now() })
      .where(eq(schema.sessions.tokenHash, await hashToken(token)))
      .run()
  }
  const response = json({ ok: true })
  response.headers.append('Set-Cookie', expireSessionCookie(ctx))
  return response
}

export async function me(ctx: RequestContext): Promise<Response> {
  try {
    const user = await requireUser(ctx)
    return json({ user: publicUser(user) })
  } catch (error) {
    if (error instanceof ApiError && error.response.status === 401) {
      return json({ user: null })
    }
    throw error
  }
}

export async function verifyEmail(_ctx: RequestContext): Promise<Response> {
  return jsonError('FEATURE_DISABLED', 'Email verification is disabled for this app', 404)
}

export async function requestPasswordReset(_ctx: RequestContext): Promise<Response> {
  return jsonError('FEATURE_DISABLED', 'Password reset by email is disabled for this app', 404)
}

export async function resetPassword(_ctx: RequestContext): Promise<Response> {
  return jsonError('FEATURE_DISABLED', 'Password reset by email is disabled for this app', 404)
}

export async function googleStart(ctx: RequestContext): Promise<Response> {
  const clientId = requiredEnv(ctx.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID')
  const redirectTarget = ctx.url.searchParams.get('redirectTarget') || defaultWebRedirect(ctx)
  if (!isAllowedRedirect(ctx, redirectTarget)) return jsonError('VALIDATION_ERROR', 'Redirect target is not allowed', 422)

  const state = randomToken()
  const nonce = randomToken()
  const now = Date.now()
  const callbackUrl = googleCallbackUrl(ctx, redirectTarget)
  await ctx.db.insert(schema.oauthStates).values({
    stateHash: await hashToken(state),
    provider: 'google',
    redirectTarget,
    nonceHash: await hashToken(nonce),
    expiresAt: now + 10 * 60 * 1000,
    createdAt: now,
  }).run()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', callbackUrl)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('nonce', nonce)
  authUrl.searchParams.set('prompt', 'select_account')
  return json({ redirectUrl: authUrl.toString() })
}

export async function googleCallback(ctx: RequestContext): Promise<Response> {
  const code = ctx.url.searchParams.get('code')
  const state = ctx.url.searchParams.get('state')
  if (!code || !state) return jsonError('BAD_REQUEST', 'Google callback is missing code or state', 400)

  const oauthState = await ctx.db.select().from(schema.oauthStates).where(eq(schema.oauthStates.stateHash, await hashToken(state))).get()
  if (!oauthState || oauthState.expiresAt < Date.now()) return jsonError('BAD_REQUEST', 'Invalid or expired OAuth state', 400)

  const tokens = await exchangeGoogleCode(ctx, code)
  const profile = parseGoogleIdToken(tokens.id_token)
  if (!profile.email || !profile.email_verified || !profile.sub) return jsonError('FORBIDDEN', 'Google account must have a verified email', 403)
  if (!profile.nonce || await hashToken(profile.nonce) !== oauthState.nonceHash) return jsonError('BAD_REQUEST', 'Invalid OAuth nonce', 400)

  const user = await findOrCreateGoogleUser(ctx, profile)
  const session = await createSession(ctx, user.id)
  await ctx.db.delete(schema.oauthStates).where(eq(schema.oauthStates.stateHash, oauthState.stateHash)).run()

  const redirectUrl = new URL(oauthState.redirectTarget)
  redirectUrl.searchParams.set('auth', 'success')
  const response = new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } })
  response.headers.append('Set-Cookie', buildSessionCookie(ctx, session.token, session.expiresAt))
  return response
}

export async function requireUser(ctx: RequestContext): Promise<AuthUser> {
  const token = readSessionToken(ctx)
  if (!token) throw new ApiError('UNAUTHORIZED', 'Authentication is required', 401)

  const session = await ctx.db.select().from(schema.sessions).where(eq(schema.sessions.tokenHash, await hashToken(token))).get()
  if (!session || session.revokedAt || session.expiresAt < Date.now()) {
    throw new ApiError('UNAUTHORIZED', 'Authentication is required', 401)
  }
  const user = await ctx.db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get()
  if (!user) throw new ApiError('UNAUTHORIZED', 'Authentication is required', 401)
  return publicUser(user)
}

function publicUser(user: {
  id: string
  email: string
  emailNormalized: string
  username: string | null
  avatarUrl: string | null
  plan: 'free' | 'pro' | 'team'
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    emailNormalized: user.emailNormalized,
    username: user.username,
    avatarUrl: user.avatarUrl,
    plan: user.plan,
  }
}

async function createSession(ctx: RequestContext, userId: string): Promise<{ token: string; expiresAt: number }> {
  const now = Date.now()
  const ttlDays = Number(ctx.env.SESSION_TTL_DAYS || '30')
  const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000
  const token = randomToken()
  await ctx.db.insert(schema.sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashToken(token),
    userAgent: ctx.request.headers.get('User-Agent'),
    ipHash: await optionalHash(ctx.request.headers.get('CF-Connecting-IP')),
    expiresAt,
    createdAt: now,
  }).run()
  return { token, expiresAt }
}

async function exchangeGoogleCode(ctx: RequestContext, code: string): Promise<{ id_token: string }> {
  const state = ctx.url.searchParams.get('state')
  const oauthState = state
    ? await ctx.db.select({ redirectTarget: schema.oauthStates.redirectTarget })
      .from(schema.oauthStates)
      .where(eq(schema.oauthStates.stateHash, await hashToken(state)))
      .get()
    : null

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv(ctx.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv(ctx.env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET'),
      redirect_uri: oauthState ? googleCallbackUrl(ctx, oauthState.redirectTarget) : `${ctx.url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`)
  const payload = await response.json<{ id_token?: string }>()
  if (!payload.id_token) throw new Error('Google token response did not include id_token')
  return { id_token: payload.id_token }
}

function parseGoogleIdToken(idToken: string): { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string; nonce?: string } {
  const [, payload] = idToken.split('.')
  if (!payload) throw new Error('Invalid Google id_token')
  return JSON.parse(base64UrlDecodeToString(payload)) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string; nonce?: string }
}

async function findOrCreateGoogleUser(
  ctx: RequestContext,
  profile: { sub?: string; email?: string; name?: string; picture?: string },
): Promise<AuthUser> {
  if (!profile.sub || !profile.email) throw new Error('Google profile is missing required fields')
  const emailNormalized = normalizeEmail(profile.email)
  const now = Date.now()
  const existingIdentity = await ctx.db.select().from(schema.authIdentities)
    .where(and(eq(schema.authIdentities.provider, 'google'), eq(schema.authIdentities.providerSubject, profile.sub)))
    .get()
  if (existingIdentity) {
    const existingUser = await ctx.db.select().from(schema.users).where(eq(schema.users.id, existingIdentity.userId)).get()
    if (!existingUser) throw new Error('Google identity is orphaned')
    return publicUser(existingUser)
  }

  let user = await ctx.db.select().from(schema.users).where(eq(schema.users.emailNormalized, emailNormalized)).get()
  if (!user) {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: profile.email,
      emailNormalized,
      emailVerifiedAt: now,
      username: null,
      avatarUrl: profile.picture ?? null,
      plan: 'free',
      createdAt: now,
      updatedAt: now,
    }).run()
    user = await ctx.db.select().from(schema.users).where(eq(schema.users.id, id)).get()
  } else if (!user.emailVerifiedAt) {
    await ctx.db.update(schema.users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(schema.users.id, user.id)).run()
    user = { ...user, emailVerifiedAt: now, updatedAt: now }
  }
  if (!user) throw new Error('Failed to create Google user')

  await ctx.db.insert(schema.authIdentities).values({
    id: crypto.randomUUID(),
    userId: user.id,
    provider: 'google',
    providerSubject: profile.sub,
    email: profile.email,
    emailNormalized,
    providerProfileJson: JSON.stringify(profile),
    createdAt: now,
    updatedAt: now,
  }).run()
  return publicUser(user)
}

function readSessionToken(ctx: RequestContext): string | null {
  const cookie = ctx.request.headers.get('Cookie')
  if (!cookie) return null
  const name = sessionCookieName(ctx)
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function buildSessionCookie(ctx: RequestContext, token: string, expiresAt: number): string {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  return `${sessionCookieName(ctx)}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`
}

function expireSessionCookie(ctx: RequestContext): string {
  return `${sessionCookieName(ctx)}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
}

function sessionCookieName(ctx: RequestContext): string {
  return ctx.env.SESSION_COOKIE_NAME || SESSION_COOKIE_FALLBACK
}

function isAllowedRedirect(ctx: RequestContext, redirectTarget: string): boolean {
  return parseCsv(ctx.env.OAUTH_REDIRECT_ALLOWLIST).includes(redirectTarget)
}

function googleCallbackUrl(ctx: RequestContext, redirectTarget: string): string {
  try {
    const target = new URL(redirectTarget)
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      return `${target.origin}/api/auth/google/callback`
    }
  } catch {
    // Fall back to the Worker origin below.
  }
  return `${ctx.url.origin}/api/auth/google/callback`
}

function defaultWebRedirect(ctx: RequestContext): string {
  const origin = ctx.request.headers.get('Origin') || new URL(ctx.request.url).origin
  return `${origin}/auth/callback`
}
