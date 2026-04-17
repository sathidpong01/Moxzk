import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getInlineTextEditorBboxSize,
  getInlineTextEditorLayerSize,
  getInlineTextEditorTheme,
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

test('inline text editor converts resized screen dimensions back to image-space bbox size', () => {
  assert.deepEqual(
    getInlineTextEditorBboxSize({
      metrics: { width: 300, height: 120 },
      scale: 0.5,
    }),
    { width: 600, height: 240 },
  )
})

test('inline text editor uses a light editing surface for dark text', () => {
  assert.deepEqual(
    getInlineTextEditorTheme('#000000'),
    {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      textColor: '#111827',
      caretColor: '#111827',
      textShadow: '0 0 3px rgba(255, 255, 255, 0.95), 0 0 8px rgba(255, 255, 255, 0.65)',
    },
  )
})

test('inline text editor uses a dark editing surface for light text', () => {
  assert.deepEqual(
    getInlineTextEditorTheme('#ffffff'),
    {
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
      textColor: '#f9fafb',
      caretColor: '#f9fafb',
      textShadow: '0 0 3px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.65)',
    },
  )
})
