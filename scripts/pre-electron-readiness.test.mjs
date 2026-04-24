import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createProjectDraftSnapshot, normalizeProjectDraft } from '../src/services/projectDraftStorage.ts'
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

test('legacy backend docs removed and R2 export path has implementation', () => {
  const readme = fs.readFileSync('README.md', 'utf8')
  const exporter = fs.readFileSync('src/services/exporter.ts', 'utf8')
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

  assert.equal(readme.includes('manga-image-translator'), false)
  assert.equal(fs.existsSync('docker-compose.yml'), false)
  assert.equal(exporter.includes("TODO: If it's an R2 key"), false)
  assert.match(exporter, /downloadImage\(key\)/)
  assert.equal(Boolean(packageJson.dependencies?.electron || packageJson.devDependencies?.electron), false)
})
