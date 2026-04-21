import test from 'node:test'
import assert from 'node:assert/strict'
import { getAlbumOpenPlan } from '../src/services/albumOpen.ts'

function page(id, pageNumber) {
  return {
    id,
    album_id: 'album-1',
    page_number: pageNumber,
    original_key: null,
    cleaned_key: null,
    thumbnail_key: null,
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

test('getAlbumOpenPlan opens the editor on the first page when album pages exist', () => {
  assert.deepEqual(
    getAlbumOpenPlan([page('page-1', 1), page('page-2', 2)]),
    { shouldOpenEditor: true, activePageId: 'page-1' },
  )
})

test('getAlbumOpenPlan stays in album detail when the album has no pages', () => {
  assert.deepEqual(
    getAlbumOpenPlan([]),
    { shouldOpenEditor: false, activePageId: null },
  )
})
