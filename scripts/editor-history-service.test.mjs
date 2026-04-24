import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadEditorHistoryService() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/editorHistory.ts')
  } finally {
    await server.close()
  }
}

const editorHistoryModule = loadEditorHistoryService()

function region(id, translatedText) {
  return {
    id,
    bbox: { x: 0, y: 0, width: 100, height: 40 },
    originalText: 'source',
    translatedText,
    mood: 'normal',
    suggestedFont: 'normal',
    fontSize: 18,
    fontColor: '#111111',
    rotation: 0,
    strokeWidth: 0,
    strokeColor: '#ffffff',
  }
}

function entry(id, regions = [], brushStrokes = []) {
  return {
    id,
    file: null,
    originalUrl: '',
    cleanedImageUrl: null,
    regions,
    brushStrokes,
    status: 'pending',
  }
}

test('EditorHistoryService collapses repeated live text edits by history key', () => {
  return editorHistoryModule.then(({ EditorHistoryService }) => {
    const service = new EditorHistoryService({ maxEntries: 3 })
    const before = [region('r1', 'one')]
    const middle = [region('r1', 'two')]
    const after = [region('r1', 'three')]

    const first = service.pushTextHistory([], {
      activeImageId: 'page-1',
      before,
      after: middle,
      selectedRegionId: 'r1',
      key: 'live:r1',
    })
    const collapsed = service.pushTextHistory(first, {
      activeImageId: 'page-1',
      before: middle,
      after,
      selectedRegionId: 'r1',
      key: 'live:r1',
    })

    assert.equal(collapsed.length, 1)
    assert.equal(collapsed[0].before[0].translatedText, 'one')
    assert.equal(collapsed[0].after[0].translatedText, 'three')
  })
})

test('EditorHistoryService applies text undo state to the active entry only', () => {
  return editorHistoryModule.then(({ EditorHistoryService }) => {
    const service = new EditorHistoryService()
    const before = [region('r1', 'before')]
    const after = [region('r1', 'after')]
    const state = {
      activeImageId: 'page-1',
      regions: after,
      brushStrokes: [],
      imageEntries: [
        entry('page-1', after),
        entry('page-2', [region('r2', 'unchanged')]),
      ],
      selectedRegionId: 'r1',
      _brushRedoStack: [],
    }

    const applied = service.applyEditorHistoryEntry(
      state,
      {
        kind: 'text',
        activeImageId: 'page-1',
        before,
        after,
        selectedRegionId: 'r1',
      },
      'undo',
    )

    assert.equal(applied.regions[0].translatedText, 'before')
    assert.equal(applied.imageEntries[0].regions[0].translatedText, 'before')
    assert.equal(applied.imageEntries[1].regions[0].translatedText, 'unchanged')
  })
})
