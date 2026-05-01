import { and, count, desc, eq, gte } from 'drizzle-orm'
import * as schema from './db/schema'
import { hashToken, optionalHash } from './crypto'
import { ApiError, normalizeEmail } from './http'
import type { RequestContext } from './types'

type AuthAction = typeof schema.authAttemptActions[number]

interface ProtectionLimit {
  ipLimit: number
  subjectFailureLimit?: number
  challengeAfterIp?: number
}

export interface AuthProtectionContext {
  action: AuthAction
  subjectHash: string | null
  ipHash: string | null
  userAgentHash: string | null
}

const WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const LIMITS: Record<AuthAction, ProtectionLimit> = {
  register: { ipLimit: 10, challengeAfterIp: 6 },
  login: { ipLimit: 20, subjectFailureLimit: 5, challengeAfterIp: 8 },
  google_start: { ipLimit: 40, challengeAfterIp: 20 },
  google_desktop_start: { ipLimit: 40, challengeAfterIp: 20 },
  google_desktop_claim: { ipLimit: 20, challengeAfterIp: 10 },
}

export async function enforceAuthProtection(
  ctx: RequestContext,
  action: AuthAction,
  options: { subject?: string | null; turnstileToken?: string | null } = {},
): Promise<AuthProtectionContext> {
  const protection = await buildProtectionContext(ctx, action, options.subject)
  const limit = LIMITS[action]
  const since = Date.now() - WINDOW_MS
  const ipAttempts = protection.ipHash
    ? await countAttempts(ctx, { action, ipHash: protection.ipHash, since })
    : 0

  if (isTurnstileConfigured(ctx) && ipAttempts >= (limit.challengeAfterIp ?? Number.POSITIVE_INFINITY)) {
    const verified = await verifyTurnstile(ctx, options.turnstileToken)
    if (!verified) {
      await recordSecurityEvent(ctx, 'auth_challenge_required', protection)
      throw new ApiError('CHALLENGE_REQUIRED', 'Additional verification is required', 403, {
        requiresChallenge: true,
      })
    }
  }

  if (ipAttempts >= limit.ipLimit) {
    await recordSecurityEvent(ctx, 'auth_rate_limited', protection)
    const retryAfterSec = Math.ceil(WINDOW_MS / 1000)
    throw new ApiError('RATE_LIMITED', 'Too many authentication attempts', 429, { retryAfterSec })
  }

  if (limit.subjectFailureLimit && protection.subjectHash) {
    const lastSuccessAt = await latestSuccessfulAttemptAt(ctx, action, protection.subjectHash, since)
    const failedAttempts = await countAttempts(ctx, {
      action,
      subjectHash: protection.subjectHash,
      since: Math.max(since, lastSuccessAt ?? since),
      success: 0,
    })
    if (failedAttempts >= limit.subjectFailureLimit) {
      const lockoutUntil = Date.now() + LOCKOUT_MS
      await recordSecurityEvent(ctx, 'auth_account_locked', protection)
      throw new ApiError('ACCOUNT_LOCKED', 'This account is temporarily locked', 423, {
        lockoutUntil,
        retryAfterSec: Math.ceil(LOCKOUT_MS / 1000),
      })
    }
  }

  return protection
}

async function latestSuccessfulAttemptAt(
  ctx: RequestContext,
  action: AuthAction,
  subjectHash: string,
  since: number,
): Promise<number | null> {
  const row = await ctx.db.select({ createdAt: schema.authAttempts.createdAt })
    .from(schema.authAttempts)
    .where(and(
      eq(schema.authAttempts.action, action),
      eq(schema.authAttempts.subjectHash, subjectHash),
      eq(schema.authAttempts.success, 1),
      gte(schema.authAttempts.createdAt, since),
    ))
    .orderBy(desc(schema.authAttempts.createdAt))
    .get()
  return row?.createdAt ?? null
}

export async function recordAuthAttempt(
  ctx: RequestContext,
  protection: AuthProtectionContext,
  success: boolean,
  errorCode?: string,
): Promise<void> {
  await ctx.db.insert(schema.authAttempts).values({
    id: crypto.randomUUID(),
    action: protection.action,
    subjectHash: protection.subjectHash,
    ipHash: protection.ipHash,
    userAgentHash: protection.userAgentHash,
    success: success ? 1 : 0,
    errorCode: errorCode ?? null,
    createdAt: Date.now(),
  }).run()
}

export async function recordSecurityEvent(
  ctx: RequestContext,
  type: typeof schema.securityEventTypes[number],
  protection: Pick<AuthProtectionContext, 'ipHash' | 'userAgentHash'>,
  options: { userId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  await ctx.db.insert(schema.securityEvents).values({
    id: crypto.randomUUID(),
    userId: options.userId ?? null,
    type,
    ipHash: protection.ipHash,
    userAgentHash: protection.userAgentHash,
    metadataJson: JSON.stringify(options.metadata ?? {}),
    createdAt: Date.now(),
  }).run()
}

export async function verifyTurnstile(ctx: RequestContext, token: string | null | undefined): Promise<boolean> {
  const secret = getOptionalEnv(ctx, 'TURNSTILE_SECRET_KEY')
  if (!secret) return true
  if (!token) return false
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ctx.request.headers.get('CF-Connecting-IP') ?? '',
    }),
  })
  const payload = await response.json<{ success?: boolean }>().catch(() => ({ success: false }))
  return payload.success === true
}

async function buildProtectionContext(
  ctx: RequestContext,
  action: AuthAction,
  subject?: string | null,
): Promise<AuthProtectionContext> {
  const normalizedSubject = subject ? normalizeEmail(subject) : null
  return {
    action,
    subjectHash: normalizedSubject ? await hashToken(normalizedSubject) : null,
    ipHash: await optionalHash(ctx.request.headers.get('CF-Connecting-IP') || ctx.request.headers.get('X-Forwarded-For')),
    userAgentHash: await optionalHash(ctx.request.headers.get('User-Agent')),
  }
}

async function countAttempts(
  ctx: RequestContext,
  options: {
    action: AuthAction
    since: number
    subjectHash?: string
    ipHash?: string
    success?: 0 | 1
  },
): Promise<number> {
  const clauses = [
    eq(schema.authAttempts.action, options.action),
    gte(schema.authAttempts.createdAt, options.since),
  ]
  if (options.subjectHash) clauses.push(eq(schema.authAttempts.subjectHash, options.subjectHash))
  if (options.ipHash) clauses.push(eq(schema.authAttempts.ipHash, options.ipHash))
  if (options.success !== undefined) clauses.push(eq(schema.authAttempts.success, options.success))

  const row = await ctx.db.select({ value: count() })
    .from(schema.authAttempts)
    .where(and(...clauses))
    .get()
  return Number(row?.value ?? 0)
}

function isTurnstileConfigured(ctx: RequestContext): boolean {
  return Boolean(getOptionalEnv(ctx, 'TURNSTILE_SECRET_KEY'))
}

function getOptionalEnv(ctx: RequestContext, name: string): string | null {
  const value = (ctx.env as unknown as Record<string, string | undefined>)[name]
  return value?.trim() || null
}
