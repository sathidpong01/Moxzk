import test from 'node:test'
import assert from 'node:assert/strict'
import { computeTextHudPosition } from '../src/services/textHudPosition.ts'

test('computeTextHudPosition flips below the region when there is no room above', () => {
  const position = computeTextHudPosition({
    anchorRect: { x: 420, y: 18, width: 180, height: 56 },
    containerWidth: 1280,
    containerHeight: 720,
    hudWidth: 620,
    hudHeight: 52,
    preferredPlacement: 'top',
  })

  assert.equal(position.placement, 'bottom')
  assert.equal(position.top, 86)
})

test('computeTextHudPosition clamps inside the container when centered hud would overflow', () => {
  const position = computeTextHudPosition({
    anchorRect: { x: 18, y: 220, width: 96, height: 44 },
    containerWidth: 860,
    containerHeight: 640,
    hudWidth: 560,
    hudHeight: 52,
    preferredPlacement: 'top',
  })

  assert.equal(position.placement, 'top')
  assert.equal(position.left, 12)
  assert.equal(position.top, 156)
})
