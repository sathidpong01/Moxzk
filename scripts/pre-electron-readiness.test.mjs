import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createProjectDraftSnapshot, normalizeProjectDraft } from '../src/services/projectDraftStorage.ts'
import { decodeDesktopProjectDraft, encodeDesktopProjectDraft } from '../src/runtime/desktopDraftCodec.ts'
import { buildOcrReviewSummary, sortRegionsForReview } from '../src/services/translationReview.ts'

function region(overrides = {}) {
  return {
    id: 'r1',
    bbox: { x: 0, y: 0, width: 100, height: 40 },
    originalText: 'こんにちは',
    translatedText: 'สวัสดี',
    mood: 'normal',
    suggestedFont: 'normal',
    fontSize: 18,
    fontColor: '#111111',
    rotation: 0,
    strokeWidth: 0,
    strokeColor: '#ffffff',
    ...overrides,
  }
}

function imageEntry(overrides = {}) {
  return {
    id: 'p1',
    file: null,
    originalUrl: 'blob:old',
    cleanedImageUrl: null,
    regions: [],
    brushStrokes: [],
    status: 'pending',
    pageNumber: 1,
    ...overrides,
  }
}

function settings() {
  return {
    panelCleanerBridgeUrl: 'http://localhost:5055',
    panelCleanerExecutablePath: '',
    sourceLang: 'auto',
    fontMoodMap: {},
    theme: 'studio-dark',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma4',
    ollamaApiKey: '',
    translationContextEnabled: true,
    translationStyleGuide: 'keep context',
  }
}

test('runtime contract covers pre-Electron native seams', () => {
  const contract = fs.readFileSync('src/runtime/types.ts', 'utf8')
  const webRuntime = fs.readFileSync('src/runtime/webRuntime.ts', 'utf8')

  assert.match(contract, /interface AppRuntime/)
  assert.match(contract, /canStartLocalServices/)
  assert.match(contract, /panelCleaner/)
  assert.match(contract, /saveFile/)
  assert.match(contract, /saveExportFiles/)
  assert.match(contract, /projectDraft/)
  assert.match(webRuntime, /class WebRuntime implements AppRuntime/)
  assert.match(webRuntime, /canStartLocalServices:\s*false/)
  assert.match(webRuntime, /defaultPanelCleanerClient\.getStatus/)
})

test('project draft snapshot keeps full page list and active page edits', () => {
  const activeRegion = region({ id: 'active-region', translatedText: 'หลังแก้' })
  const inactiveRegion = region({ id: 'inactive-region', translatedText: 'เดิม' })
  const draft = createProjectDraftSnapshot({
    currentStep: 'edit',
    imageEntries: [
      imageEntry({ id: 'p1', regions: [inactiveRegion] }),
      imageEntry({ id: 'p2', originalUrl: 'blob:before', regions: [] }),
    ],
    activeImageId: 'p2',
    regions: [activeRegion],
    brushStrokes: [{ id: 's1', points: [1, 2], color: '#fff', width: 4, opacity: 1, shadowBlur: 0, tool: 'brush' }],
    cleanedImageUrl: 'blob:cleaned',
    originalImageUrl: 'blob:active-original',
    settings: settings(),
  })

  assert.ok(draft)
  assert.equal(draft.imageEntries.length, 2)
  assert.equal(draft.imageEntries[0].regions[0].id, 'inactive-region')
  assert.equal(draft.imageEntries[1].regions[0].id, 'active-region')
  assert.equal(draft.imageEntries[1].originalUrl, 'blob:active-original')
  assert.equal(draft.imageEntries[1].cleanedImageUrl, 'blob:cleaned')
})

test('legacy export-step drafts normalize back to edit mode', () => {
  const draft = normalizeProjectDraft({
    version: 1,
    savedAt: Date.now(),
    currentStep: 'export',
    activeImageId: 'p1',
    imageEntries: [imageEntry()],
    regions: [],
    brushStrokes: [],
    cleanedImageUrl: null,
    originalImageUrl: 'blob:old',
    settings: settings(),
  })

  assert.ok(draft)
  assert.equal(draft.currentStep, 'edit')
})

test('translation review flags low confidence and sorts review-first', () => {
  const good = region({ id: 'good', confidence: 0.95 })
  const low = region({ id: 'low', confidence: 0.4 })
  const empty = region({ id: 'empty', originalText: '', confidence: 0.99 })
  const untranslated = region({ id: 'untranslated', translatedText: '', confidence: 0.8 })
  const summary = buildOcrReviewSummary([good, low, empty, untranslated])
  const sorted = sortRegionsForReview([good, low, empty, untranslated])

  assert.equal(summary.total, 4)
  assert.equal(summary.lowConfidence, 1)
  assert.equal(summary.emptyOriginalText, 1)
  assert.equal(summary.emptyTranslatedText, 1)
  assert.equal(summary.needsReview, true)
  assert.deepEqual(sorted.map((item) => item.id), ['empty', 'low', 'untranslated', 'good'])
})

test('legacy backend docs removed, R2 export path exists, and Electron V1 dependencies are present', () => {
  const readme = fs.readFileSync('README.md', 'utf8')
  const exporter = fs.readFileSync('src/services/exporter.ts', 'utf8')
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

  assert.equal(readme.includes('manga-image-translator'), false)
  assert.equal(fs.existsSync('docker-compose.yml'), false)
  assert.equal(exporter.includes("TODO: If it's an R2 key"), false)
  assert.match(exporter, /downloadImage\(key\)/)
  assert.equal(Boolean(packageJson.devDependencies?.electron), true)
  assert.equal(Boolean(packageJson.devDependencies?.['electron-vite']), true)
  assert.equal(packageJson.scripts?.['electron:dev'], 'node scripts/electron-dev.mjs')
  assert.match(fs.readFileSync('scripts/electron-dev.mjs', 'utf8'), /Stop-Process/)
})

test('panelcleaner bridge keeps a lightweight health check before Electron', () => {
  const bridge = fs.readFileSync('scripts/panelcleaner-bridge.mjs', 'utf8')

  assert.match(bridge, /STATUS_CACHE_TTL_MS/)
  assert.match(bridge, /service: 'panelcleaner-bridge'/)
  assert.match(bridge, /getCachedPanelCleanerStatus/)
})

test('export flow exposes an explicit zip-first destination choice before Electron', () => {
  const contract = fs.readFileSync('src/runtime/types.ts', 'utf8')
  const drawerModel = fs.readFileSync('src/services/exportDrawer.ts', 'utf8')
  const drawer = fs.readFileSync('src/components/Editor/ExportDrawer.tsx', 'utf8')

  assert.match(contract, /RuntimeExportDestination\s*=\s*'zip'\s*\|\s*'folder'/)
  assert.match(contract, /destination\?:\s*RuntimeExportDestination/)
  assert.match(drawerModel, /DEFAULT_EXPORT_DESTINATION\s*=\s*'zip'/)
  assert.match(drawerModel, /EXPORT_DESTINATION_OPTIONS/)
  assert.match(drawer, /บันทึกเป็น ZIP/)
  assert.match(drawer, /บันทึกลงโฟลเดอร์/)
  assert.match(drawer, /Chrome จะขอสิทธิ์/)
})

test('feature code uses runtime provider instead of importing webRuntime directly', () => {
  const settingsPanel = fs.readFileSync('src/components/Settings/SettingsPanel.tsx', 'utf8')
  const exporter = fs.readFileSync('src/services/exporter.ts', 'utf8')
  const runtimeIndex = fs.readFileSync('src/runtime/index.ts', 'utf8')

  assert.doesNotMatch(settingsPanel, /webRuntime/)
  assert.doesNotMatch(exporter, /webRuntime/)
  assert.match(runtimeIndex, /getAppRuntime/)
  assert.match(runtimeIndex, /setAppRuntime/)
})

test('runtime contract names native service and secure desktop capabilities', () => {
  const contract = fs.readFileSync('src/runtime/types.ts', 'utf8')
  const webRuntime = fs.readFileSync('src/runtime/webRuntime.ts', 'utf8')

  assert.match(contract, /localServices/)
  assert.match(contract, /auth/)
  assert.match(contract, /signInWithGoogle/)
  assert.match(contract, /startOllama/)
  assert.match(contract, /startPanelCleanerBridge/)
  assert.match(contract, /secureStore/)
  assert.match(contract, /customProtocolAuth/)
  assert.match(webRuntime, /unsupportedRuntimeAction/)
})

test('pre-Electron IPC contract and desktop smoke path are documented', () => {
  const ipcContract = fs.readFileSync('docs/electron/ipc-contract.md', 'utf8')
  const smokeTest = fs.readFileSync('docs/electron/desktop-smoke-test.md', 'utf8')

  assert.match(ipcContract, /contextIsolation:\s*true/)
  assert.match(ipcContract, /nodeIntegration:\s*false/)
  assert.match(ipcContract, /sandbox:\s*true/)
  assert.match(ipcContract, /ห้าม expose raw ipcRenderer/)
  assert.match(ipcContract, /AppRuntime/)
  assert.match(smokeTest, /เปิด album/)
  assert.match(smokeTest, /cleanup\/OCR\/translate/)
  assert.match(smokeTest, /autosave\/restore/)
  assert.match(smokeTest, /export/)
  assert.match(smokeTest, /auth callback/)
})

test('Electron shell keeps secure BrowserWindow defaults and external navigation handling', () => {
  const mainProcess = fs.readFileSync('electron/main/index.ts', 'utf8')
  const electronVite = fs.readFileSync('electron.vite.config.ts', 'utf8')

  assert.match(mainProcess, /contextIsolation:\s*true/)
  assert.match(mainProcess, /nodeIntegration:\s*false/)
  assert.match(mainProcess, /sandbox:\s*true/)
  assert.match(mainProcess, /setWindowOpenHandler/)
  assert.match(mainProcess, /shell\.openExternal/)
  assert.doesNotMatch(mainProcess, /isAllowedAuthNavigation/)
  assert.doesNotMatch(mainProcess, /accounts\.google\.com/)
  assert.match(mainProcess, /ELECTRON_RENDERER_URL/)
  assert.match(mainProcess, /loadFile\(path\.join\(mainDir,\s*'..\/renderer\/index\.html'\)\)/)
  assert.match(electronVite, /VITE_CLOUDFLARE_API_URL/)
  assert.match(electronVite, /defaultElectronWorkerApiUrl/)
  assert.match(electronVite, /mg-translater-api\.sathidpong01\.workers\.dev/)
  assert.match(electronVite, /target:\s*workerApiTarget/)
  assert.match(electronVite, /__MG_WORKER_API_BASE__:\s*JSON\.stringify\(workerApiTarget\)/)
  assert.match(electronVite, /import\.meta\.env\.VITE_CLOUDFLARE_API_URL/)
  assert.match(electronVite, /'\/api'/)
})

test('Electron IPC surface only exposes V1 runtime channels', () => {
  const channels = fs.readFileSync('electron/shared/ipcChannels.ts', 'utf8')
  const preload = fs.readFileSync('electron/preload/index.ts', 'utf8')
  const rendererRuntime = fs.readFileSync('src/runtime/electronRuntime.ts', 'utf8')
  const mainIpc = fs.readFileSync('electron/main/ipc.ts', 'utf8')

  for (const channel of [
    'runtime:files.saveFile',
    'runtime:files.saveExportFiles',
    'runtime:projectDraft.save',
    'runtime:projectDraft.load',
    'runtime:projectDraft.clear',
    'runtime:localServices.startPanelCleanerBridge',
    'runtime:localServices.startOllama',
    'runtime:auth.signInWithGoogle',
  ]) {
    assert.match(channels, new RegExp(channel.replace('.', '\\.')))
  }

  assert.doesNotMatch(channels, /secureStore/)
  assert.doesNotMatch(channels, /customProtocolAuth/)
  assert.match(preload, /contextBridge\.exposeInMainWorld\('mgRuntime'/)
  assert.match(preload, /localServices/)
  assert.match(preload, /auth/)
  assert.match(preload, /ipcRenderer\.invoke/)
  assert.match(mainIpc, /startPanelCleanerBridge/)
  assert.match(mainIpc, /startOllama/)
  assert.match(mainIpc, /signInWithGoogleSystemBrowser/)
  assert.doesNotMatch(rendererRuntime, /ipcRenderer/)
})

test('Electron runtime installs through window bridge and keeps unsupported desktop stubs explicit', () => {
  const main = fs.readFileSync('src/main.tsx', 'utf8')
  const runtime = fs.readFileSync('src/runtime/electronRuntime.ts', 'utf8')

  assert.match(main, /installElectronRuntimeIfAvailable\(\)/)
  assert.match(runtime, /class ElectronRuntime implements AppRuntime/)
  assert.match(runtime, /kind = 'electron'/)
  assert.match(runtime, /canPickNativeFolders:\s*true/)
  assert.match(runtime, /canStartLocalServices:\s*true/)
  assert.match(runtime, /bridge\.localServices\.startOllama/)
  assert.match(runtime, /bridge\.localServices\.startPanelCleanerBridge/)
  assert.match(runtime, /bridge\.auth\.signInWithGoogle/)
  assert.match(runtime, /Electron V1 does not provide secure secret storage yet/)
})

test('Electron Google login uses system browser and loopback ticket claim', () => {
  const desktopAuth = fs.readFileSync('electron/main/desktopAuth.ts', 'utf8')
  const authStore = fs.readFileSync('src/store/authStore.ts', 'utf8')
  const webRuntime = fs.readFileSync('src/runtime/webRuntime.ts', 'utf8')

  assert.match(desktopAuth, /shell\.openExternal/)
  assert.match(desktopAuth, /createServer/)
  assert.match(desktopAuth, /127\.0\.0\.1/)
  assert.match(desktopAuth, /\/api\/auth\/google\/desktop\/start/)
  assert.match(desktopAuth, /\/api\/auth\/google\/desktop\/claim/)
  assert.doesNotMatch(desktopAuth, /ELECTRON_RENDERER_URL/)
  assert.match(desktopAuth, /session\.defaultSession\.cookies\.set/)
  assert.match(desktopAuth, /activeGoogleLogin/)
  assert.match(authStore, /getAppRuntime/)
  assert.match(authStore, /runtime\.auth\.signInWithGoogle/)
  assert.match(authStore, /hasElectronBridge/)
  assert.match(webRuntime, /window\.mgRuntime\?\.auth/)
  assert.match(webRuntime, /isElectronUserAgent/)
  assert.match(webRuntime, /Electron auth bridge is not available/)
})

test('Electron native service launcher is loopback-only and keeps external dependencies explicit', () => {
  const serviceLauncher = fs.readFileSync('electron/main/localServices.ts', 'utf8')
  const settingsPanel = fs.readFileSync('src/components/Settings/SettingsPanel.tsx', 'utf8')

  assert.match(serviceLauncher, /spawn/)
  assert.match(serviceLauncher, /http:\/\/127\.0\.0\.1:5055\/health/)
  assert.match(serviceLauncher, /http:\/\/127\.0\.0\.1:11434\/api\/version/)
  assert.match(serviceLauncher, /PANELCLEANER_ALLOWED_ORIGIN/)
  assert.match(serviceLauncher, /scripts', 'panelcleaner-bridge\.mjs'/)
  assert.match(serviceLauncher, /ollama\.exe/)
  assert.match(settingsPanel, /handleStartPanelCleaner/)
  assert.match(settingsPanel, /handleStartOllama/)
  assert.match(settingsPanel, /appRuntime\.localServices/)
  assert.doesNotMatch(settingsPanel, /ipcRenderer/)
})

test('desktop draft codec round-trips multi-page image assets and edits', async () => {
  const originalFile = new File([new Blob(['original image bytes'], { type: 'image/webp' })], 'page-001.webp', { type: 'image/webp' })
  const cleanedBlob = new Blob(['cleaned image bytes'], { type: 'image/webp' })
  const cleanedUrl = URL.createObjectURL(cleanedBlob)
  const activeRegion = region({ id: 'active-region', translatedText: 'เดสก์ท็อป' })
  const activeStroke = { id: 's1', points: [1, 2, 3, 4], color: '#fff', width: 4, opacity: 1, shadowBlur: 0, tool: 'brush' }
  const draft = createProjectDraftSnapshot({
    currentStep: 'edit',
    imageEntries: [
      imageEntry({ id: 'p1', file: originalFile, originalUrl: URL.createObjectURL(originalFile), regions: [] }),
      imageEntry({ id: 'p2', originalUrl: 'https://example.test/page.webp', cleanedImageUrl: cleanedUrl, regions: [region({ id: 'inactive' })] }),
    ],
    activeImageId: 'p1',
    regions: [activeRegion],
    brushStrokes: [activeStroke],
    cleanedImageUrl: cleanedUrl,
    originalImageUrl: null,
    settings: settings(),
  })

  assert.ok(draft)
  const encoded = await encodeDesktopProjectDraft(draft)
  const decoded = decodeDesktopProjectDraft(encoded)

  assert.ok(decoded)
  assert.equal(encoded.assets.length >= 2, true)
  assert.equal(decoded.imageEntries.length, 2)
  assert.equal(decoded.imageEntries[0].file?.name, 'page-001.webp')
  assert.equal(decoded.imageEntries[0].regions[0].id, 'active-region')
  assert.equal(decoded.imageEntries[0].brushStrokes[0].id, 's1')
  assert.equal(decoded.imageEntries[1].cleanedImageUrl?.startsWith('blob:'), true)
  assert.equal(decoded.regions[0].translatedText, 'เดสก์ท็อป')

  URL.revokeObjectURL(cleanedUrl)
})

test('Electron production API calls have a remote Worker URL through electron-vite defaults', () => {
  const api = fs.readFileSync('src/services/cloudflareApi.ts', 'utf8')
  const electronVite = fs.readFileSync('electron.vite.config.ts', 'utf8')

  assert.match(api, /VITE_CLOUDFLARE_API_URL/)
  assert.match(api, /isElectronRenderer/)
  assert.match(api, /Set VITE_CLOUDFLARE_API_URL for Electron production builds/)
  assert.match(api, /import\.meta\.env\.DEV\)\s*return ''/)
  assert.match(electronVite, /defaultElectronWorkerApiUrl/)
})
