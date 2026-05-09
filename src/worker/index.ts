import { drizzle } from 'drizzle-orm/d1'
import { createAlbum, createPage, deleteAlbum, deletePage, listAlbums, listPages, reorderPages, updateAlbum, updatePage } from './albums'
import {
  googleCallback,
  googleDesktopClaim,
  googleDesktopStart,
  googleStart,
  login,
  logout,
  me,
  register,
  requestPasswordReset,
  requireUser,
  resetPassword,
  verifyEmail,
} from './auth'
import { changePassword, deleteAccount, getProfile, revokeSessions, updateProfile } from './profile'
import { redeemSupporterKey } from './supporter'
import * as schema from './db/schema'
import { ApiError, json, jsonError, withCors } from './http'
import { deleteObject, getObject, uploadObject } from './storage'
import type { RequestContext } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ctx: RequestContext = {
      request,
      env,
      db: drizzle(env.DB, { schema }),
      url: new URL(request.url),
    }

    if (request.method === 'OPTIONS') return withCors(ctx, new Response(null, { status: 204 }))

    try {
      return withCors(ctx, await route(ctx))
    } catch (error) {
      if (error instanceof ApiError) return withCors(ctx, error.response)
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ event: 'worker_error', error: message }))
      return withCors(ctx, jsonError(
        'SERVER_ERROR',
        'Unexpected server error',
        500,
        (env as { ENVIRONMENT?: string }).ENVIRONMENT === 'development' ? { message } : undefined,
      ))
    }
  },
}

async function route(ctx: RequestContext): Promise<Response> {
  const { request, url } = ctx
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (path === '/api/health' && request.method === 'GET') return json({ ok: true })
  if (path === '/api/auth/register' && request.method === 'POST') return register(ctx)
  if (path === '/api/auth/login' && request.method === 'POST') return login(ctx)
  if (path === '/api/auth/logout' && request.method === 'POST') return logout(ctx)
  if (path === '/api/auth/me' && request.method === 'GET') return me(ctx)
  if (path === '/api/auth/verify-email' && request.method === 'POST') return verifyEmail(ctx)
  if (path === '/api/auth/request-password-reset' && request.method === 'POST') return requestPasswordReset(ctx)
  if (path === '/api/auth/reset-password' && request.method === 'POST') return resetPassword(ctx)
  if (path === '/api/auth/google/start' && request.method === 'GET') return googleStart(ctx)
  if (path === '/api/auth/google/desktop/start' && request.method === 'GET') return googleDesktopStart(ctx)
  if (path === '/api/auth/google/desktop/claim' && request.method === 'POST') return googleDesktopClaim(ctx)
  if (path === '/api/auth/google/callback' && request.method === 'GET') return googleCallback(ctx)

  const user = await requireUser(ctx)

  if (path === '/api/profile' && request.method === 'GET') return getProfile(ctx, user)
  if (path === '/api/profile' && request.method === 'PATCH') return updateProfile(ctx, user)
  if (path === '/api/auth/password/change' && request.method === 'POST') return changePassword(ctx, user)
  if (path === '/api/auth/sessions/revoke' && request.method === 'POST') return revokeSessions(ctx, user)
  if (path === '/api/account' && request.method === 'DELETE') return deleteAccount(ctx, user)

  if (path === '/api/supporter/redeem' && request.method === 'POST') return redeemSupporterKey(ctx, user)

  if (path === '/api/albums' && request.method === 'GET') return listAlbums(ctx, user)
  if (path === '/api/albums' && request.method === 'POST') return createAlbum(ctx, user)

  const albumPagesMatch = path.match(/^\/api\/albums\/([^/]+)\/pages$/)
  if (albumPagesMatch?.[1] && request.method === 'GET') return listPages(ctx, user, albumPagesMatch[1])
  if (albumPagesMatch?.[1] && request.method === 'POST') return createPage(ctx, user, albumPagesMatch[1])

  const albumReorderMatch = path.match(/^\/api\/albums\/([^/]+)\/pages\/reorder$/)
  if (albumReorderMatch?.[1] && request.method === 'POST') return reorderPages(ctx, user, albumReorderMatch[1])

  const albumMatch = path.match(/^\/api\/albums\/([^/]+)$/)
  if (albumMatch?.[1] && request.method === 'PATCH') return updateAlbum(ctx, user, albumMatch[1])
  if (albumMatch?.[1] && request.method === 'DELETE') return deleteAlbum(ctx, user, albumMatch[1])

  const pageMatch = path.match(/^\/api\/pages\/([^/]+)$/)
  if (pageMatch?.[1] && request.method === 'PATCH') return updatePage(ctx, user, pageMatch[1])
  if (pageMatch?.[1] && request.method === 'DELETE') return deletePage(ctx, user, pageMatch[1])

  if (path === '/api/storage/upload' && request.method === 'POST') return uploadObject(ctx, user)

  const objectMatch = path.match(/^\/api\/storage\/object\/(.+)$/)
  if (objectMatch?.[1] && request.method === 'GET') return getObject(ctx, user, decodeURIComponent(objectMatch[1]))
  if (objectMatch?.[1] && request.method === 'DELETE') return deleteObject(ctx, user, decodeURIComponent(objectMatch[1]))

  return jsonError('NOT_FOUND', 'Route not found', 404)
}
