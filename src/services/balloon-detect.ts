import type { BoundingBox } from '../types'

export interface BalloonDetectOptions {
  /** Max L1 colour distance (sum over R+G+B) from the balloon-fill colour. */
  colorTolerance?: number
  /** Accepted balloon box area must stay within this fraction of the page. */
  maxPageFraction?: number
  /** Subsample stride — larger is faster, coarser. */
  step?: number
}

const DEFAULTS: Required<BalloonDetectOptions> = {
  colorTolerance: 52,
  maxPageFraction: 0.16,
  step: 2,
}

/** A seed larger than this fraction of the page is not a real text box. */
const MAX_SEED_PAGE_FRACTION = 0.15
/** Flood that visits more than this fraction of the page has leaked. */
const LEAK_PAGE_FRACTION = 0.22

/**
 * Grows the speech-balloon box around a text seed.
 *
 * Runs on the *cleaned* image (text already inpainted away), so the pixels
 * inside the seed are pure balloon fill. It samples that fill colour, flood
 * fills the connected region of the same colour, and returns its bounding box.
 *
 * The result is only accepted when it looks like a real balloon — it must
 * enclose the seed, stay off the image edge, and stay within a bounded
 * fraction of the page. On any failure (leaked into the page, balloon not
 * uniform, seed too large to be a text box) it returns the seed unchanged, so
 * callers always receive a usable box and never something worse than input.
 */
export function growBalloonBox(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  seed: BoundingBox,
  options: BalloonDetectOptions = {},
): BoundingBox {
  const { colorTolerance, maxPageFraction, step } = { ...DEFAULTS, ...options }
  const stride = Math.max(1, Math.round(step))
  const pageArea = width * height

  const sx = Math.max(0, Math.min(width - 1, Math.round(seed.x)))
  const sy = Math.max(0, Math.min(height - 1, Math.round(seed.y)))
  const sw = Math.max(1, Math.round(seed.width))
  const sh = Math.max(1, Math.round(seed.height))
  const seedArea = sw * sh

  // A seed covering a large fraction of the page is not a text box (e.g. a
  // sloppy model bbox) — flood filling from it would sample garbage.
  if (seedArea > pageArea * MAX_SEED_PAGE_FRACTION) return seed

  // Target colour = mean of the cleaned pixels inside the seed = balloon fill.
  let r = 0
  let g = 0
  let b = 0
  let samples = 0
  for (let y = sy; y < Math.min(height, sy + sh); y += stride) {
    for (let x = sx; x < Math.min(width, sx + sw); x += stride) {
      const i = (y * width + x) * 4
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      samples += 1
    }
  }
  if (samples === 0) return seed
  r /= samples
  g /= samples
  b /= samples

  const startX = Math.min(width - 1, sx + (sw >> 1))
  const startY = Math.min(height - 1, sy + (sh >> 1))
  const cellBudget = Math.ceil(((width / stride) * (height / stride)) * LEAK_PAGE_FRACTION)

  const visited = new Uint8Array(width * height)
  const stack: number[] = [startX, startY]
  visited[startY * width + startX] = 1
  let minX = startX
  let maxX = startX
  let minY = startY
  let maxY = startY
  let filled = 0

  while (stack.length > 0) {
    const y = stack.pop() as number
    const x = stack.pop() as number
    filled += 1
    if (filled > cellBudget) return seed // leaked across the page
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y

    for (let dir = 0; dir < 4; dir += 1) {
      const nx = x + (dir === 0 ? stride : dir === 1 ? -stride : 0)
      const ny = y + (dir === 2 ? stride : dir === 3 ? -stride : 0)
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const vi = ny * width + nx
      if (visited[vi]) continue
      const pi = vi * 4
      const dist =
        Math.abs(pixels[pi] - r) +
        Math.abs(pixels[pi + 1] - g) +
        Math.abs(pixels[pi + 2] - b)
      if (dist > colorTolerance) continue
      visited[vi] = 1
      stack.push(nx, ny)
    }
  }

  const box: BoundingBox = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
  const enclosesSeed =
    box.x <= sx &&
    box.y <= sy &&
    box.x + box.width >= sx + sw &&
    box.y + box.height >= sy + sh
  const offEdge =
    minX > stride &&
    minY > stride &&
    maxX < width - 1 - stride &&
    maxY < height - 1 - stride
  const area = box.width * box.height
  const bounded = area >= seedArea && area <= pageArea * maxPageFraction

  if (!enclosesSeed || !offEdge || !bounded) return seed
  return box
}
