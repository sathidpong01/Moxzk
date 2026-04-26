import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBrowserSmokeConfig, getBrowserSmokeSteps } from './browser-smoke.mjs'

test('buildBrowserSmokeConfig uses online Worker auth config and local app url by default', () => {
  const config = buildBrowserSmokeConfig({
    VITE_CLOUDFLARE_API_URL: 'https://mg-translater-api.example.workers.dev',
    MG_AUTH_SMOKE_EMAIL: 'smoke@example.com',
    MG_AUTH_SMOKE_PASSWORD: 'secret-password-12345',
  })

  assert.equal(config.worker.baseUrl, 'https://mg-translater-api.example.workers.dev')
  assert.equal(config.appUrl, 'http://localhost:5173')
})

test('browser smoke steps cover login, save/open album, and zip export', () => {
  assert.deepEqual(getBrowserSmokeSteps(), [
    'browser.login',
    'browser.upload',
    'browser.save_to_album',
    'browser.open_album',
    'browser.export_zip',
  ])
})
