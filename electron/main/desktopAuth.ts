import { app, shell, session } from 'electron'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { APP_DISPLAY_NAME, SESSION_COOKIE_NAME } from '../../src/config/appIdentity'

export interface NativeAuthActionResult {
  ok: boolean
  error?: string
}

interface DesktopStartResponse {
  redirectUrl: string
}

interface DesktopClaimResponse {
  cookie: {
    name: string
    value: string
    expiresAt: number
  }
}

interface DesktopSessionCookie {
  name: string
  value: string
  targetOrigins: Set<string>
}

interface LoopbackCallbackServer {
  kind: 'loopback'
  callbackUrl: string
  waitForTicket(): Promise<string>
  close(): Promise<void>
}

interface DesktopCallbackReceiver {
  kind: 'custom-protocol' | 'loopback'
  callbackUrl: string
  waitForTicket(): Promise<string>
  close(): Promise<void>
}

declare const __MOXZK_WORKER_API_BASE__: string

const DESKTOP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const DESKTOP_AUTH_PROTOCOL = 'moxzk'
const DESKTOP_AUTH_CALLBACK_HOST = 'auth'
const DESKTOP_AUTH_CALLBACK_PATH = '/callback'

let activeGoogleLogin: Promise<NativeAuthActionResult> | null = null
let desktopSessionCookie: DesktopSessionCookie | null = null
let requestHeaderBridgeInstalled = false
let customProtocolRegistered = false
let activeProtocolCallback:
  | {
      settled: boolean
      resolveTicket: (ticket: string) => void
      rejectTicket: (error: Error) => void
    }
  | null = null

export function registerDesktopProtocol(): boolean {
  if (!app.isPackaged) {
    app.removeAsDefaultProtocolClient(DESKTOP_AUTH_PROTOCOL)
    customProtocolRegistered = false
    return false
  }
  const launchArgs = process.defaultApp && process.argv[1]
    ? [process.argv[1]]
    : []
  try {
    customProtocolRegistered = app.setAsDefaultProtocolClient(
      DESKTOP_AUTH_PROTOCOL,
      process.execPath,
      launchArgs,
    )
  } catch {
    customProtocolRegistered = false
  }
  return customProtocolRegistered
}

export function getCustomProtocolCallbackUrl(callbackPath: string): string | null {
  if (!customProtocolRegistered) return null
  const normalizedPath = normalizeCallbackPath(callbackPath)
  if (normalizedPath !== DESKTOP_AUTH_CALLBACK_PATH) return null
  return `${DESKTOP_AUTH_PROTOCOL}://${DESKTOP_AUTH_CALLBACK_HOST}${normalizedPath}`
}

export function consumeDesktopProtocolCallback(rawUrl: string): boolean {
  const callback = parseDesktopProtocolCallback(rawUrl)
  if (!callback) return false
  const pending = activeProtocolCallback
  if (pending && !pending.settled) {
    pending.settled = true
    activeProtocolCallback = null
    if (callback.ticket) {
      pending.resolveTicket(callback.ticket)
    } else {
      pending.rejectTicket(new Error(callback.error || 'Google login callback did not include a desktop ticket.'))
    }
  }
  return true
}

export function signInWithGoogleSystemBrowser(): Promise<NativeAuthActionResult> {
  if (activeGoogleLogin) {
    return Promise.resolve({ ok: false, error: 'Google login is already in progress.' })
  }

  activeGoogleLogin = runGoogleSystemBrowserLogin().finally(() => {
    activeGoogleLogin = null
  })
  return activeGoogleLogin
}

async function runGoogleSystemBrowserLogin(): Promise<NativeAuthActionResult> {
  const apiBase = getApiBaseUrl()
  let callbackReceiver = await createDesktopCallbackReceiver()
  try {
    let redirectUrl: string
    try {
      redirectUrl = await startDesktopGoogleFlow(apiBase, callbackReceiver.callbackUrl)
    } catch (error) {
      if (callbackReceiver.kind !== 'custom-protocol' || !shouldRetryWithLoopbackCallback(error)) {
        throw error
      }
      await callbackReceiver.close()
      callbackReceiver = await createLoopbackCallbackServer()
      redirectUrl = await startDesktopGoogleFlow(apiBase, callbackReceiver.callbackUrl)
    }
    await shell.openExternal(redirectUrl)
    const ticket = await withTimeout(callbackReceiver.waitForTicket(), DESKTOP_LOGIN_TIMEOUT_MS)
    const claimed = await claimDesktopTicket(apiBase, ticket)
    await setElectronSessionCookies(apiBase, claimed.cookie)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    await callbackReceiver.close()
  }
}

async function startDesktopGoogleFlow(apiBase: string, redirectTarget: string): Promise<string> {
  const url = new URL('/api/auth/google/desktop/start', apiBase)
  url.searchParams.set('redirectTarget', redirectTarget)
  const workerCallbackOrigin = getWorkerCallbackOrigin()
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Origin: new URL(apiBase).origin,
      ...(workerCallbackOrigin ? { 'X-Moxzk-Desktop-Auth-Origin': workerCallbackOrigin } : {}),
    },
  })
  const payload = await readJsonResponse<DesktopStartResponse>(response)
  if (!payload.redirectUrl) throw new Error('Worker did not return a Google redirect URL.')
  return payload.redirectUrl
}

async function claimDesktopTicket(apiBase: string, ticket: string): Promise<DesktopClaimResponse> {
  const response = await fetch(new URL('/api/auth/google/desktop/claim', apiBase), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: new URL(apiBase).origin,
    },
    body: JSON.stringify({ ticket }),
  })
  return readJsonResponse<DesktopClaimResponse>(response)
}

async function setElectronSessionCookies(
  apiBase: string,
  cookie: DesktopClaimResponse['cookie'],
): Promise<void> {
  const targets = getSessionCookieTargets(apiBase)
  await Promise.all(targets.map((target) => {
    const isSecure = target.protocol === 'https:'
    return session.defaultSession.cookies.set({
      url: target.origin,
      name: cookie.name,
      value: cookie.value,
      expirationDate: Math.floor(cookie.expiresAt / 1000),
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'no_restriction' : 'lax',
      path: '/',
    })
  }))
  rememberDesktopSessionCookie(targets, cookie)
}

function getSessionCookieTargets(apiBase: string): URL[] {
  const targets = [new URL(apiBase)]
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    try {
      const rendererTarget = new URL(rendererUrl)
      if (rendererTarget.protocol === 'http:' || rendererTarget.protocol === 'https:') {
        targets.push(rendererTarget)
      }
    } catch {
      // Ignore malformed dev-server URLs and keep the Worker cookie target.
    }
  }
  return Array.from(new Map(targets.map((target) => [target.origin, target])).values())
}

function rememberDesktopSessionCookie(
  targets: URL[],
  cookie: DesktopClaimResponse['cookie'],
): void {
  desktopSessionCookie = {
    name: cookie.name,
    value: cookie.value,
    targetOrigins: new Set(targets.map((target) => target.origin)),
  }
  installRequestHeaderBridge()
}

export function initDesktopNetworkBridge(): void {
  if (requestHeaderBridgeInstalled) return
  requestHeaderBridgeInstalled = true

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (!desktopSessionCookie || !shouldAttachDesktopSession(details.url)) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }
    const { Cookie: existingCookie, cookie: existingLowerCookie, ...remainingHeaders } = details.requestHeaders
    callback({
      requestHeaders: {
        ...remainingHeaders,
        Cookie: mergeCookieHeader(existingCookie || existingLowerCookie, desktopSessionCookie),
      },
    })
  })

  const apiOrigin = resolveWorkerOrigin()
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders: Record<string, string[]> = { ...details.responseHeaders }

    if (app.isPackaged && (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame')) {
      delete responseHeaders['content-security-policy']
      delete responseHeaders['Content-Security-Policy']
      responseHeaders['content-security-policy'] = [RENDERER_CONTENT_SECURITY_POLICY]
    }

    if (apiOrigin && isWorkerApiUrl(details.url, apiOrigin)) {
      const reqHeaders = (details as unknown as { requestHeaders?: Record<string, string> }).requestHeaders
      const requestOrigin = reqHeaders?.Origin ?? reqHeaders?.origin
      responseHeaders['access-control-allow-origin'] = [requestOrigin ?? 'null']
      responseHeaders['access-control-allow-credentials'] = ['true']
    }

    callback({ responseHeaders })
  })
}

// Applied to packaged renderer documents only. Dev runs through the Vite dev
// server, which needs 'unsafe-eval' for HMR, so CSP is left to Electron's
// dev-only warning there. https is allowed for the Worker API and R2 images;
// loopback http covers the local Ollama and PanelCleaner bridges.
const RENDERER_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
].join('; ')

export async function restoreDesktopSessionIfNeeded(): Promise<void> {
  if (desktopSessionCookie) return
  try {
    const apiBase = normalizeBaseUrl(process.env.VITE_CLOUDFLARE_API_URL || __MOXZK_WORKER_API_BASE__)
    if (!apiBase) return
    const targets = getSessionCookieTargets(apiBase)
    for (const target of targets) {
      const cookies = await session.defaultSession.cookies.get({ url: target.href })
      const match = cookies.find((c) => c.name === SESSION_COOKIE_NAME && c.value)
      if (match) {
        desktopSessionCookie = {
          name: match.name,
          value: match.value,
          targetOrigins: new Set(targets.map((t) => t.origin)),
        }
        return
      }
    }
  } catch {
    // ignore — cookie will be re-populated on next login
  }
}

function installRequestHeaderBridge(): void {
  // No-op: bridge is now installed at startup via initDesktopNetworkBridge()
}

function resolveWorkerOrigin(): string {
  try {
    const base = normalizeBaseUrl(process.env.VITE_CLOUDFLARE_API_URL || __MOXZK_WORKER_API_BASE__)
    return base ? new URL(base).origin : ''
  } catch {
    return ''
  }
}

function isWorkerApiUrl(url: string, apiOrigin: string): boolean {
  try {
    const target = new URL(url)
    return target.origin === apiOrigin && target.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function shouldAttachDesktopSession(url: string): boolean {
  try {
    const target = new URL(url)
    return desktopSessionCookie?.targetOrigins.has(target.origin) === true
      && target.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function mergeCookieHeader(
  existingCookieHeader: string | undefined,
  cookie: DesktopSessionCookie,
): string {
  const nextCookie = `${cookie.name}=${encodeURIComponent(cookie.value)}`
  if (!existingCookieHeader) return nextCookie
  const preserved = existingCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${cookie.name}=`))
  return [...preserved, nextCookie].join('; ')
}

async function createLoopbackCallbackServer(): Promise<LoopbackCallbackServer> {
  let callbackBase = ''
  let settled = false
  let resolveTicket: (ticket: string) => void = () => {}
  let rejectTicket: (error: Error) => void = () => {}
  const ticketPromise = new Promise<string>((resolve, reject) => {
    resolveTicket = resolve
    rejectTicket = reject
  })

  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', callbackBase)
    if (request.method !== 'GET' || url.pathname !== '/auth/callback') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    const ticket = url.searchParams.get('ticket')
    const authError = url.searchParams.get('error')
    if (!settled) {
      settled = true
      if (ticket) {
        resolveTicket(ticket)
      } else {
        rejectTicket(new Error(authError || 'Google login callback did not include a desktop ticket.'))
      }
    }

    const success = Boolean(ticket)
    response.writeHead(success ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${APP_DISPLAY_NAME} — ${success ? 'เข้าสู่ระบบสำเร็จ' : 'เข้าสู่ระบบไม่สำเร็จ'}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0b1020;color:#e2e8f0;padding:2rem}
.card{text-align:center;max-width:340px}
.icon{font-size:2.5rem;margin-bottom:1rem}
h1{font-size:1.25rem;font-weight:700;margin-bottom:.5rem}
p{color:#94a3b8;font-size:.9rem;line-height:1.6}
.hint{margin-top:1.25rem;font-size:.8rem;color:#64748b}
</style>
</head>
<body>
<div class="card">
  <div class="icon">${success ? '✓' : '✕'}</div>
  <h1>${success ? 'เข้าสู่ระบบเสร็จแล้ว' : 'เข้าสู่ระบบไม่สำเร็จ'}</h1>
  <p>${success ? `กลับไปที่ ${APP_DISPLAY_NAME} ได้เลย` : `กลับไปที่ ${APP_DISPLAY_NAME} แล้วลองใหม่อีกครั้ง`}</p>
  <p class="hint">ปิดแท็บนี้ได้เลย</p>
</div>
<script>try{window.close()}catch(e){}</script>
</body>
</html>`)
  })

  await listenOnLoopback(server)
  const address = server.address() as AddressInfo
  callbackBase = `http://127.0.0.1:${address.port}`
  return {
    kind: 'loopback',
    callbackUrl: `${callbackBase}/auth/callback`,
    waitForTicket: () => ticketPromise,
    close: () => closeServer(server),
  }
}

async function createDesktopCallbackReceiver(): Promise<DesktopCallbackReceiver> {
  return createLoopbackCallbackServer()
}

function shouldRetryWithLoopbackCallback(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /Desktop redirect target|Redirect target is not allowed/i.test(error.message)
}

function listenOnLoopback(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close(() => resolve())
  })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Google login timed out.')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error(`Worker returned invalid JSON: ${text.slice(0, 200)}`)
    }
  }

  if (!response.ok) {
    const error = payload as { error?: { message?: string } } | null
    throw new Error(error?.error?.message || `Worker request failed with status ${response.status}`)
  }

  return payload as T
}

function getApiBaseUrl(): string {
  const configured = normalizeBaseUrl(process.env.VITE_CLOUDFLARE_API_URL || __MOXZK_WORKER_API_BASE__)
  if (configured) return configured

  throw new Error('Set VITE_CLOUDFLARE_API_URL for Electron Google login.')
}

function getWorkerCallbackOrigin(): string | null {
  const configured = normalizeBaseUrl(process.env.VITE_CLOUDFLARE_API_URL || __MOXZK_WORKER_API_BASE__)
  return configured || null
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value || '').trim().replace(/\/+$/, '')
}

function normalizeCallbackPath(value: string): string {
  const normalized = `/${value}`.replace(/\/+/g, '/')
  return normalized.endsWith('/') && normalized !== '/'
    ? normalized.slice(0, -1)
    : normalized
}

function parseDesktopProtocolCallback(rawUrl: string): { ticket: string | null; error: string | null } | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== `${DESKTOP_AUTH_PROTOCOL}:`) return null
    if (url.hostname !== DESKTOP_AUTH_CALLBACK_HOST) return null
    if (normalizeCallbackPath(url.pathname) !== DESKTOP_AUTH_CALLBACK_PATH) return null
    return {
      ticket: url.searchParams.get('ticket'),
      error: url.searchParams.get('error'),
    }
  } catch {
    return null
  }
}
