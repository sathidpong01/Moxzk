import test from 'node:test'
import assert from 'node:assert/strict'
import { growBalloonBox } from '../src/services/balloon-detect.ts'

const W = 400
const H = 300

function makeImage(fill) {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i += 1) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = 255
  }
  return data
}

function fillRect(data, box, color) {
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      const i = (y * W + x) * 4
      data[i] = color[0]
      data[i + 1] = color[1]
      data[i + 2] = color[2]
    }
  }
}

test('grows a text seed out to the enclosing balloon fill', () => {
  const data = makeImage([20, 20, 20]) // dark page
  const balloon = { x: 120, y: 90, width: 110, height: 78 }
  fillRect(data, balloon, [255, 255, 255]) // white balloon
  const seed = { x: 158, y: 122, width: 36, height: 24 } // text inside balloon

  const result = growBalloonBox(data, W, H, seed)

  assert.notDeepEqual(result, seed)
  assert.ok(result.x <= seed.x && result.y <= seed.y)
  assert.ok(result.x + result.width >= seed.x + seed.width)
  assert.ok(result.y + result.height >= seed.y + seed.height)
  // approximates the balloon, not the whole page
  assert.ok(result.width >= 100 && result.width <= 112)
  assert.ok(result.height >= 70 && result.height <= 80)
})

test('returns the seed unchanged when the fill leaks across the page', () => {
  const data = makeImage([255, 255, 255]) // uniformly white — no balloon edge
  const seed = { x: 190, y: 140, width: 36, height: 24 }

  assert.equal(growBalloonBox(data, W, H, seed), seed)
})

test('returns the seed unchanged when it is too large to be a text box', () => {
  const data = makeImage([255, 255, 255])
  const seed = { x: 20, y: 20, width: 240, height: 200 } // >15% of the page

  assert.equal(growBalloonBox(data, W, H, seed), seed)
})

test('detects a cream-tinted balloon, not just pure white', () => {
  const data = makeImage([40, 35, 30]) // dark page
  const balloon = { x: 110, y: 80, width: 120, height: 96 }
  fillRect(data, balloon, [240, 232, 214]) // cream balloon
  const seed = { x: 150, y: 118, width: 40, height: 28 }

  const result = growBalloonBox(data, W, H, seed)

  assert.notDeepEqual(result, seed)
  assert.ok(result.width >= 110 && result.height >= 88)
})
