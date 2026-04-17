import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VIEWER_ZOOM_STEP,
  clampViewerZoom,
  stepViewerZoom,
  wheelViewerZoom,
} from '../src/services/viewerZoom.ts'

test('viewer zoom button step changes by 10 percent', () => {
  assert.equal(VIEWER_ZOOM_STEP, 0.1)
  assert.equal(stepViewerZoom(1, 'in'), 1.1)
  assert.equal(stepViewerZoom(1, 'out'), 0.9)
})

test('viewer wheel zoom uses the same 10 percent step', () => {
  assert.equal(wheelViewerZoom(1, -120), 1.1)
  assert.equal(wheelViewerZoom(1, 120), 0.9)
})

test('viewer zoom remains clamped to the supported range', () => {
  assert.equal(clampViewerZoom(0), 0.25)
  assert.equal(clampViewerZoom(9), 5)
  assert.equal(stepViewerZoom(0.25, 'out'), 0.25)
  assert.equal(stepViewerZoom(5, 'in'), 5)
})
