import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadBatchProcessing() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/batch-processing.ts')
  } finally {
    await server.close()
  }
}

const batchProcessing = loadBatchProcessing()

function settings() {
  return {
    cleanupBackend: 'panelcleaner',
    translatorApiUrl: 'http://localhost:5003',
    panelCleanerBridgeUrl: 'http://localhost:5055',
    panelCleanerExecutablePath: '',
    panelCleanerUseOcrFallback: true,
    sourceLang: 'auto',
    fontMoodMap: {},
    theme: 'studio-dark',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma4',
    ollamaApiKey: '',
    translationContextEnabled: true,
    translationStyleGuide: '',
  }
}

function imageEntry(overrides = {}) {
  return {
    id: 'page-2',
    file: new File([new Blob(['source'])], 'page-2.png', { type: 'image/png' }),
    originalUrl: 'blob:original',
    cleanedImageUrl: null,
    regions: [],
    brushStrokes: [],
    status: 'pending',
    pageNumber: 2,
    progress: 0,
    ...overrides,
  }
}

function services(overrides = {}) {
  return {
    processPanelCleanerBatch: async () => {
      throw new Error('PanelCleaner should not run')
    },
    processCleanupImage: async () => {
      throw new Error('Cleanup provider should not run')
    },
    deriveTextBoxes: async () => [],
    translateBoxedVision: async () => {
      throw new Error('Boxed translation should not run without boxes')
    },
    translateVision: async () => [],
    detectOcrVision: async () => [],
    readImageUrlAsBlob: async () => new Blob(['cleaned'], { type: 'image/png' }),
    ...overrides,
  }
}

test('retry failed translate reuses cleaned image without running cleanup again', async () => {
  const { runBatchAiQueue } = await batchProcessing
  let cleanCalls = 0
  let translateCalls = 0
  const statusUpdates = []
  const logs = []
  const entry = imageEntry({
    status: 'error',
    error: 'Ollama failed',
    lastErrorStage: 'translate',
    cleanedImageUrl: 'blob:cleaned',
    progress: 100,
  })

  await runBatchAiQueue({
    entries: [entry],
    mode: 'gemma_vision_full',
    settings: settings(),
    sourceLang: 'auto',
    ollamaOptions: {},
    retryFailedOnly: true,
    shouldStop: () => false,
    onEntryUpdate: (_id, updates) => {
      if (updates.status) statusUpdates.push(updates.status)
    },
    onLog: (message) => logs.push(message),
    services: services({
      processPanelCleanerBatch: async () => {
        cleanCalls += 1
        return []
      },
      translateVision: async () => {
        translateCalls += 1
        return [{
          id: 'r1',
          bbox: { x: 0, y: 0, width: 10, height: 10 },
          originalText: 'Hello',
          translatedText: 'สวัสดี',
          mood: 'normal',
          suggestedFont: 'Sarabun',
          fontSize: 18,
          fontColor: '#fff',
          rotation: 0,
          strokeWidth: 0,
          strokeColor: '#000',
        }]
      },
    }),
  })

  assert.equal(cleanCalls, 0)
  assert.equal(translateCalls, 1)
  assert.equal(statusUpdates.includes('clean_queued'), false)
  assert.equal(statusUpdates.includes('cleaning'), false)
  assert.deepEqual(statusUpdates, ['clean_done', 'clean_done', 'translating', 'done'])
  assert.ok(logs.some((message) => message.includes('ใช้ผลคลีนเดิมหน้า 2')))
})

test('retry failed clean runs cleanup when no cleaned image exists', async () => {
  const { runBatchAiQueue } = await batchProcessing
  let cleanCalls = 0
  let translateCalls = 0
  const statusUpdates = []
  const entry = imageEntry({
    status: 'error',
    error: 'PanelCleaner failed',
    lastErrorStage: 'clean',
    cleanedImageUrl: null,
    progress: 100,
  })

  await runBatchAiQueue({
    entries: [entry],
    mode: 'gemma_vision_full',
    settings: settings(),
    sourceLang: 'auto',
    ollamaOptions: {},
    retryFailedOnly: true,
    shouldStop: () => false,
    onEntryUpdate: (_id, updates) => {
      if (updates.status) statusUpdates.push(updates.status)
    },
    onLog: () => {},
    services: services({
      processPanelCleanerBatch: async () => {
        cleanCalls += 1
        return [{
          id: entry.id,
          cleanedImageBlob: new Blob(['cleaned'], { type: 'image/png' }),
          cleanedImageMimeType: 'image/png',
        }]
      },
      translateVision: async () => {
        translateCalls += 1
        return []
      },
    }),
  })

  assert.equal(cleanCalls, 1)
  assert.equal(translateCalls, 1)
  assert.ok(statusUpdates.includes('clean_queued'))
  assert.ok(statusUpdates.includes('cleaning'))
  assert.ok(statusUpdates.includes('done'))
})

test('mixed reusable and newly cleaned pages translate in original page order', async () => {
  const { runBatchAiQueue } = await batchProcessing
  const translatedPages = []
  const entries = [
    imageEntry({
      id: 'page-1',
      pageNumber: 1,
      status: 'error',
      cleanedImageUrl: null,
      file: new File([new Blob(['source-1'])], 'page-1.png', { type: 'image/png' }),
    }),
    imageEntry({
      id: 'page-2',
      pageNumber: 2,
      status: 'error',
      cleanedImageUrl: 'blob:page-2',
      file: new File([new Blob(['source-2'])], 'page-2.png', { type: 'image/png' }),
    }),
  ]

  await runBatchAiQueue({
    entries,
    mode: 'gemma_vision_full',
    settings: settings(),
    sourceLang: 'auto',
    ollamaOptions: {},
    retryFailedOnly: true,
    shouldStop: () => false,
    onEntryUpdate: () => {},
    onLog: () => {},
    services: services({
      processPanelCleanerBatch: async () => [{
        id: 'page-1',
        cleanedImageBlob: new Blob(['cleaned-1'], { type: 'image/png' }),
        cleanedImageMimeType: 'image/png',
      }],
      translateVision: async (file) => {
        translatedPages.push(file.name)
        return []
      },
    }),
  })

  assert.deepEqual(translatedPages, ['page-1.png', 'page-2.png'])
})
