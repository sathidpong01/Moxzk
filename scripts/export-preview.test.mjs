import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadExportPreview() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/exportPreview.ts')
  } finally {
    await server.close()
  }
}

const exportPreview = loadExportPreview()

test('export preview prefers the cleaned page image when available', async () => {
  const { getExportPreviewUrl } = await exportPreview

  assert.equal(
    getExportPreviewUrl({
      id: 'page-1',
      cleanedImageUrl: 'blob:cleaned',
      originalUrl: 'blob:original',
    }),
    'blob:cleaned',
  )
})

test('export preview falls back to the original page image', async () => {
  const { getExportPreviewUrl } = await exportPreview

  assert.equal(
    getExportPreviewUrl({
      id: 'page-1',
      cleanedImageUrl: null,
      originalUrl: 'blob:original',
    }),
    'blob:original',
  )
})

test('export preview returns null when no page image is available', async () => {
  const { getExportPreviewUrl } = await exportPreview

  assert.equal(
    getExportPreviewUrl({
      id: 'page-1',
      cleanedImageUrl: null,
      originalUrl: '',
    }),
    null,
  )
})

test('export compare original uses only the uncleaned original image', async () => {
  const { getExportCompareOriginalUrl } = await exportPreview

  assert.equal(
    getExportCompareOriginalUrl({
      id: 'page-1',
      cleanedImageUrl: 'blob:cleaned',
      originalUrl: 'blob:original',
    }),
    'blob:original',
  )
})

test('export compare original does not fall back to the cleaned image', async () => {
  const { getExportCompareOriginalUrl } = await exportPreview

  assert.equal(
    getExportCompareOriginalUrl({
      id: 'page-1',
      cleanedImageUrl: 'blob:cleaned',
      originalUrl: '',
    }),
    null,
  )
})

test('export thumbnail prefers the rendered output with text overlays', async () => {
  const { getExportThumbnailUrl } = await exportPreview

  assert.equal(
    getExportThumbnailUrl(
      {
        id: 'page-1',
        cleanedImageUrl: 'blob:cleaned',
        originalUrl: 'blob:original',
      },
      { 'page-1': 'blob:rendered-with-text' },
    ),
    'blob:rendered-with-text',
  )
})

test('export active preview stays on the current selected page', async () => {
  const { getNextExportPreviewId } = await exportPreview

  assert.equal(
    getNextExportPreviewId([{ id: 'page-1' }, { id: 'page-2' }], 'page-2'),
    'page-2',
  )
})

test('export active preview falls back to the first selected page', async () => {
  const { getNextExportPreviewId } = await exportPreview

  assert.equal(
    getNextExportPreviewId([{ id: 'page-1' }, { id: 'page-2' }], 'page-9'),
    'page-1',
  )
})
