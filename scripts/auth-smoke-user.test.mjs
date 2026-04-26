import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmokeConfig,
  extractCookieHeader,
  runAuthSmoke,
} from './auth-smoke-user.mjs'

function jsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

test('buildSmokeConfig requires smoke credentials from environment', () => {
  assert.throws(
    () => buildSmokeConfig({
      MG_AUTH_SMOKE_BASE_URL: 'https://example.workers.dev',
    }),
    /MG_AUTH_SMOKE_EMAIL and MG_AUTH_SMOKE_PASSWORD/,
  )
})

test('buildSmokeConfig prefers the explicit smoke base url and normalizes it', () => {
  const config = buildSmokeConfig({
    MG_AUTH_SMOKE_BASE_URL: 'https://example.workers.dev///',
    MG_AUTH_SMOKE_EMAIL: 'smoke@example.com',
    MG_AUTH_SMOKE_PASSWORD: 'secret-password-12345',
  })

  assert.equal(config.baseUrl, 'https://example.workers.dev')
  assert.equal(config.email, 'smoke@example.com')
  assert.equal(config.password, 'secret-password-12345')
  assert.equal(config.username, 'MG Smoke Test')
})

test('buildSmokeConfig falls back to the deployed Worker API url', () => {
  const config = buildSmokeConfig({
    VITE_CLOUDFLARE_API_URL: 'https://mg-translater-api.example.workers.dev/',
    MG_AUTH_SMOKE_EMAIL: 'smoke@example.com',
    MG_AUTH_SMOKE_PASSWORD: 'secret-password-12345',
  })

  assert.equal(config.baseUrl, 'https://mg-translater-api.example.workers.dev')
})

test('buildSmokeConfig fails clearly when no online Worker URL is configured', () => {
  assert.throws(
    () => buildSmokeConfig({}),
    /MG_AUTH_SMOKE_BASE_URL or VITE_CLOUDFLARE_API_URL/,
  )
})

test('extractCookieHeader keeps only name value pairs from Set-Cookie headers', () => {
  assert.equal(
    extractCookieHeader([
      'mg_session=abc; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax',
      'other=xyz; Path=/',
    ]),
    'mg_session=abc; other=xyz',
  )
})

test('runAuthSmoke registers a missing user and verifies auth/me with the session cookie', async () => {
  const calls = []
  const result = await runAuthSmoke({
    baseUrl: 'https://api.example.com',
    email: 'test@example.com',
    password: 'test-password-12345',
    username: 'Smoke Test',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET', cookie: init.headers?.Cookie })
      if (String(url).endsWith('/api/auth/register')) {
        return jsonResponse(201, {
          user: { id: 'u1', email: 'test@example.com', emailNormalized: 'test@example.com', username: 'Smoke Test', avatarUrl: null, plan: 'free' },
        }, { 'Set-Cookie': 'mg_session=registered; Path=/; HttpOnly; Secure; SameSite=Lax' })
      }
      if (String(url).endsWith('/api/auth/me')) {
        assert.equal(init.headers.Cookie, 'mg_session=registered')
        return jsonResponse(200, {
          user: { id: 'u1', email: 'test@example.com', emailNormalized: 'test@example.com', username: 'Smoke Test', avatarUrl: null, plan: 'free' },
        })
      }
      throw new Error(`unexpected ${url}`)
    },
  })

  assert.equal(result.mode, 'registered')
  assert.equal(result.user.email, 'test@example.com')
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'GET'])
})

test('runAuthSmoke logs in when the smoke user already exists', async () => {
  const calls = []
  const result = await runAuthSmoke({
    baseUrl: 'https://api.example.com',
    email: 'test@example.com',
    password: 'test-password-12345',
    username: 'Smoke Test',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET' })
      if (String(url).endsWith('/api/auth/register')) {
        return jsonResponse(409, { error: { code: 'CONFLICT', message: 'Email is already registered' } })
      }
      if (String(url).endsWith('/api/auth/login')) {
        return jsonResponse(200, {
          user: { id: 'u1', email: 'test@example.com', emailNormalized: 'test@example.com', username: 'Smoke Test', avatarUrl: null, plan: 'free' },
        }, { 'Set-Cookie': 'mg_session=logged-in; Path=/; HttpOnly; Secure; SameSite=Lax' })
      }
      if (String(url).endsWith('/api/auth/me')) {
        assert.equal(init.headers.Cookie, 'mg_session=logged-in')
        return jsonResponse(200, {
          user: { id: 'u1', email: 'test@example.com', emailNormalized: 'test@example.com', username: 'Smoke Test', avatarUrl: null, plan: 'free' },
        })
      }
      throw new Error(`unexpected ${url}`)
    },
  })

  assert.equal(result.mode, 'logged-in')
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'POST', 'GET'])
})
