import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import {
  appendBrushStroke,
  computeBrushFeather,
  drawBrushOverlay,
  drawBrushStrokesOnContext,
  redoBrushStroke,
  syncActiveEntryBrushStrokes,
  undoBrushStroke,
} from '../src/services/brushStrokes.ts'
import {
  getInlineTextEditorBboxSize,
  getTextTransformerAnchors,
} from '../src/services/inlineTextEditor.ts'
import {
  getEditorToolCursor,
} from '../src/services/editorCursor.ts'
import {
  shouldStartBrushStroke,
} from '../src/services/konvaInteraction.ts'
import {
  getEditorShortcutKey,
} from '../src/services/keyboardShortcuts.ts'

const viteModuleCache = new Map()

async function loadViteModule(path) {
  if (viteModuleCache.has(path)) return viteModuleCache.get(path)
  globalThis.localStorage ??= {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }

  const loaded = (async () => {
    const server = await createServer({
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
    })
    try {
      return await server.ssrLoadModule(path)
    } finally {
      await server.close()
    }
  })()
  viteModuleCache.set(path, loaded)
  return loaded
}

async function loadAppStore() {
  return loadViteModule('/src/store/appStore.ts')
}

function region(overrides = {}) {
  return {
    id: 'r1',
    bbox: { x: 0, y: 0, width: 100, height: 40 },
    originalText: 'hello',
    translatedText: 'สวัสดี',
    mood: 'shouting',
    suggestedFont: 'normal',
    fontSize: 18,
    fontColor: '#111111',
    rotation: 0,
    strokeWidth: 0,
    strokeColor: '#ffffff',
    ...overrides,
  }
}

function stroke(overrides = {}) {
  return {
    id: 'stroke-1',
    points: [0, 0, 10, 10],
    color: '#ffffff',
    width: 12,
    opacity: 0.8,
    shadowBlur: 2,
    tool: 'brush',
    ...overrides,
  }
}

function konvaTarget(className, ancestors = []) {
  return {
    getClassName: () => className,
    findAncestor: (selector, includeSelf = false) => {
      if (includeSelf && selector === className) return { className }
      return ancestors.includes(selector) ? { className: selector } : null
    },
  }
}

test('balloon fit text exposes corner and side resize anchors', () => {
  assert.deepEqual(getTextTransformerAnchors('balloon_fit'), [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ])
})

test('artistic text uses the same full resize anchor set as balloon fit', () => {
  assert.deepEqual(getTextTransformerAnchors('artistic'), getTextTransformerAnchors('balloon_fit'))
})

test('artistic inline editor bbox grows from multiline scroll metrics', () => {
  const bboxSize = getInlineTextEditorBboxSize({
    scale: 2,
    metrics: {
      width: 80,
      height: 40,
      scrollWidth: 140,
      scrollHeight: 96,
      layoutMode: 'artistic',
    },
  })

  assert.deepEqual(bboxSize, { width: 70, height: 48 })
})

test('balloon fit inline editor bbox ignores scroll overflow and keeps visible box metrics', () => {
  const bboxSize = getInlineTextEditorBboxSize({
    scale: 2,
    metrics: {
      width: 80,
      height: 40,
      scrollWidth: 140,
      scrollHeight: 96,
      layoutMode: 'balloon_fit',
    },
  })

  assert.deepEqual(bboxSize, { width: 40, height: 20 })
})

test('TextRegion font resolution prefers user-selected fontId over AI suggestedFont', async () => {
  const { getRegionFontKey, resolveRegionFont } = await loadViteModule('/src/config/fonts.ts')
  const selected = region({ fontId: 'comedy', suggestedFont: 'normal', mood: 'shouting' })

  assert.equal(getRegionFontKey(selected), 'comedy')
  assert.equal(resolveRegionFont(selected).name, 'K2D')
})

test('TextRegion font resolution preserves legacy suggestedFont fallback', async () => {
  const { getRegionFontKey, resolveRegionFont } = await loadViteModule('/src/config/fonts.ts')
  const legacy = region({ suggestedFont: 'normal_bold', mood: 'whisper' })

  assert.equal(getRegionFontKey(legacy), 'normal_bold')
  assert.equal(resolveRegionFont(legacy).name, 'Sarabun Bold')
})

test('brush history syncs active page strokes without changing inactive pages', () => {
  const entries = [
    { id: 'page-1', brushStrokes: [], regions: [] },
    { id: 'page-2', brushStrokes: [stroke({ id: 'old' })], regions: [] },
  ]
  const nextStroke = stroke({ id: 'new' })
  const next = appendBrushStroke({ brushStrokes: [], redoStack: [] }, nextStroke)
  const synced = syncActiveEntryBrushStrokes(entries, 'page-1', next.brushStrokes)

  assert.deepEqual(next.brushStrokes.map((item) => item.id), ['new'])
  assert.deepEqual(synced[0].brushStrokes.map((item) => item.id), ['new'])
  assert.deepEqual(synced[1].brushStrokes.map((item) => item.id), ['old'])
})

test('brush stroke does not start from text transformer handles', () => {
  assert.equal(shouldStartBrushStroke(konvaTarget('Image')), true)
  assert.equal(shouldStartBrushStroke(konvaTarget('Rect', ['Transformer'])), false)
  assert.equal(shouldStartBrushStroke(konvaTarget('Transformer')), false)
})

test('editor tool cursors use matching SVG icons with fallbacks', () => {
  assert.match(getEditorToolCursor('select'), /^url\("data:image\/svg\+xml,/)
  assert.match(getEditorToolCursor('brush'), /crosshair$/)
  assert.match(getEditorToolCursor('eraser'), /crosshair$/)
  assert.match(getEditorToolCursor('eyedropper'), /crosshair$/)
  assert.match(getEditorToolCursor('pan'), /grab$/)
})

test('keyboard shortcuts use physical key codes across Thai keyboard layout', () => {
  assert.equal(getEditorShortcutKey({ key: 'ผ', code: 'KeyZ' }), 'z')
  assert.equal(getEditorShortcutKey({ key: 'ิ', code: 'KeyB' }), 'b')
  assert.equal(getEditorShortcutKey({ key: 'ำ', code: 'KeyE' }), 'e')
  assert.equal(getEditorShortcutKey({ key: ' ', code: 'Space' }), ' ')
  assert.equal(getEditorShortcutKey({ key: 'Enter', code: 'Enter' }), 'Enter')
})

test('brush undo and redo keep history state deterministic', () => {
  const first = stroke({ id: 'first' })
  const second = stroke({ id: 'second' })
  const current = { brushStrokes: [first, second], redoStack: [] }

  const undone = undoBrushStroke(current)
  assert.deepEqual(undone.brushStrokes.map((item) => item.id), ['first'])
  assert.deepEqual(undone.redoStack.map((item) => item.id), ['second'])

  const redone = redoBrushStroke(undone)
  assert.deepEqual(redone.brushStrokes.map((item) => item.id), ['first', 'second'])
  assert.deepEqual(redone.redoStack, [])
})

test('brush eraser draws with destination-out for overlay-only erasing', () => {
  const operations = []
  const ctx = {
    save: () => operations.push(['save']),
    restore: () => operations.push(['restore']),
    beginPath: () => operations.push(['beginPath']),
    moveTo: (x, y) => operations.push(['moveTo', x, y]),
    lineTo: (x, y) => operations.push(['lineTo', x, y]),
    stroke: () => operations.push(['stroke']),
    set globalAlpha(value) { operations.push(['globalAlpha', value]) },
    set globalCompositeOperation(value) { operations.push(['globalCompositeOperation', value]) },
    set lineCap(value) { operations.push(['lineCap', value]) },
    set lineJoin(value) { operations.push(['lineJoin', value]) },
    set strokeStyle(value) { operations.push(['strokeStyle', value]) },
    set lineWidth(value) { operations.push(['lineWidth', value]) },
    set shadowBlur(value) { operations.push(['shadowBlur', value]) },
    set shadowColor(value) { operations.push(['shadowColor', value]) },
  }

  drawBrushStrokesOnContext(ctx, [stroke({ tool: 'eraser', opacity: 1, shadowBlur: 0 })])

  assert.ok(operations.some(([name, value]) => name === 'globalCompositeOperation' && value === 'destination-out'))
  assert.ok(operations.some(([name, value]) => name === 'lineWidth' && value === 12))
})

test('brush feather keeps the core size and adds fade radius', () => {
  const feather = computeBrushFeather(27, 13)
  assert.equal(feather.strokeWidth, 27)
  assert.equal(feather.featherRadius, 13)
  assert.equal(feather.totalWidth, 53)
})

test('export brush overlay composites strokes without applying eraser to the base canvas', async () => {
  const baseOperations = []
  const overlayOperations = []
  const overlayCtx = {
    save: () => overlayOperations.push(['save']),
    restore: () => overlayOperations.push(['restore']),
    beginPath: () => overlayOperations.push(['beginPath']),
    moveTo: (x, y) => overlayOperations.push(['moveTo', x, y]),
    lineTo: (x, y) => overlayOperations.push(['lineTo', x, y]),
    stroke: () => overlayOperations.push(['stroke']),
    set globalAlpha(value) { overlayOperations.push(['globalAlpha', value]) },
    set globalCompositeOperation(value) { overlayOperations.push(['globalCompositeOperation', value]) },
    set lineCap(value) { overlayOperations.push(['lineCap', value]) },
    set lineJoin(value) { overlayOperations.push(['lineJoin', value]) },
    set strokeStyle(value) { overlayOperations.push(['strokeStyle', value]) },
    set lineWidth(value) { overlayOperations.push(['lineWidth', value]) },
    set shadowBlur(value) { overlayOperations.push(['shadowBlur', value]) },
    set shadowColor(value) { overlayOperations.push(['shadowColor', value]) },
  }
  drawBrushOverlay({
    drawImage: (...args) => baseOperations.push(['drawImage', args.length]),
  }, 120, 80, [
    stroke({ id: 'brush', tool: 'brush', shadowBlur: 0 }),
    stroke({ id: 'eraser', tool: 'eraser', shadowBlur: 0 }),
  ], () => ({
    width: 0,
    height: 0,
    getContext: () => overlayCtx,
  }))

  assert.deepEqual(baseOperations, [['drawImage', 3]])
  assert.ok(overlayOperations.some(([name, value]) => name === 'globalCompositeOperation' && value === 'destination-out'))
  assert.equal(baseOperations.some(([name]) => name === 'globalCompositeOperation'), false)
})

test('reorderImages assigns sequential page numbers and artboard coordinates', async () => {
  const { useAppStore, getDefaultArtboardCoordinates } = await loadAppStore()
  const store = useAppStore.getState()
  useAppStore.setState({
    imageEntries: [
      { id: 'a', pageNumber: 1, brushStrokes: [], regions: [] },
      { id: 'b', pageNumber: 2, brushStrokes: [], regions: [] },
      { id: 'c', pageNumber: 3, brushStrokes: [], regions: [] },
    ],
    activeImageId: 'a',
  })

  store.reorderImages(0, 2)

  const entries = useAppStore.getState().imageEntries
  assert.deepEqual(entries.map((entry) => entry.id), ['b', 'c', 'a'])
  assert.deepEqual(entries.map((entry) => entry.pageNumber), [1, 2, 3])
  assert.deepEqual(
    entries.map((entry) => ({ artboardX: entry.artboardX, artboardY: entry.artboardY })),
    [0, 1, 2].map(getDefaultArtboardCoordinates),
  )
})

test('loadAlbumPages preserves persisted artboard coordinates', async () => {
  const { useAppStore } = await loadAppStore()
  const store = useAppStore.getState()
  useAppStore.setState({ imageEntries: [], originalImageUrl: null })

  await store.loadAlbumPages([
    {
      id: 'page-1',
      album_id: 'album-1',
      page_number: 1,
      original_key: null,
      cleaned_key: null,
      thumbnail_key: 'data:image/png;base64,placeholder',
      artboard_x: 123,
      artboard_y: 456,
      regions: [],
      brush_strokes: [],
      status: 'translated',
      processing_mode: 'full',
      error_message: null,
      created_at: '',
      updated_at: '',
    },
  ], 'page-1')

  const [entry] = useAppStore.getState().imageEntries
  assert.equal(entry.artboardX, 123)
  assert.equal(entry.artboardY, 456)
})

test('text region updates can be undone and redone with active entry sync', async () => {
  const { useAppStore } = await loadAppStore()
  const first = region({ id: 'r1', translatedText: 'ก่อน' })
  const entry = { id: 'page-1', regions: [first], brushStrokes: [] }
  useAppStore.setState({
    activeImageId: 'page-1',
    regions: [first],
    imageEntries: [entry],
    selectedRegionId: 'r1',
    _textUndoStack: [],
    _textRedoStack: [],
  })

  useAppStore.getState().updateRegion('r1', { translatedText: 'หลัง' })
  assert.equal(useAppStore.getState().regions[0].translatedText, 'หลัง')
  assert.equal(useAppStore.getState().imageEntries[0].regions[0].translatedText, 'หลัง')

  assert.equal(useAppStore.getState().undoTextEdit(), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'ก่อน')
  assert.equal(useAppStore.getState().imageEntries[0].regions[0].translatedText, 'ก่อน')

  assert.equal(useAppStore.getState().redoTextEdit(), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'หลัง')
  assert.equal(useAppStore.getState().imageEntries[0].regions[0].translatedText, 'หลัง')
})

test('editor undo uses one chronological stack for text and brush actions', async () => {
  const { useAppStore } = await loadAppStore()
  const first = region({ id: 'r1', translatedText: 'ก่อน' })
  const brush = stroke({ id: 'brush-after-text' })
  useAppStore.setState({
    activeImageId: 'page-1',
    regions: [first],
    imageEntries: [{ id: 'page-1', regions: [first], brushStrokes: [] }],
    brushStrokes: [],
    selectedRegionId: 'r1',
    _textUndoStack: [],
    _textRedoStack: [],
    _editorUndoStack: [],
    _editorRedoStack: [],
    _brushRedoStack: [],
  })

  useAppStore.getState().updateRegion('r1', { translatedText: 'หลัง' })
  useAppStore.getState().addBrushStroke(brush)

  assert.deepEqual(useAppStore.getState()._editorUndoStack.map((entry) => entry.kind), ['text', 'brush'])

  assert.equal(useAppStore.getState().undoEditorEdit(), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'หลัง')
  assert.equal(useAppStore.getState().brushStrokes.length, 0)

  assert.equal(useAppStore.getState().undoEditorEdit(), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'ก่อน')
  assert.equal(useAppStore.getState().brushStrokes.length, 0)

  assert.equal(useAppStore.getState().redoEditorEdit(2), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'หลัง')
  assert.deepEqual(useAppStore.getState().brushStrokes.map((item) => item.id), ['brush-after-text'])
})

test('live text resize can skip undo history until transform commit', async () => {
  const { useAppStore } = await loadAppStore()
  const first = region({ id: 'r1', bbox: { x: 0, y: 0, width: 100, height: 40 } })
  useAppStore.setState({
    activeImageId: 'page-1',
    regions: [first],
    imageEntries: [{ id: 'page-1', regions: [first], brushStrokes: [] }],
    _textUndoStack: [],
    _textRedoStack: [],
  })

  useAppStore.getState().updateRegion('r1', { bbox: { ...first.bbox, width: 120 } }, { trackHistory: false })
  assert.equal(useAppStore.getState()._textUndoStack.length, 0)

  useAppStore.getState().updateRegion('r1', { bbox: { ...first.bbox, width: 140 } })
  assert.equal(useAppStore.getState()._textUndoStack.length, 1)
})

test('repeated transform commits with the same history key collapse into one undo item', async () => {
  const { useAppStore } = await loadAppStore()
  const first = region({ id: 'r1', bbox: { x: 0, y: 0, width: 100, height: 40 } })
  const historyBefore = [first]
  useAppStore.setState({
    activeImageId: 'page-1',
    regions: [first],
    imageEntries: [{ id: 'page-1', regions: [first], brushStrokes: [] }],
    _textUndoStack: [],
    _textRedoStack: [],
  })

  useAppStore.getState().updateRegion('r1', { bbox: { ...first.bbox, width: 120 } }, { trackHistory: false })
  useAppStore.getState().updateRegion('r1', { bbox: { ...first.bbox, width: 140 } }, {
    historyBefore,
    historyKey: 'transform:r1',
  })
  useAppStore.getState().updateRegion('r1', { bbox: { ...first.bbox, width: 160 } }, {
    historyBefore,
    historyKey: 'transform:r1',
  })

  assert.equal(useAppStore.getState()._textUndoStack.length, 1)
  assert.equal(useAppStore.getState()._textUndoStack[0].before[0].bbox.width, 100)
  assert.equal(useAppStore.getState()._textUndoStack[0].after[0].bbox.width, 160)

  assert.equal(useAppStore.getState().undoTextEdit(), true)
  assert.equal(useAppStore.getState().regions[0].bbox.width, 100)
})

test('deleted text regions can be restored with undo', async () => {
  const { useAppStore } = await loadAppStore()
  const first = region({ id: 'r1' })
  useAppStore.setState({
    activeImageId: 'page-1',
    regions: [first],
    imageEntries: [{ id: 'page-1', regions: [first], brushStrokes: [] }],
    selectedRegionId: 'r1',
    _textUndoStack: [],
    _textRedoStack: [],
  })

  useAppStore.getState().deleteRegion('r1')
  assert.equal(useAppStore.getState().regions.length, 0)

  assert.equal(useAppStore.getState().undoTextEdit(), true)
  assert.equal(useAppStore.getState().regions.length, 1)
  assert.equal(useAppStore.getState().regions[0].id, 'r1')
})

test('text history can jump multiple undo and redo steps', async () => {
  const { useAppStore } = await loadAppStore()
  const first = region({ id: 'r1', translatedText: 'หนึ่ง' })
  useAppStore.setState({
    activeImageId: 'page-1',
    regions: [first],
    imageEntries: [{ id: 'page-1', regions: [first], brushStrokes: [] }],
    selectedRegionId: 'r1',
    _textUndoStack: [],
    _textRedoStack: [],
  })

  useAppStore.getState().updateRegion('r1', { translatedText: 'สอง' })
  useAppStore.getState().updateRegion('r1', { translatedText: 'สาม' })
  useAppStore.getState().updateRegion('r1', { translatedText: 'สี่' })

  assert.equal(useAppStore.getState().undoTextEdit(2), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'สอง')
  assert.deepEqual(
    useAppStore.getState()._textRedoStack.map((entry) => entry.after[0].translatedText),
    ['สี่', 'สาม'],
  )

  assert.equal(useAppStore.getState().redoTextEdit(2), true)
  assert.equal(useAppStore.getState().regions[0].translatedText, 'สี่')
  assert.deepEqual(
    useAppStore.getState()._textUndoStack.map((entry) => entry.after[0].translatedText),
    ['สอง', 'สาม', 'สี่'],
  )
})
