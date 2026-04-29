import { fileURLToPath } from 'node:url'
import { loadSmokeEnv } from './smoke-env.mjs'

const DEFAULT_USERNAME = 'Moxzk Smoke Test'

export function buildSmokeConfig(env = process.env) {
  const configuredBaseUrl = env.MOXZK_AUTH_SMOKE_BASE_URL || env.VITE_CLOUDFLARE_API_URL
  if (!configuredBaseUrl) {
    throw new Error('Set MOXZK_AUTH_SMOKE_BASE_URL or VITE_CLOUDFLARE_API_URL to your online Worker API URL.')
  }
  const baseUrl = normalizeBaseUrl(configuredBaseUrl)
  const emailValue = env.MOXZK_AUTH_SMOKE_EMAIL
  const passwordValue = env.MOXZK_AUTH_SMOKE_PASSWORD
  if (!emailValue || !passwordValue) {
    throw new Error('Set MOXZK_AUTH_SMOKE_EMAIL and MOXZK_AUTH_SMOKE_PASSWORD in the environment. Do not commit smoke credentials.')
  }
  const email = emailValue.trim()
  const password = passwordValue
  const username = (env.MOXZK_AUTH_SMOKE_USERNAME || DEFAULT_USERNAME).trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('MOXZK_AUTH_SMOKE_EMAIL must be a valid email address.')
  }
  if (password.length < 10) {
    throw new Error('MOXZK_AUTH_SMOKE_PASSWORD must be at least 10 characters.')
  }

  return { baseUrl, email, password, username }
}

export function extractCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((value) => value.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

export async function runAuthSmoke({
  baseUrl,
  email,
  password,
  username,
  fetchImpl = fetch,
}) {
  const registerResponse = await requestJson(fetchImpl, baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email, password, username },
  })

  let mode = 'registered'
  let authResponse = registerResponse

  if (registerResponse.status === 409) {
    mode = 'logged-in'
    authResponse = await requestJson(fetchImpl, baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
  }

  if (!authResponse.ok) {
    throw new Error(`${mode === 'registered' ? 'Register' : 'Login'} failed: ${authResponse.status} ${authResponse.message}`)
  }

  const cookieHeader = extractCookieHeader(authResponse.setCookieHeaders)
  if (!cookieHeader) {
    throw new Error('Auth smoke did not receive a session cookie.')
  }

  const meResponse = await requestJson(fetchImpl, baseUrl, '/api/auth/me', {
    method: 'GET',
    cookieHeader,
  })

  if (!meResponse.ok || !meResponse.payload?.user) {
    throw new Error(`auth/me failed after ${mode}: ${meResponse.status} ${meResponse.message}`)
  }

  return {
    mode,
    baseUrl,
    user: meResponse.payload.user,
  }
}

async function requestJson(fetchImpl, baseUrl, path, { method, body, cookieHeader } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookieHeader) headers.Cookie = cookieHeader

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await readJsonResponse(response)
  const message = payload?.error?.message || response.statusText || 'Request failed'
  return {
    ok: response.ok,
    status: response.status,
    payload,
    message,
    setCookieHeaders: getSetCookieHeaders(response),
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie()
  }
  const value = response.headers.get('set-cookie')
  return value ? [value] : []
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('MOXZK_AUTH_SMOKE_BASE_URL must not be empty.')
  const url = new URL(trimmed)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('MOXZK_AUTH_SMOKE_BASE_URL must use http or https.')
  }
  return url.toString().replace(/\/+$/, '')
}

async function main() {
  const config = buildSmokeConfig(loadSmokeEnv())
  const result = await runAuthSmoke(config)
  console.log(JSON.stringify({
    ok: true,
    mode: result.mode,
    baseUrl: result.baseUrl,
    user: {
      id: result.user.id,
      email: result.user.email,
      username: result.user.username,
      plan: result.user.plan,
    },
  }, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
