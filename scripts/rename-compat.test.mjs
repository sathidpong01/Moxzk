import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const checkedFiles = [
  'README.md',
  'wrangler.jsonc',
  'electron/preload/index.ts',
  'scripts/auth-smoke-user.mjs',
  'src/config/appIdentity.ts',
  'src/runtime/desktopDraftCodec.ts',
  'src/runtime/electronBridge.ts',
  'src/runtime/electronRuntime.ts',
  'src/services/cloudflareApi.ts',
  'src/services/fontStorage.ts',
  'src/services/imageCache.ts',
  'src/services/localServiceUsage.ts',
  'src/services/projectDraftStorage.ts',
  'src/services/settingsStorage.ts',
  'src/services/translationMemory.ts',
  'src/store/authStore.ts',
  'src/worker/auth.ts',
  'src/worker/env.d.ts',
]

const removedAliases = [
  ['M', 'G', ' Translater'],
  ['m', 'g', '-translater'],
  ['m', 'g', '_session'],
  ['m', 'g', '-asset'],
  ['m', 'g', '-project'],
  ['m', 'g', '-translation'],
  ['X-', 'M', 'G'],
  ['M', 'G', '_AUTH'],
  ['M', 'G', '_BROWSER'],
  ['m', 'g', 'Runtime'],
].map((parts) => parts.join(''))

test('Moxzk rename has no removed brand aliases in active tracked surfaces', () => {
  for (const file of checkedFiles) {
    const contents = fs.readFileSync(file, 'utf8')
    for (const alias of removedAliases) {
      assert.equal(contents.includes(alias), false, `${file} still contains removed alias ${alias}`)
    }
  }
})

test('Moxzk rename uses only current app identity and storage names', () => {
  const appIdentity = fs.readFileSync('src/config/appIdentity.ts', 'utf8')
  const settingsStorage = fs.readFileSync('src/services/settingsStorage.ts', 'utf8')
  const imageCache = fs.readFileSync('src/services/imageCache.ts', 'utf8')
  const fontStorage = fs.readFileSync('src/services/fontStorage.ts', 'utf8')
  const translationMemory = fs.readFileSync('src/services/translationMemory.ts', 'utf8')
  const projectDraftStorage = fs.readFileSync('src/services/projectDraftStorage.ts', 'utf8')
  const desktopDraftCodec = fs.readFileSync('src/runtime/desktopDraftCodec.ts', 'utf8')
  const workerAuth = fs.readFileSync('src/worker/auth.ts', 'utf8')
  const wranglerConfig = fs.readFileSync('wrangler.jsonc', 'utf8')

  assert.match(appIdentity, /APP_DISPLAY_NAME = 'Moxzk'/)
  assert.match(appIdentity, /APP_SLUG = 'moxzk'/)
  assert.match(appIdentity, /SESSION_COOKIE_NAME = 'moxzk_session'/)
  assert.match(settingsStorage, /SETTINGS_KEY = 'moxzk-settings'/)
  assert.match(imageCache, /DB_NAME = 'moxzk-cache'/)
  assert.match(fontStorage, /DB_NAME = 'moxzk-fonts'/)
  assert.match(translationMemory, /DB_NAME = 'moxzk-translation-memory'/)
  assert.match(projectDraftStorage, /DB_NAME = 'moxzk-project-drafts'/)
  assert.match(desktopDraftCodec, /ASSET_URL_PREFIX = 'moxzk-asset:\/\/'/)
  assert.match(workerAuth, /X-Moxzk-Desktop-Auth-Origin/)
  assert.match(wranglerConfig, /moxzk:\/\/auth\/callback/)
})
