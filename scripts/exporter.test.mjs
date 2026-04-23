import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadExporterModule() {
  globalThis.localStorage ??= {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }

  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/exportRendering.ts')
  } finally {
    await server.close()
  }
}

const exporterModule = loadExporterModule()

function region(overrides = {}) {
  return {
    id: 'r1',
    bbox: { x: 0, y: 0, width: 120, height: 60 },
    originalText: 'hello',
    translatedText: 'หนึ่ง สอง สาม สี่ ห้า หก',
    mood: 'normal',
    suggestedFont: 'normal',
    fontSize: 20,
    fontColor: '#111111',
    rotation: 0,
    strokeWidth: 0,
    strokeColor: '#ffffff',
    ...overrides,
  }
}

test('exporter resolves cleaned R2 images before placeholder thumbnails', async () => {
  const { resolveImageEntryExportSource } = await exporterModule
  const requestedKeys = []

  const resolved = await resolveImageEntryExportSource({
    cleanedImageUrl: null,
    originalUrl: 'data:image/png;base64,thumb',
    cleanedR2Key: 'cleaned-key',
    originalR2Key: 'original-key',
    imageLoaded: false,
  }, async (key) => {
    requestedKeys.push(key)
    return `blob:${key}`
  })

  assert.deepEqual(requestedKeys, ['cleaned-key'])
  assert.equal(resolved.src, 'blob:cleaned-key')
  assert.equal(resolved.revokeAfterUse, true)
})

test('exporter resolves original R2 images when only a placeholder thumbnail is cached', async () => {
  const { resolveImageEntryExportSource } = await exporterModule
  const requestedKeys = []

  const resolved = await resolveImageEntryExportSource({
    cleanedImageUrl: null,
    originalUrl: 'data:image/png;base64,thumb',
    cleanedR2Key: undefined,
    originalR2Key: 'original-key',
    imageLoaded: false,
  }, async (key) => {
    requestedKeys.push(key)
    return `blob:${key}`
  })

  assert.deepEqual(requestedKeys, ['original-key'])
  assert.equal(resolved.src, 'blob:original-key')
  assert.equal(resolved.revokeAfterUse, true)
})

test('artistic export layout wraps text to the unscaled width and preserves text scale', async () => {
  const { getExportTextRegionLayout } = await exporterModule

  const layout = getExportTextRegionLayout(region({
    bbox: { x: 10, y: 20, width: 120, height: 60 },
    textLayoutMode: 'artistic',
    textScaleX: 2,
    textScaleY: 1.5,
  }))

  assert.equal(layout?.mode, 'artistic')
  assert.equal(layout?.innerWidth, 60)
  assert.equal(layout?.scaleX, 2)
  assert.equal(layout?.scaleY, 1.5)
  assert.ok((layout?.lines.length ?? 0) > 1)
})
