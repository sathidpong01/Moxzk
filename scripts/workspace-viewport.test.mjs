import test from 'node:test'
import assert from 'node:assert/strict'
import { computeBoardViewport, computeFocusViewport } from '../src/services/workspaceViewport.ts'

test('computeBoardViewport fits the whole artboard set into the stage', () => {
  const viewport = computeBoardViewport({
    stageSize: { width: 1280, height: 720 },
    artboards: [
      { x: 40, y: 20, width: 300, height: 420 },
      { x: 480, y: 20, width: 300, height: 420 },
    ],
  })

  assert.equal(viewport.zoom, 1)
  assert.equal(Math.round(viewport.x), 230)
  assert.equal(Math.round(viewport.y), 130)
})

test('computeFocusViewport centers the active artboard with a tighter zoom', () => {
  const viewport = computeFocusViewport({
    stageSize: { width: 1280, height: 720 },
    artboard: { x: 480, y: 20, width: 300, height: 420 },
  })

  assert.equal(viewport.zoom, 1.29)
  assert.equal(Math.round(viewport.x), -170)
  assert.equal(Math.round(viewport.y), 64)
})
