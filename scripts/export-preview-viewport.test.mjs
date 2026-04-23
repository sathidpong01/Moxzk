import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadExportPreviewViewport() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/exportPreviewViewport.ts')
  } finally {
    await server.close()
  }
}

const exportPreviewViewport = loadExportPreviewViewport()

test('export preview panning is disabled for slider mode and enabled for synced comparison modes', async () => {
  const { canPanExportPreview } = await exportPreviewViewport

  assert.equal(canPanExportPreview('slider', 2), false)
  assert.equal(canPanExportPreview('after', 2), true)
  assert.equal(canPanExportPreview('side-by-side', 2), true)
  assert.equal(canPanExportPreview('overlay', 2), true)
})

test('export preview pan resets when zoom returns to 100 percent', async () => {
  const { normalizeExportPreviewPan } = await exportPreviewViewport

  assert.deepEqual(normalizeExportPreviewPan(1, { x: 42, y: -18 }), { x: 0, y: 0 })
  assert.deepEqual(normalizeExportPreviewPan(1.6, { x: 42, y: -18 }), { x: 42, y: -18 })
})

test('export preview transform uses one shared translate and scale string', async () => {
  const { createExportPreviewTransform } = await exportPreviewViewport

  assert.equal(
    createExportPreviewTransform(1.4, { x: 24, y: -36 }),
    'translate3d(24px, -36px, 0) scale(1.4)',
  )
})
