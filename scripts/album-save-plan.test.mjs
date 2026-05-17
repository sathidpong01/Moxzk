import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getNextAlbumPageNumber,
  getPersistedPageStatus,
  resolveAlbumSaveTarget,
} from '../src/services/albumSavePlan.ts'
import { resolveHydratedAlbumImageUrls } from '../src/services/albumImageUrls.ts'

function page(id, pageNumber, originalHash = null) {
  return {
    id,
    album_id: 'album-1',
    page_number: pageNumber,
    original_key: null,
    cleaned_key: null,
    thumbnail_key: null,
    original_hash: originalHash,
    artboard_x: null,
    artboard_y: null,
    regions: [],
    brush_strokes: [],
    status: 'pending',
    processing_mode: 'full',
    error_message: null,
    created_at: '',
    updated_at: '',
  }
}

test('resolveAlbumSaveTarget updates an opened album page instead of appending a duplicate', () => {
  const pages = [page('page-1', 1), page('page-2', 2)]
  const target = resolveAlbumSaveTarget({ albumPageId: 'page-2', pageNumber: 2 }, pages, 3)

  assert.equal(target.existingPage?.id, 'page-2')
  assert.equal(target.pageNumber, 2)
})

test('resolveAlbumSaveTarget appends when the entry does not belong to the target album', () => {
  const pages = [page('page-1', 1), page('page-2', 2)]
  const target = resolveAlbumSaveTarget({ albumPageId: 'other-page', pageNumber: 2 }, pages, 3)

  assert.equal(target.existingPage, null)
  assert.equal(target.pageNumber, 3)
})

test('resolveAlbumSaveTarget matches a freshly imported image by content hash', () => {
  const pages = [page('page-1', 1, 'hash-abc'), page('page-2', 2, 'hash-def')]
  const target = resolveAlbumSaveTarget({ albumPageId: undefined, pageNumber: 1 }, pages, 3, 'hash-def')

  assert.equal(target.existingPage?.id, 'page-2')
  assert.equal(target.pageNumber, 2)
})

test('resolveAlbumSaveTarget appends when no page shares the content hash', () => {
  const pages = [page('page-1', 1, 'hash-abc')]
  const target = resolveAlbumSaveTarget({ albumPageId: undefined, pageNumber: 1 }, pages, 2, 'hash-new')

  assert.equal(target.existingPage, null)
  assert.equal(target.pageNumber, 2)
})

test('getNextAlbumPageNumber appends after the highest current page number', () => {
  assert.equal(getNextAlbumPageNumber([page('page-1', 1), page('page-8', 8)]), 9)
})

test('getPersistedPageStatus keeps clean-only pages distinct from translated pages', () => {
  assert.equal(getPersistedPageStatus({ cleanedImageUrl: 'blob:cleaned', status: 'done' }), 'translated')
  assert.equal(getPersistedPageStatus({ cleanedImageUrl: 'blob:cleaned', status: 'clean_done' }), 'clean_done')
  assert.equal(getPersistedPageStatus({ cleanedImageUrl: null, status: 'pending' }), 'pending')
})

test('resolveHydratedAlbumImageUrls keeps the original and cleaned images separate', () => {
  assert.deepEqual(
    resolveHydratedAlbumImageUrls('blob:original', 'blob:cleaned'),
    { originalUrl: 'blob:original', cleanedUrl: 'blob:cleaned' },
  )
})
