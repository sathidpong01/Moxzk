import test from 'node:test'
import assert from 'node:assert/strict'
import { runWorkerSmoke } from './worker-smoke.mjs'

function jsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function blobResponse(status, body, headers = {}) {
  return new Response(body, {
    status,
    headers,
  })
}

test('runWorkerSmoke covers auth, album, page, storage, and cleanup paths', async () => {
  const calls = []
  let albumDeleted = false
  let objectDeleted = false
  const result = await runWorkerSmoke({
    baseUrl: 'https://api.example.com',
    email: 'smoke@example.com',
    password: 'secret-password-12345',
    username: 'Smoke Test',
    fetchImpl: async (url, init = {}) => {
      const parsed = new URL(String(url))
      calls.push({ path: parsed.pathname, method: init.method ?? 'GET', cookie: init.headers?.Cookie })

      if (parsed.pathname === '/api/auth/me' && !init.headers?.Cookie) {
        return jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
      }
      if (parsed.pathname === '/api/auth/register') {
        return jsonResponse(201, {
          user: { id: 'u1', email: 'smoke@example.com', emailNormalized: 'smoke@example.com', username: 'Smoke Test', avatarUrl: null, plan: 'free' },
        }, { 'Set-Cookie': 'moxzk_session=smoke; Path=/; HttpOnly; Secure; SameSite=Lax' })
      }
      if (parsed.pathname === '/api/auth/me') {
        assert.equal(init.headers.Cookie, 'moxzk_session=smoke')
        return jsonResponse(200, {
          user: { id: 'u1', email: 'smoke@example.com', emailNormalized: 'smoke@example.com', username: 'Smoke Test', avatarUrl: null, plan: 'free' },
        })
      }
      if (parsed.pathname === '/api/albums' && init.method === 'POST') {
        return jsonResponse(201, { data: { id: 'a1', userId: 'u1', title: 'Smoke Album', description: null, coverKey: null, sourceLang: 'auto', createdAt: 1, updatedAt: 1 } })
      }
      if (parsed.pathname === '/api/albums' && (init.method ?? 'GET') === 'GET') {
        return jsonResponse(200, { data: albumDeleted ? [] : [{ id: 'a1', userId: 'u1', title: 'Smoke Album Updated', description: 'ok', coverKey: null, sourceLang: 'auto', createdAt: 1, updatedAt: 2 }] })
      }
      if (parsed.pathname === '/api/albums/a1' && init.method === 'PATCH') {
        return jsonResponse(200, { ok: true })
      }
      if (parsed.pathname === '/api/albums/a1/pages' && init.method === 'POST') {
        return jsonResponse(201, { data: { id: 'p1', albumId: 'a1', pageNumber: 1, originalKey: null, cleanedKey: null, thumbnailKey: null, artboardX: null, artboardY: null, regionsJson: '[]', brushStrokesJson: '[]', status: 'pending', processingMode: 'full', errorMessage: null, createdAt: 1, updatedAt: 1 } })
      }
      if (parsed.pathname === '/api/pages/p1' && init.method === 'PATCH') {
        return jsonResponse(200, { ok: true })
      }
      if (parsed.pathname === '/api/albums/a1/pages/reorder' && init.method === 'POST') {
        return jsonResponse(200, { ok: true })
      }
      if (parsed.pathname === '/api/albums/a1/pages' && (init.method ?? 'GET') === 'GET') {
        return jsonResponse(200, { data: [{ id: 'p1', albumId: 'a1', pageNumber: 1, originalKey: 'users/u1/albums/a1/0001_original.webp', cleanedKey: null, thumbnailKey: null, artboardX: 40, artboardY: 48, regionsJson: '[{"id":"r1"}]', brushStrokesJson: '[{"id":"b1"}]', status: 'translated', processingMode: 'full', errorMessage: null, createdAt: 1, updatedAt: 2 }] })
      }
      if (parsed.pathname === '/api/storage/upload' && init.method === 'POST') {
        return jsonResponse(200, { key: 'users/u1/albums/a1/0001_original.webp', size: 8, sha256: null, skipped: false })
      }
      if (parsed.pathname === '/api/storage/object/users%2Fu1%2Falbums%2Fa1%2F0001_original.webp' && (init.method ?? 'GET') === 'GET') {
        if (objectDeleted) return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Object not found' } })
        return blobResponse(200, 'smoke-image', { 'Content-Type': 'image/webp' })
      }
      if (parsed.pathname === '/api/storage/object/users%2Fsomeone-else%2Falbums%2Fforeign%2F0001_original.webp') {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Object not found' } })
      }
      if (parsed.pathname === '/api/storage/object/users%2Fu1%2Falbums%2Fa1%2F0001_original.webp' && init.method === 'DELETE') {
        objectDeleted = true
        return jsonResponse(200, { ok: true })
      }
      if (parsed.pathname === '/api/albums/a1' && init.method === 'DELETE') {
        albumDeleted = true
        return jsonResponse(200, { ok: true })
      }
      if (parsed.pathname === '/api/auth/logout' && init.method === 'POST') {
        return jsonResponse(200, { ok: true })
      }

      throw new Error(`unexpected ${init.method ?? 'GET'} ${parsed.pathname}`)
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.checks.map((check) => check.name), [
    'auth.no_cookie_requires_login',
    'auth.session_me',
    'album.create',
    'album.list',
    'album.update',
    'page.create',
    'page.update',
    'page.reorder',
    'page.list',
    'storage.upload',
    'storage.download',
    'storage.foreign_key_blocked',
    'storage.delete',
    'album.delete',
    'auth.logout',
  ])
  assert.ok(calls.every((call) => call.cookie || call.path === '/api/auth/me' || call.path === '/api/auth/register'))
})
