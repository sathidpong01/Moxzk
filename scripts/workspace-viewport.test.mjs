import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeBoardViewport,
  getViewportZoomPercent,
  getZoomFromViewportPercent,
} from '../src/services/workspaceViewport.ts'

test('computeBoardViewport fits the whole artboard set into the stage', () => {
  const viewport = computeBoardViewport({
    stageSize: { width: 1280, height: 720 },
    artboards: [
      { x: 40, y: 20, width: 300, height: 420 },
      { x: 480, y: 20, width: 300, height: 420 },
    ],
  })

  assert.equal(viewport.zoom, 1.43)
  assert.equal(Math.round(viewport.x), 54)
  assert.equal(Math.round(viewport.y), 31)
})

test('viewport zoom percent reflects effective image scale instead of fit-relative zoom', () => {
  assert.equal(getViewportZoomPercent(1, 0.25), 25)
  assert.equal(getViewportZoomPercent(1.67, 0.25), 42)
  assert.equal(getZoomFromViewportPercent(100, 0.25), 4)
})
