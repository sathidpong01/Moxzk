import { and, eq, isNull } from 'drizzle-orm'
import * as schema from './db/schema'
import { json, jsonError, readJson } from './http'
import type { AuthUser, RequestContext } from './types'

export async function redeemSupporterKey(ctx: RequestContext, user: AuthUser): Promise<Response> {
  const input = await readJson<{ key?: unknown }>(ctx.request)
  const rawKey = typeof input.key === 'string' ? input.key.trim().toLowerCase() : ''
  if (!rawKey) return jsonError('VALIDATION_ERROR', 'Supporter key is required', 422)

  const now = Date.now()

  // Atomic: update only if key exists and has not been redeemed yet.
  // Checking meta.changes avoids a SELECT+UPDATE race condition where two
  // concurrent requests with the same key could both pass the SELECT guard.
  const keyResult = await ctx.db
    .update(schema.supporterKeys)
    .set({ redeemedAt: now, redeemedByUserId: user.id })
    .where(and(eq(schema.supporterKeys.id, rawKey), isNull(schema.supporterKeys.redeemedAt)))
    .run()

  if (keyResult.meta.changes === 0) return jsonError('VALIDATION_ERROR', 'Invalid or already used key', 422)

  await ctx.db
    .update(schema.users)
    .set({ supporterUnlockedAt: now, updatedAt: now })
    .where(eq(schema.users.id, user.id))
    .run()

  const updatedUser = await ctx.db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .get()

  if (!updatedUser) return jsonError('SERVER_ERROR', 'Unexpected error after redeeming key', 500)

  return json({
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      emailNormalized: updatedUser.emailNormalized,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      plan: updatedUser.plan,
      supporterUnlocked: updatedUser.supporterUnlockedAt != null,
    },
  })
}
