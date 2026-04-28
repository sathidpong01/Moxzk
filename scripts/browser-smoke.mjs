import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSmokeConfig } from './auth-smoke-user.mjs'
import { loadSmokeEnv } from './smoke-env.mjs'

const DEFAULT_APP_URL = 'http://localhost:5173'
const DEFAULT_CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const DEFAULT_SAMPLE_IMAGE_PATH = path.resolve('_codex/browser-smoke/sample-page.png')

export function getBrowserSmokeSteps() {
  return [
    'browser.login',
    'browser.upload',
    'browser.save_to_album',
    'browser.open_album',
    'browser.export_zip',
  ]
}

export function buildBrowserSmokeConfig(env = process.env) {
  return {
    appUrl: normalizeUrl(env.MOXZK_BROWSER_SMOKE_APP_URL || env.MG_BROWSER_SMOKE_APP_URL || DEFAULT_APP_URL),
    worker: buildSmokeConfig(env),
    chromeExecutablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || DEFAULT_CHROME_PATH,
    sampleImagePath: env.MOXZK_BROWSER_SMOKE_IMAGE || env.MG_BROWSER_SMOKE_IMAGE || DEFAULT_SAMPLE_IMAGE_PATH,
    downloadDir: env.MOXZK_BROWSER_SMOKE_DOWNLOAD_DIR || env.MG_BROWSER_SMOKE_DOWNLOAD_DIR || path.resolve('_codex/browser-smoke/downloads'),
  }
}

export async function runBrowserSmoke(config) {
  report(config, 'browser.assert_app.start')
  await assertAppReachable(config.appUrl)
  report(config, 'browser.assert_app.done')
  const sampleImagePath = ensureSampleImage(config.sampleImagePath)
  fs.mkdirSync(config.downloadDir, { recursive: true })

  report(config, 'browser.launch.start')
  const { chromium } = await loadPlaywrightCore()
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(config.chromeExecutablePath) ? config.chromeExecutablePath : undefined,
  })
  report(config, 'browser.launch.done')
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  page.setDefaultNavigationTimeout(30_000)
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      report(config, `browser.console.${message.type()}:${message.text()}`)
    }
  })
  const checks = []
  const albumTitle = `Moxzk Browser Smoke ${Date.now()}`

  try {
    report(config, 'browser.open_app')
    await page.goto(config.appUrl, { waitUntil: 'networkidle' })
    report(config, 'browser.login.start')
    await loginThroughUi(page, config.worker.email, config.worker.password)
    checks.push({ name: 'browser.login' })
    report(config, 'browser.login.done')

    report(config, 'browser.upload.start')
    await page.setInputFiles('input[type=file]', sampleImagePath)
    await page.getByRole('button', { name: /เริ่มแก้ไข|เปิดในหน้าแก้ไข/ }).click()
    await page.getByRole('button', { name: /ส่งออก/ }).waitFor({ timeout: 15_000 })
    checks.push({ name: 'browser.upload' })
    report(config, 'browser.upload.done')

    report(config, 'browser.save_to_album.start')
    await page.getByRole('button', { name: /^บันทึก$/ }).click()
    await page.getByRole('button', { name: /สร้างอัลบั้ม/ }).click()
    await page.getByPlaceholder('เช่น One Piece Vol.1').fill(albumTitle)
    await page.getByRole('button', { name: /สร้างและบันทึก/ }).click()
    await page.getByText(/บันทึก .* ลง/).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => null)
    checks.push({ name: 'browser.save_to_album', albumTitle })
    report(config, 'browser.save_to_album.done')

    report(config, 'browser.open_album.start')
    await openAlbumThroughUi(page, albumTitle, config.worker.username, config.worker.email)
    await page.getByRole('button', { name: /ส่งออก/ }).waitFor({ timeout: 20_000 })
    checks.push({ name: 'browser.open_album', albumTitle })
    report(config, 'browser.open_album.done')

    report(config, 'browser.export_zip.start')
    await page.getByRole('button', { name: /ส่งออก/ }).click()
    await page.getByText('ตั้งค่าส่งออก').waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'บันทึกเป็น ZIP' }).waitFor({ timeout: 10_000 })
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('button', { name: /ส่งออกไฟล์/ }).click()
    const download = await downloadPromise
    const outputPath = path.join(config.downloadDir, download.suggestedFilename())
    await download.saveAs(outputPath)
    checks.push({ name: 'browser.export_zip', file: outputPath })
    report(config, 'browser.export_zip.done')

    return { ok: true, appUrl: config.appUrl, checks }
  } catch (error) {
    const failurePath = path.join(config.downloadDir, `failure-${Date.now()}.png`)
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => null)
    report(config, `browser.failure_screenshot:${failurePath}`)
    throw error
  } finally {
    report(config, 'browser.cleanup.start')
    await settleWithTimeout(context.close(), 5_000).catch(() => null)
    report(config, 'browser.cleanup.context_closed')
    await settleWithTimeout(browser.close(), 5_000).catch(() => null)
    report(config, 'browser.cleanup.browser_closed')
    await settleWithTimeout(cleanupAlbumByTitle(config.worker, albumTitle), 15_000).catch(() => null)
    report(config, 'browser.cleanup.done')
  }
}

async function loginThroughUi(page, email, password) {
  await page.getByRole('button', { name: /เปิดจากอัลบั้ม/ }).click()
  await page.getByPlaceholder('อีเมล').fill(email)
  await page.getByPlaceholder('รหัสผ่าน').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.getByPlaceholder('อีเมล').waitFor({ state: 'hidden', timeout: 15_000 })
}

async function openAlbumThroughUi(page, albumTitle, username, email) {
  const openFromUpload = page.getByRole('button', { name: /เปิดจากอัลบั้ม/ })
  if (await openFromUpload.isVisible().catch(() => false)) {
    await openFromUpload.click()
  } else {
    await openUserAlbumMenu(page, username, email)
  }
  await page.getByRole('button', { name: new RegExp(`เปิดอัลบั้มในตัวแก้ไข: ${escapeRegExp(albumTitle)}`) }).click()
}

async function openUserAlbumMenu(page, username, email) {
  const labels = [username, email?.split('@')[0], email].filter(Boolean)
  for (const label of labels) {
    const trigger = page.getByRole('button', { name: new RegExp(escapeRegExp(label), 'i') }).first()
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click()
      await page.getByRole('menuitem', { name: /อัลบั้มของฉัน/ }).click()
      return
    }
  }
  throw new Error('Could not find the signed-in user menu to open albums.')
}

async function cleanupAlbumByTitle(worker, albumTitle) {
  const cookieHeader = await loginForCookie(worker)
  const albums = await apiJson(worker.baseUrl, '/api/albums', { cookieHeader })
  for (const album of albums.data ?? []) {
    if (album.title !== albumTitle) continue
    await apiJson(worker.baseUrl, `/api/albums/${encodeURIComponent(album.id)}`, {
      method: 'DELETE',
      cookieHeader,
    })
  }
}

async function loginForCookie(worker) {
  const response = await fetch(`${worker.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: worker.email, password: worker.password }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`browser smoke cleanup login failed: ${response.status}`)
  const cookieHeader = getSetCookieHeaders(response)
    .map((value) => value.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
  if (!cookieHeader) throw new Error('browser smoke cleanup did not receive a session cookie')
  return cookieHeader
}

async function apiJson(baseUrl, apiPath, { method = 'GET', cookieHeader } = {}) {
  const response = await fetch(`${baseUrl}${apiPath}`, {
    method,
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${method} ${apiPath} failed: ${response.status}`)
  return payload
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie()
  const value = response.headers.get('set-cookie')
  return value ? [value] : []
}

async function assertAppReachable(appUrl) {
  const response = await fetch(appUrl, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Browser smoke app URL is not reachable: ${appUrl} (${response.status}). Start npm run dev first.`)
}

async function loadPlaywrightCore() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright-core')
  } catch {
    const fallback = path.resolve('_codex/browser-check/node_modules/playwright-core')
    if (fs.existsSync(fallback)) return require(fallback)
    throw new Error('playwright-core is required for browser smoke. Install it or set NODE_PATH to a playwright-core install.')
  }
}

function ensureSampleImage(sampleImagePath) {
  fs.mkdirSync(path.dirname(sampleImagePath), { recursive: true })
  const shouldWriteDefault = path.resolve(sampleImagePath) === DEFAULT_SAMPLE_IMAGE_PATH
  if (shouldWriteDefault || !fs.existsSync(sampleImagePath)) {
    fs.writeFileSync(sampleImagePath, Buffer.from(SAMPLE_PNG_BASE64, 'base64'))
  }
  return sampleImagePath
}

function normalizeUrl(value) {
  const url = new URL(value.trim())
  return url.toString().replace(/\/+$/, '')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function main() {
  const config = buildBrowserSmokeConfig(loadSmokeEnv())
  config.report = (step) => console.log(`[browser-smoke] ${step}`)
  const result = await runBrowserSmoke(config)
  console.log(JSON.stringify({
    ok: result.ok,
    appUrl: result.appUrl,
    checks: result.checks.map((check) => check.name),
  }, null, 2))
}

function report(config, step) {
  if (typeof config.report === 'function') config.report(step)
}

async function settleWithTimeout(promise, timeoutMs) {
  let timeoutId
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAFAAAAB4CAIAAADqjOKhAAAArUlEQVR42u3YMQ0AIAxE0cpBCTqRiAQc3Nik5CVdO7zt8uvuE27Fm/hbwMDAwMDAwMBt4P9I+RcYGBgYGBgYuA9sSwMDAwMDAwMDa1q2NDAwMDAwMLCmZUsDAwMDAwMDA2tawMDAwMDAwMCali0NDAwMDAwMrGnZ0sDAwMDAwMDAmhYwMDAwMDAwsKZlSwMDAwMDAwNrWrY0MDAwMDAwMLCmBQwMDAwMDAzc9vsAom82Kwt2zyIAAAAASUVORK5CYII='

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}

