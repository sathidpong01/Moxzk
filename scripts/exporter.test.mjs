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

test('artistic free export keeps natural manual lines without frame wrapping', async () => {
  const { getExportTextRegionLayout } = await exporterModule

  const layout = getExportTextRegionLayout(region({
    bbox: { x: 10, y: 20, width: 120, height: 60 },
    textLayoutMode: 'artistic',
    artisticFit: 'free',
    textScaleX: 2,
    textScaleY: 1.5,
  }))

  assert.equal(layout?.mode, 'artistic')
  assert.ok((layout?.innerWidth ?? 0) > 120)
  assert.equal(layout?.scaleX, 1)
  assert.equal(layout?.scaleY, 1)
  assert.deepEqual(layout?.lines, ['หนึ่ง สอง สาม สี่ ห้า หก'])
  assert.equal(layout?.overflow, false)
})

test('balloon export layout carries shape-aware safe area metadata', async () => {
  const { getExportTextRegionLayout } = await exporterModule

  const layout = getExportTextRegionLayout(region({
    bbox: { x: 10, y: 20, width: 220, height: 88 },
    translatedText: 'ไม่ต้องกังวลเรื่องนั้นหรอก พ่อรู้ว่ามันอยู่ที่ไหน อดทนรออีกนิดนะ',
    fontSize: 34,
    balloonShape: 'cloud',
  }))

  assert.equal(layout?.mode, 'balloon_fit')
  assert.equal(layout?.balloonShape, 'cloud')
  assert.ok((layout?.paddingX ?? 0) > 24)
  assert.ok((layout?.startY ?? 0) >= (layout?.paddingY ?? 0))
  assert.equal(layout?.overflow, false)
})

test('artistic bubble-guided export wraps in safe area and reports clipping as metadata', async () => {
  const { getExportTextRegionLayout } = await exporterModule
  const text = 'ประโยคยาวมากที่ผู้ใช้ตั้งใจวางเองแต่ยังล้นออกจาก bubble'

  const layout = getExportTextRegionLayout(region({
    bbox: { x: 10, y: 20, width: 120, height: 38 },
    translatedText: text,
    textLayoutMode: 'artistic',
    artisticFit: 'bubble_guided',
    balloonShape: 'round',
    fontSize: 24,
  }))

  assert.equal(layout?.mode, 'artistic')
  assert.equal(layout?.artisticFit, 'bubble_guided')
  assert.ok((layout?.paddingX ?? 0) > 0)
  assert.ok((layout?.lines.length ?? 0) > 1)
  assert.equal(layout?.lines.join('').replace(/\s/g, ''), text.replace(/\s/g, ''))
  assert.equal(layout?.overflow, true)
  assert.equal(layout?.overflowReason, 'clipped')
})
