import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'

async function loadViteModule(path) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule(path)
  } finally {
    await server.close()
  }
}

test('desktop oauth accepts only loopback callback URLs with random ports', async () => {
  const { isDesktopRedirectTarget } = await loadViteModule('/src/worker/auth.ts')

  assert.equal(isDesktopRedirectTarget('http://127.0.0.1:49231/auth/callback'), true)
  assert.equal(isDesktopRedirectTarget('http://[::1]:49231/auth/callback'), true)
  assert.equal(isDesktopRedirectTarget('http://127.0.0.1/auth/callback'), false)
  assert.equal(isDesktopRedirectTarget('https://127.0.0.1:49231/auth/callback'), false)
  assert.equal(isDesktopRedirectTarget('http://localhost:49231/auth/callback'), false)
  assert.equal(isDesktopRedirectTarget('http://127.0.0.1:49231/other'), false)
  assert.equal(isDesktopRedirectTarget('https://evil.example/auth/callback'), false)
})

test('worker desktop oauth uses one-time tickets instead of session tokens in browser URLs', () => {
  const auth = fs.readFileSync('src/worker/auth.ts', 'utf8')
  const routes = fs.readFileSync('src/worker/index.ts', 'utf8')

  assert.match(routes, /\/api\/auth\/google\/desktop\/start/)
  assert.match(routes, /\/api\/auth\/google\/desktop\/claim/)
  assert.match(auth, /createDesktopAuthTicket/)
  assert.match(auth, /desktop_auth_tickets|desktopAuthTickets/)
  assert.match(auth, /redirectUrl\.searchParams\.set\('ticket', ticket\)/)
  assert.match(auth, /isNull\(schema\.desktopAuthTickets\.consumedAt\)/)
  assert.match(auth, /sessionCookieName\(ctx\)/)
  assert.doesNotMatch(auth, /redirectUrl\.searchParams\.set\('session'/)
})
