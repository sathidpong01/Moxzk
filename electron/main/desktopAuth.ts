import { shell, session } from 'electron'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

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

interface LoopbackCallbackServer {
  callbackUrl: string
  waitForTicket(): Promise<string>
  close(): Promise<void>
}

declare const __MG_WORKER_API_BASE__: string

const DESKTOP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000

let activeGoogleLogin: Promise<NativeAuthActionResult> | null = null

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
  const loopback = await createLoopbackCallbackServer()
  try {
    const redirectUrl = await startDesktopGoogleFlow(apiBase, loopback.callbackUrl)
    await shell.openExternal(redirectUrl)
    const ticket = await withTimeout(loopback.waitForTicket(), DESKTOP_LOGIN_TIMEOUT_MS)
    const claimed = await claimDesktopTicket(apiBase, ticket)
    await setElectronSessionCookie(apiBase, claimed.cookie)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    await loopback.close()
  }
}

async function startDesktopGoogleFlow(apiBase: string, redirectTarget: string): Promise<string> {
  const url = new URL('/api/auth/google/desktop/start', apiBase)
  url.searchParams.set('redirectTarget', redirectTarget)
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Origin: new URL(apiBase).origin,
      'X-MG-Desktop-Auth-Origin': getWorkerCallbackOrigin(apiBase),
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

async function setElectronSessionCookie(
  apiBase: string,
  cookie: DesktopClaimResponse['cookie'],
): Promise<void> {
  const target = new URL(apiBase)
  await session.defaultSession.cookies.set({
    url: target.origin,
    name: cookie.name,
    value: cookie.value,
    expirationDate: Math.floor(cookie.expiresAt / 1000),
    httpOnly: true,
    secure: target.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
  })
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

    response.writeHead(ticket ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>MG Translater Login</title></head>
<body><p>${ticket ? 'Google login finished. You can return to MG Translater.' : 'Google login failed. Return to MG Translater and try again.'}</p></body>
</html>`)
  })

  await listenOnLoopback(server)
  const address = server.address() as AddressInfo
  callbackBase = `http://127.0.0.1:${address.port}`
  return {
    callbackUrl: `${callbackBase}/auth/callback`,
    waitForTicket: () => ticketPromise,
    close: () => closeServer(server),
  }
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
  const configured = normalizeBaseUrl(process.env.VITE_CLOUDFLARE_API_URL || __MG_WORKER_API_BASE__)
  if (configured) return configured

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) return new URL(rendererUrl).origin

  throw new Error('Set VITE_CLOUDFLARE_API_URL for Electron Google login.')
}

function getWorkerCallbackOrigin(apiBase: string): string {
  const configured = normalizeBaseUrl(process.env.VITE_CLOUDFLARE_API_URL || __MG_WORKER_API_BASE__)
  return configured || apiBase
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value || '').trim().replace(/\/+$/, '')
}
