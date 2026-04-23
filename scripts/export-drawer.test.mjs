import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadExportDrawer() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/exportDrawer.ts')
  } finally {
    await server.close()
  }
}

const exportDrawer = loadExportDrawer()

test('export drawer preview modes include the new After option first', async () => {
  const { EXPORT_PREVIEW_MODE_OPTIONS } = await exportDrawer

  assert.deepEqual(
    EXPORT_PREVIEW_MODE_OPTIONS.map((option) => option.value),
    ['after', 'slider', 'side-by-side', 'overlay'],
  )
})

test('export drawer exposes the expected file format buttons', async () => {
  const { EXPORT_FORMAT_OPTIONS } = await exportDrawer

  assert.deepEqual(
    EXPORT_FORMAT_OPTIONS.map((option) => option.value),
    ['png', 'jpg', 'webp'],
  )
})

test('export drawer quality presets are limited to the four button values', async () => {
  const { EXPORT_QUALITY_PRESETS, isExportQualityPreset } = await exportDrawer

  assert.deepEqual([...EXPORT_QUALITY_PRESETS], [50, 75, 90, 100])
  assert.equal(isExportQualityPreset(90), true)
  assert.equal(isExportQualityPreset(95), false)
})

test('export drawer quality controls stay hidden for PNG and visible for lossy formats', async () => {
  const { supportsExportQuality } = await exportDrawer

  assert.equal(supportsExportQuality('png'), false)
  assert.equal(supportsExportQuality('jpg'), true)
  assert.equal(supportsExportQuality('webp'), true)
})

test('export drawer snaps legacy custom quality values to the nearest preset', async () => {
  const { normalizeExportQualityPreset } = await exportDrawer

  assert.equal(normalizeExportQualityPreset(74), 75)
  assert.equal(normalizeExportQualityPreset(95), 100)
  assert.equal(normalizeExportQualityPreset(10), 50)
})
