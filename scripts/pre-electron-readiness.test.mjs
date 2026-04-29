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
  const electronDevScript = fs.readFileSync('scripts/electron-dev.mjs', 'utf8')
  assert.match(electronDevScript, /Stop-Process/)
  assert.match(electronDevScript, /process\.execPath/)
  assert.match(electronDevScript, /electron-vite', 'bin', 'electron-vite\.js'/)
  assert.doesNotMatch(electronDevScript, /npx\.cmd/)
})

test('panelcleaner bridge keeps a lightweight health check before Electron', () => {
  const bridge = fs.readFileSync('scripts/panelcleaner-bridge.mjs', 'utf8')

  assert.match(bridge, /STATUS_CACHE_TTL_MS/)
  assert.match(bridge, /service: 'panelcleaner-bridge'/)
  assert.match(bridge, /getCachedPanelCleanerStatus/)
  assert.match(bridge, /fileURLToPath\(import\.meta\.url\)/)
  assert.match(bridge, /LOCAL_VENV_PYTHON/)
  assert.match(bridge, /PANELCLEANER_MANAGED_VENV_DIR/)
  assert.match(bridge, /source:\s*'managed'/)
  assert.match(bridge, /source:\s*'dev'/)
  assert.match(bridge, /source:\s*'path'/)
  assert.match(bridge, /PCLEANER_MAIN_SNIPPET/)
  assert.doesNotMatch(bridge, /resolve\(process\.cwd\(\), '\.venv-panelcleaner'/)
})

test('Electron exposes a managed PanelCleaner installer without bundling PanelCleaner', () => {
  const channels = fs.readFileSync('electron/shared/ipcChannels.ts', 'utf8')
  const preload = fs.readFileSync('electron/preload/index.ts', 'utf8')
  const runtime = fs.readFileSync('src/runtime/types.ts', 'utf8')
  const nativeBridge = fs.readFileSync('src/runtime/electronBridge.ts', 'utf8')
  const dependencyManager = fs.readFileSync('electron/main/panelCleanerDependency.ts', 'utf8')
  const serviceLauncher = fs.readFileSync('electron/main/localServices.ts', 'utf8')
  const settingsPanel = fs.readFileSync('src/components/Settings/SettingsPanel.tsx', 'utf8')

  assert.match(channels, /runtime:localServices\.panelCleanerDependencyStatus/)
  assert.match(channels, /runtime:localServices\.installPanelCleaner/)
  assert.match(channels, /runtime:localServices\.repairPanelCleaner/)
  assert.match(channels, /runtime:localServices\.pickPanelCleanerExecutable/)
  assert.match(preload, /getPanelCleanerDependencyStatus/)
  assert.match(preload, /installPanelCleaner/)
  assert.match(preload, /repairPanelCleaner/)
  assert.match(preload, /pickPanelCleanerExecutable/)
  assert.match(runtime, /PanelCleanerDependencyStatus/)
  assert.match(nativeBridge, /NativePanelCleanerDependencyStatus/)
  assert.match(dependencyManager, /pcleaner-cli==2\.11\.9/)
  assert.match(dependencyManager, /panelcleaner-venv/)
  assert.match(dependencyManager, /app\.getPath\('userData'\)/)
  assert.match(dependencyManager, /python -m venv/)
  assert.match(dependencyManager, /python -m pip install/)
  assert.match(serviceLauncher, /PANELCLEANER_MANAGED_VENV_DIR/)
  assert.match(settingsPanel, /ติดตั้ง PanelCleaner/)
  assert.match(settingsPanel, /ซ่อม PanelCleaner/)
  assert.match(settingsPanel, /เลือกไฟล์เอง/)
  assert.match(settingsPanel, /GPLv3/)
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

  assert.match(contract, /canUseCustomWindowControls/)
  assert.match(contract, /localServices/)
  assert.match(contract, /auth/)
  assert.match(contract, /signInWithGoogle/)
  assert.match(contract, /startOllama/)
  assert.match(contract, /startPanelCleanerBridge/)
  assert.match(contract, /secureStore/)
  assert.match(contract, /customProtocolAuth/)
  assert.match(contract, /windowControls/)
  assert.match(contract, /toggleMaximize/)
  assert.match(webRuntime, /unsupportedRuntimeAction/)
  assert.match(webRuntime, /Web runtime cannot control native windows/)
})

test('pre-Electron IPC contract and desktop smoke path are documented', () => {
  const ipcContract = fs.readFileSync('docs/electron/ipc-contract.md', 'utf8')
  const smokeTest = fs.readFileSync('docs/electron/desktop-smoke-test.md', 'utf8')

  assert.match(ipcContract, /contextIsolation:\s*true/)
  assert.match(ipcContract, /nodeIntegration:\s*false/)
  assert.match(ipcContract, /sandbox:\s*true/)
  assert.match(ipcContract, /ห้าม expose raw ipcRenderer/)
  assert.match(ipcContract, /AppRuntime/)
  assert.match(ipcContract, /Windows-only/)
  assert.match(ipcContract, /windowControls/)
  assert.match(smokeTest, /เปิด album/)
  assert.match(smokeTest, /cleanup\/OCR\/translate/)
  assert.match(smokeTest, /autosave\/restore/)
  assert.match(smokeTest, /export/)
  assert.match(smokeTest, /auth callback/)
  assert.match(smokeTest, /Windows-only/)
  assert.match(smokeTest, /frameless/)
})

test('Electron shell keeps secure Windows-only frameless BrowserWindow defaults and external navigation handling', () => {
  const mainProcess = fs.readFileSync('electron/main/index.ts', 'utf8')
  const electronVite = fs.readFileSync('electron.vite.config.ts', 'utf8')

  assert.match(mainProcess, /APP_DISPLAY_NAME/)
  assert.match(mainProcess, /frame:\s*false/)
  assert.match(mainProcess, /thickFrame:\s*true/)
  assert.match(mainProcess, /roundedCorners:\s*true/)
  assert.match(mainProcess, /contextIsolation:\s*true/)
  assert.match(mainProcess, /nodeIntegration:\s*false/)
  assert.match(mainProcess, /sandbox:\s*true/)
  assert.match(mainProcess, /setWindowOpenHandler/)
  assert.match(mainProcess, /shell\.openExternal/)
  assert.doesNotMatch(mainProcess, /isAllowedAuthNavigation/)
  assert.doesNotMatch(mainProcess, /accounts\.google\.com/)
  assert.match(mainProcess, /ELECTRON_RENDERER_URL/)
  assert.match(mainProcess, /preload\/index\.cjs/)
  assert.match(mainProcess, /loadFile\(path\.join\(mainDir,\s*'..\/renderer\/index\.html'\)\)/)
  assert.match(mainProcess, /window-all-closed/)
  assert.match(mainProcess, /app\.quit\(\)/)
  assert.doesNotMatch(mainProcess, /process\.platform\s*!==\s*'darwin'/)
  assert.doesNotMatch(mainProcess, /app\.on\('activate'/)
  assert.match(electronVite, /VITE_CLOUDFLARE_API_URL/)
  assert.match(electronVite, /defaultElectronWorkerApiUrl/)
  assert.match(electronVite, /moxzk-api\.sathidpong01\.workers\.dev/)
  assert.match(electronVite, /target:\s*workerApiTarget/)
  assert.match(electronVite, /__MOXZK_WORKER_API_BASE__:\s*JSON\.stringify\(workerApiTarget\)/)
  assert.match(electronVite, /format:\s*'cjs'/)
  assert.match(electronVite, /entryFileNames:\s*'\[name\]\.cjs'/)
  assert.match(electronVite, /import\.meta\.env\.VITE_CLOUDFLARE_API_URL/)
  assert.match(electronVite, /'\/api'/)
})

test('Electron IPC surface only exposes V1 runtime and window-control channels', () => {
  const channels = fs.readFileSync('electron/shared/ipcChannels.ts', 'utf8')
  const preload = fs.readFileSync('electron/preload/index.ts', 'utf8')
  const rendererRuntime = fs.readFileSync('src/runtime/electronRuntime.ts', 'utf8')
  const mainIpc = fs.readFileSync('electron/main/ipc.ts', 'utf8')
  const removedBridgeName = ['m', 'g', 'Runtime'].join('')

  for (const channel of [
    'runtime:files.saveFile',
    'runtime:files.saveExportFiles',
    'runtime:projectDraft.save',
    'runtime:projectDraft.load',
    'runtime:projectDraft.clear',
    'runtime:localServices.startPanelCleanerBridge',
    'runtime:localServices.startOllama',
    'runtime:localServices.beginUsage',
    'runtime:localServices.endUsage',
    'runtime:localServices.getManagedStatus',
    'runtime:localServices.panelCleanerDependencyStatus',
    'runtime:localServices.installPanelCleaner',
    'runtime:localServices.repairPanelCleaner',
    'runtime:localServices.pickPanelCleanerExecutable',
    'runtime:localServices.stopOwnedServices',
    'runtime:auth.signInWithGoogle',
    'runtime:windowControls.minimize',
    'runtime:windowControls.toggleMaximize',
    'runtime:windowControls.close',
    'runtime:windowControls.getState',
    'runtime:windowControls.stateChanged',
  ]) {
    assert.match(channels, new RegExp(channel.replace('.', '\\.')))
  }

  assert.doesNotMatch(channels, /secureStore/)
  assert.doesNotMatch(channels, /customProtocolAuth/)
  assert.match(preload, /contextBridge\.exposeInMainWorld\('moxzkRuntime'/)
  assert.equal(preload.includes(removedBridgeName), false)
  assert.match(preload, /localServices/)
  assert.match(preload, /beginUsage/)
  assert.match(preload, /endUsage/)
  assert.match(preload, /getManagedStatus/)
  assert.match(preload, /getPanelCleanerDependencyStatus/)
  assert.match(preload, /installPanelCleaner/)
  assert.match(preload, /repairPanelCleaner/)
  assert.match(preload, /pickPanelCleanerExecutable/)
  assert.match(preload, /stopOwnedServices/)
  assert.match(preload, /auth/)
  assert.match(preload, /windowControls/)
  assert.match(preload, /onStateChange/)
  assert.match(preload, /removeListener/)
  assert.match(preload, /ipcRenderer\.invoke/)
  assert.match(mainIpc, /startPanelCleanerBridge/)
  assert.match(mainIpc, /startOllama/)
  assert.match(mainIpc, /beginUsage/)
  assert.match(mainIpc, /endUsage/)
  assert.match(mainIpc, /getManagedStatus/)
  assert.match(mainIpc, /getPanelCleanerDependencyStatus/)
  assert.match(mainIpc, /installPanelCleaner/)
  assert.match(mainIpc, /repairPanelCleaner/)
  assert.match(mainIpc, /pickPanelCleanerExecutable/)
  assert.match(mainIpc, /stopOwnedServices/)
  assert.match(mainIpc, /signInWithGoogleSystemBrowser/)
  assert.match(mainIpc, /BrowserWindow\.fromWebContents/)
  assert.match(mainIpc, /windowControlsToggleMaximize/)
  assert.doesNotMatch(rendererRuntime, /ipcRenderer/)
})

test('Electron runtime installs through window bridge and keeps unsupported desktop stubs explicit', () => {
  const main = fs.readFileSync('src/main.tsx', 'utf8')
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const runtime = fs.readFileSync('src/runtime/electronRuntime.ts', 'utf8')
  const chromeBar = fs.readFileSync('src/components/Layout/AppChromeBar.tsx', 'utf8')
  const css = fs.readFileSync('src/index.css', 'utf8')

  assert.match(main, /installElectronRuntimeIfAvailable\(\)/)
  assert.match(app, /AppChromeBar/)
  assert.match(app, /moxzk-has-custom-chrome/)
  assert.match(app, /moxzk-app-chrome/)
  assert.match(app, /moxzk-command-dock/)
  assert.match(runtime, /class ElectronRuntime implements AppRuntime/)
  assert.match(runtime, /kind = 'electron'/)
  assert.match(runtime, /canPickNativeFolders:\s*true/)
  assert.match(runtime, /canStartLocalServices:\s*true/)
  assert.match(runtime, /canUseCustomWindowControls:\s*true/)
  assert.match(runtime, /bridge\.localServices\.beginUsage/)
  assert.match(runtime, /bridge\.localServices\.endUsage/)
  assert.match(runtime, /bridge\.localServices\.getManagedStatus/)
  assert.match(runtime, /bridge\.localServices\.getPanelCleanerDependencyStatus/)
  assert.match(runtime, /bridge\.localServices\.installPanelCleaner/)
  assert.match(runtime, /bridge\.localServices\.repairPanelCleaner/)
  assert.match(runtime, /bridge\.localServices\.pickPanelCleanerExecutable/)
  assert.match(runtime, /bridge\.localServices\.stopOwnedServices/)
  assert.match(runtime, /bridge\.localServices\.startOllama/)
  assert.match(runtime, /bridge\.localServices\.startPanelCleanerBridge/)
  assert.match(runtime, /bridge\.auth\.signInWithGoogle/)
  assert.match(runtime, /bridge\.windowControls\.toggleMaximize/)
  assert.match(runtime, /Electron V1 does not provide secure secret storage yet/)
  assert.match(chromeBar, /getAppRuntime/)
  assert.match(chromeBar, /canUseCustomWindowControls/)
  assert.match(chromeBar, /windowControls\.minimize/)
  assert.match(chromeBar, /windowControls\.toggleMaximize/)
  assert.match(chromeBar, /windowControls\.close/)
  assert.match(chromeBar, /onStateChange/)
  assert.match(css, /-webkit-app-region:\s*drag/)
  assert.match(css, /-webkit-app-region:\s*no-drag/)
  assert.match(css, /moxzk-command-dock/)
  assert.match(css, /moxzk-chrome-divider/)
})

test('Electron Google login uses system browser and loopback ticket claim', () => {
  const desktopAuth = fs.readFileSync('electron/main/desktopAuth.ts', 'utf8')
  const authStore = fs.readFileSync('src/store/authStore.ts', 'utf8')
  const webRuntime = fs.readFileSync('src/runtime/webRuntime.ts', 'utf8')
  const removedBridgeAccess = ['window.moxzkRuntime ?? window.', 'm', 'g', 'Runtime'].join('')

  assert.match(desktopAuth, /shell\.openExternal/)
  assert.match(desktopAuth, /createServer/)
  assert.match(desktopAuth, /127\.0\.0\.1/)
  assert.match(desktopAuth, /\/api\/auth\/google\/desktop\/start/)
  assert.match(desktopAuth, /\/api\/auth\/google\/desktop\/claim/)
  assert.match(desktopAuth, /session\.defaultSession\.cookies\.set/)
  assert.match(desktopAuth, /getSessionCookieTargets/)
  assert.match(desktopAuth, /process\.env\.ELECTRON_RENDERER_URL/)
  assert.match(desktopAuth, /sameSite:\s*isSecure \? 'no_restriction' : 'lax'/)
  assert.match(desktopAuth, /webRequest\.onBeforeSendHeaders/)
  assert.match(desktopAuth, /shouldAttachDesktopSession/)
  assert.match(desktopAuth, /target\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(desktopAuth, /mergeCookieHeader/)
  assert.match(desktopAuth, /activeGoogleLogin/)
  assert.match(authStore, /getAppRuntime/)
  assert.match(authStore, /runtime\.auth\.signInWithGoogle/)
  assert.match(authStore, /hasElectronBridge/)
  assert.match(webRuntime, /window\.moxzkRuntime/)
  assert.equal(webRuntime.includes(removedBridgeAccess), false)
  assert.match(webRuntime, /isElectronUserAgent/)
  assert.match(webRuntime, /Electron auth bridge is not available/)
})

test('Electron native service launcher is loopback-only and keeps external dependencies explicit', () => {
  const serviceLauncher = fs.readFileSync('electron/main/localServices.ts', 'utf8')
  const settingsPanel = fs.readFileSync('src/components/Settings/SettingsPanel.tsx', 'utf8')
  const processingView = fs.readFileSync('src/components/Processing/ProcessingView.tsx', 'utf8')
  const editorActions = fs.readFileSync('src/hooks/useEditorActions.ts', 'utf8')
  const panelCleanerClient = fs.readFileSync('src/services/panelcleaner-api.ts', 'utf8')
  const ollamaClient = fs.readFileSync('src/services/ollama.ts', 'utf8')
  const mainProcess = fs.readFileSync('electron/main/index.ts', 'utf8')

  assert.match(serviceLauncher, /spawn/)
  assert.match(serviceLauncher, /http:\/\/127\.0\.0\.1:5055\/health/)
  assert.match(serviceLauncher, /http:\/\/127\.0\.0\.1:11434\/api\/version/)
  assert.match(serviceLauncher, /PANELCLEANER_IDLE_TIMEOUT_MS/)
  assert.match(serviceLauncher, /OLLAMA_IDLE_TIMEOUT_MS/)
  assert.match(serviceLauncher, /ownedByApp/)
  assert.match(serviceLauncher, /beginUsage/)
  assert.match(serviceLauncher, /endUsage/)
  assert.match(serviceLauncher, /stopOwnedServices/)
  assert.match(serviceLauncher, /PANELCLEANER_ALLOWED_ORIGIN/)
  assert.match(serviceLauncher, /scripts', 'panelcleaner-bridge\.mjs'/)
  assert.match(serviceLauncher, /ollama\.exe/)
  assert.match(settingsPanel, /handleStartPanelCleaner/)
  assert.match(settingsPanel, /handleInstallPanelCleaner/)
  assert.match(settingsPanel, /handleRepairPanelCleaner/)
  assert.match(settingsPanel, /handlePickPanelCleanerExecutable/)
  assert.match(settingsPanel, /handleStartOllama/)
  assert.match(settingsPanel, /handleStopOwnedServices/)
  assert.match(settingsPanel, /หยุด local services ที่แอปเปิดไว้/)
  assert.match(settingsPanel, /describeManagedStatus/)
  assert.match(settingsPanel, /appRuntime\.localServices/)
  assert.match(processingView, /autoStartRequiredLocalServices/)
  assert.match(editorActions, /autoStartRequiredLocalServices/)
  assert.match(panelCleanerClient, /withLocalServiceUsage\('panelcleaner'/)
  assert.match(ollamaClient, /withLocalServiceUsage\('ollama'/)
  assert.match(mainProcess, /shutdownOwnedServices/)
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
