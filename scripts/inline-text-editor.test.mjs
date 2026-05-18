import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getArtisticInlineTextEditorLayerSize,
  getInlineTextEditorCommitGeometry,
  getInlineTextEditorCommitValue,
  getInlineTextEditorBboxSize,
  getInlineTextEditorFontSize,
  getInlineTextEditorLayerSize,
  getTextBoxResizeResult,
  normalizeInlineTextEditorValue,
  shouldFinishInlineTextEditorOnPointerDown,
} from '../src/services/inlineTextEditor.ts'

test('inline text editor layer size maps image-space bbox into Konva layer units', () => {
  assert.deepEqual(
    getInlineTextEditorLayerSize({
      bbox: { x: 10, y: 20, width: 100, height: 50 },
      scale: 0.5,
      minWidth: 0,
      minHeight: 0,
    }),
    {
      width: 50,
      height: 25,
    },
  )
})

test('inline text editor layer size keeps a usable minimum edit area', () => {
  assert.deepEqual(
    getInlineTextEditorLayerSize({
      bbox: { x: 0, y: 0, width: 10, height: 8 },
      scale: 0.25,
    }),
    {
      width: 96,
      height: 44,
    },
  )
})

test('inline text editor font size matches scaled canvas text without an 8px floor', () => {
  const size = getInlineTextEditorFontSize({
    fontSize: 31,
    scale: 0.15,
  })

  assert.ok(Math.abs(size - 4.65) < 0.0001)
  assert.ok(size < 8)
})

test('artistic inline text editor layer size follows natural text bounds', () => {
  const size = getArtisticInlineTextEditorLayerSize({
    text: 'AA\nBBBB',
    bbox: { x: 0, y: 0, width: 400, height: 180 },
    scale: 2,
    fontSize: 10,
    minWidth: 0,
    minHeight: 0,
    lineHeight: 1.2,
    measureText: (text, fontSize) => text.length * fontSize,
  })

  assert.deepEqual(size, {
    width: 80,
    height: 48,
  })
})

test('inline text editor converts resized screen dimensions back to image-space bbox size', () => {
  assert.deepEqual(
    getInlineTextEditorBboxSize({
      metrics: { width: 300, height: 120 },
      scale: 0.5,
    }),
    { width: 600, height: 240 },
  )
})

test('frame inline editor collapses visual soft wraps back to reflow text', () => {
  assert.equal(
    normalizeInlineTextEditorValue('เรากำลังจะไป\nไหนกันครับพ่อ\nสถานที่ที่พ่อบอก', true),
    'เรากำลังจะไปไหนกันครับพ่อสถานที่ที่พ่อบอก',
  )
  assert.equal(
    normalizeInlineTextEditorValue('hello\nworld', true),
    'hello world',
  )
  assert.equal(
    normalizeInlineTextEditorValue('manual\nline', false),
    'manual\nline',
  )
})

test('inline text editor preserves the original value when visual wrapping was not edited', () => {
  assert.equal(
    getInlineTextEditorCommitValue({
      value: 'เรากำลังจะไปไหนกันครับพ่อสถานที่ที่พ่อบอก',
      editorValue: 'เรากำลังจะไป\nไหนกันครับพ่อ\nสถานที่ที่พ่อบอก',
      editedValue: 'เรากำลังจะไป\nไหนกันครับพ่อ\nสถานที่ที่พ่อบอก',
      constrainToFrame: true,
      dirty: false,
    }),
    'เรากำลังจะไปไหนกันครับพ่อสถานที่ที่พ่อบอก',
  )
})

test('inline text editor commits normalized frame text only after a real edit', () => {
  assert.equal(
    getInlineTextEditorCommitValue({
      value: 'hello world',
      editorValue: 'hello\nworld',
      editedValue: 'hello\nworld!',
      constrainToFrame: true,
      dirty: true,
    }),
    'hello world!',
  )
  assert.equal(
    getInlineTextEditorCommitValue({
      value: 'manual',
      editorValue: 'manual',
      editedValue: 'manual\nline',
      constrainToFrame: false,
      dirty: true,
    }),
    'manual\nline',
  )
})

test('balloon resize persists the scaled preferred font, not the fitted size', () => {
  const result = getTextBoxResizeResult({
    region: {
      bbox: { x: 0, y: 0, width: 320, height: 180 },
      fontSize: 36,
      textLayoutMode: 'balloon_fit',
      textAlign: 'center',
      textScaleX: 1,
      textScaleY: 1,
      mood: 'neutral',
      balloonShape: 'round',
      artisticFit: 'free',
    },
    bbox: { x: 0, y: 0, width: 140, height: 92 },
    text: 'เรากำลังจะไปไหนกันครับพ่อสถานที่ที่พ่อบอก',
    fontFamily: 'Sarabun',
    fontWeight: 400,
    fontStyle: 'normal',
    rotation: 3,
  })

  assert.deepEqual(result.updates.bbox, { x: 0, y: 0, width: 140, height: 92 })
  assert.equal(result.updates.rotation, 3)
  assert.ok(result.layout)
  // Persisted fontSize is the scaled preferred ceiling (36 * box ratio),
  // never the text-dependent fitted size — otherwise resizing would ratchet.
  assert.ok(Math.abs(result.updates.fontSize - 36 * (92 / 180)) < 0.001)
  assert.ok(result.layout.fontSize <= result.updates.fontSize + 0.001)
  assert.ok(result.layout.lines.length > 1)
})

test('balloon resize scales the preferred font up when the fit box expands', () => {
  const result = getTextBoxResizeResult({
    region: {
      bbox: { x: 0, y: 0, width: 140, height: 92 },
      fontSize: 18,
      textLayoutMode: 'balloon_fit',
      textAlign: 'center',
      textScaleX: 1,
      textScaleY: 1,
      mood: 'neutral',
      balloonShape: 'round',
      artisticFit: 'free',
    },
    bbox: { x: 0, y: 0, width: 280, height: 184 },
    text: 'เรากำลังจะไปไหนกันครับพ่อ',
    fontFamily: 'Sarabun',
    fontWeight: 400,
    fontStyle: 'normal',
  })

  assert.ok(result.layout)
  // box doubled on both axes → preferred ceiling scales 18 → 36
  assert.equal(result.updates.fontSize, 36)
  assert.ok(result.layout.fontSize <= 36 + 0.001)
  assert.ok(result.layout.fontSize > 18)
})

test('commit geometry keeps a balloon_fit box fixed and never persists fontSize', () => {
  const geometry = getInlineTextEditorCommitGeometry({
    region: {
      bbox: { x: 12, y: 20, width: 140, height: 92 },
      textLayoutMode: 'balloon_fit',
      artisticFit: 'free',
    },
    metrics: { width: 900, height: 700 },
    scale: 1,
  })

  assert.deepEqual(geometry, {})
})

test('commit geometry grows the box for artistic free text', () => {
  const geometry = getInlineTextEditorCommitGeometry({
    region: {
      bbox: { x: 12, y: 20, width: 140, height: 92 },
      textLayoutMode: 'artistic',
      artisticFit: 'free',
    },
    metrics: { width: 300, height: 120 },
    scale: 0.5,
  })

  assert.deepEqual(geometry, { bbox: { x: 12, y: 20, width: 600, height: 240 } })
})

test('commit geometry keeps an artistic bubble-guided box fixed', () => {
  const geometry = getInlineTextEditorCommitGeometry({
    region: {
      bbox: { x: 12, y: 20, width: 140, height: 92 },
      textLayoutMode: 'artistic',
      artisticFit: 'bubble_guided',
    },
    metrics: { width: 900, height: 700 },
    scale: 1,
  })

  assert.deepEqual(geometry, {})
})

test('inline text editor outside pointer finishes edit session', () => {
  const insideTarget = { id: 'inside' }
  const outsideTarget = { id: 'outside' }
  const root = {
    contains: (target) => target === insideTarget,
  }

  assert.equal(shouldFinishInlineTextEditorOnPointerDown(root, insideTarget), false)
  assert.equal(shouldFinishInlineTextEditorOnPointerDown(root, outsideTarget), true)
  assert.equal(shouldFinishInlineTextEditorOnPointerDown(null, outsideTarget), false)
})
