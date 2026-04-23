import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadExportPreviewCache() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/exportPreviewCache.ts')
  } finally {
    await server.close()
  }
}

const exportPreviewCache = loadExportPreviewCache()

test('export preview cache key changes only when export settings change', async () => {
  const { createExportPreviewCacheKey } = await exportPreviewCache

  assert.equal(createExportPreviewCacheKey('webp', 100), 'webp:100')
  assert.equal(createExportPreviewCacheKey('webp', 90), 'webp:90')
  assert.equal(createExportPreviewCacheKey('png', 100), 'png:100')
})

test('export preview cache stays intact when export settings are unchanged', async () => {
  const { reconcileExportPreviewCache } = await exportPreviewCache

  const current = {
    cacheKey: 'webp:100',
    renderedUrls: { 'page-1': 'blob:one', 'page-2': 'blob:two' },
    renderedErrors: { 'page-3': 'render failed' },
  }

  assert.deepEqual(
    reconcileExportPreviewCache(current, 'webp:100'),
    {
      cacheKey: 'webp:100',
      renderedUrls: { 'page-1': 'blob:one', 'page-2': 'blob:two' },
      renderedErrors: { 'page-3': 'render failed' },
      shouldReset: false,
    },
  )
})

test('export preview cache resets when format or quality changes or the drawer closes', async () => {
  const { reconcileExportPreviewCache } = await exportPreviewCache

  const current = {
    cacheKey: 'webp:100',
    renderedUrls: { 'page-1': 'blob:one' },
    renderedErrors: { 'page-2': 'render failed' },
  }

  assert.deepEqual(
    reconcileExportPreviewCache(current, 'jpg:100'),
    {
      cacheKey: 'jpg:100',
      renderedUrls: {},
      renderedErrors: {},
      shouldReset: true,
    },
  )

  assert.deepEqual(
    reconcileExportPreviewCache(current, null),
    {
      cacheKey: null,
      renderedUrls: {},
      renderedErrors: {},
      shouldReset: true,
    },
  )
})
