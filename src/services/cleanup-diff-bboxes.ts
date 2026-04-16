import type { BoundingBox, TextRegion } from '../types'

interface CandidateBox extends BoundingBox {
  changedPixels: number
}

interface ComponentStats {
  minX: number
  minY: number
  maxX: number
  maxY: number
  changedPixels: number
}

const MAX_SCAN_PIXELS = 2_000_000

export async function deriveTextBoxesFromCleanupDiff(
  originalFile: File,
  cleanedBlob: Blob,
): Promise<BoundingBox[]> {
  const [original, cleaned] = await Promise.all([
    loadImage(originalFile),
    loadImage(cleanedBlob),
  ])
  const width = original.naturalWidth || original.width
  const height = original.naturalHeight || original.height
  if (width <= 0 || height <= 0) return []

  const scale = Math.min(1, Math.sqrt(MAX_SCAN_PIXELS / (width * height)))
  const scanWidth = Math.max(1, Math.round(width * scale))
  const scanHeight = Math.max(1, Math.round(height * scale))
  const [originalData, cleanedData] = drawPair(original, cleaned, scanWidth, scanHeight)
  const mask = buildChangedTextMask(originalData.data, cleanedData.data, scanWidth, scanHeight)
  const radius = Math.max(4, Math.min(16, Math.round(Math.min(scanWidth, scanHeight) * 0.012)))
  const dilated = dilateMask(mask, scanWidth, scanHeight, radius)
  const components = findComponents(dilated, mask, scanWidth, scanHeight)
  const minBoxArea = Math.max(40, scanWidth * scanHeight * 0.000015)
  const maxBoxArea = scanWidth * scanHeight * 0.08

  const boxes = components
    .map((component) => toCandidateBox(component, scale))
    .filter((box) => {
      const area = box.width * box.height
      const aspect = box.width / Math.max(1, box.height)
      const isFooterNoise = box.y > height * 0.92 && aspect > 5
      return (
        !isFooterNoise &&
        box.changedPixels >= 8 &&
        box.width >= 6 &&
        box.height >= 6 &&
        area >= minBoxArea / (scale * scale) &&
        area <= maxBoxArea / (scale * scale)
      )
    })
    .map((box) => padBox(box, width, height))
    .sort(readingOrder)

  return boxes
}

export function alignRegionsToCleanupBoxes(
  regions: TextRegion[],
  boxes: BoundingBox[],
): TextRegion[] {
  if (regions.length === 0 || boxes.length === 0) return regions

  const sortedRegions = [...regions].sort((a, b) => readingOrder(a.bbox, b.bbox))
  const fittedBoxes = fitBoxesToCount(boxes, sortedRegions.length)
  const boxByRegionId = new Map<string, BoundingBox>()

  sortedRegions.forEach((region, index) => {
    const box = fittedBoxes[index]
    if (box) boxByRegionId.set(region.id, box)
  })

  return regions.map((region) => {
    const bbox = boxByRegionId.get(region.id)
    if (!bbox) return region
    return {
      ...region,
      bbox,
      fontSize: calcAutoFontSize(region.translatedText || region.originalText, bbox),
    }
  })
}

function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image for cleanup diff'))
    }
    image.src = url
  })
}

function drawPair(
  original: HTMLImageElement,
  cleaned: HTMLImageElement,
  width: number,
  height: number,
): [ImageData, ImageData] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create canvas context for cleanup diff')

  ctx.drawImage(original, 0, 0, width, height)
  const originalData = ctx.getImageData(0, 0, width, height)
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(cleaned, 0, 0, width, height)
  const cleanedData = ctx.getImageData(0, 0, width, height)
  return [originalData, cleanedData]
}

function buildChangedTextMask(
  original: Uint8ClampedArray,
  cleaned: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < original.length; i += 4, p++) {
    const originalLum = luminance(original[i], original[i + 1], original[i + 2])
    const cleanedLum = luminance(cleaned[i], cleaned[i + 1], cleaned[i + 2])
    const channelDiff =
      Math.abs(original[i] - cleaned[i]) +
      Math.abs(original[i + 1] - cleaned[i + 1]) +
      Math.abs(original[i + 2] - cleaned[i + 2])
    const becameLighter = cleanedLum - originalLum > 22
    const darkOriginal = originalLum < 190
    const strongDiff = channelDiff > 95

    if (strongDiff && darkOriginal && becameLighter) {
      mask[p] = 1
    }
  }
  return mask
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(mask.length)
  const output = new Uint8Array(mask.length)

  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue
      const from = Math.max(0, x - radius)
      const to = Math.min(width - 1, x + radius)
      for (let xx = from; xx <= to; xx++) horizontal[row + xx] = 1
    }
  }

  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (!horizontal[row + x]) continue
      const from = Math.max(0, y - radius)
      const to = Math.min(height - 1, y + radius)
      for (let yy = from; yy <= to; yy++) output[yy * width + x] = 1
    }
  }

  return output
}

function findComponents(
  mask: Uint8Array,
  sourceMask: Uint8Array,
  width: number,
  height: number,
): ComponentStats[] {
  const visited = new Uint8Array(mask.length)
  const components: ComponentStats[] = []
  const queue: number[] = []

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue

    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let changedPixels = 0
    visited[start] = 1
    queue.length = 0
    queue.push(start)

    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]
      const x = index % width
      const y = Math.floor(index / width)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      if (sourceMask[index]) changedPixels++

      visitNeighbor(index - 1, x > 0)
      visitNeighbor(index + 1, x < width - 1)
      visitNeighbor(index - width, y > 0)
      visitNeighbor(index + width, y < height - 1)
    }

    components.push({ minX, minY, maxX, maxY, changedPixels })
  }

  function visitNeighbor(index: number, valid: boolean) {
    if (!valid || !mask[index] || visited[index]) return
    visited[index] = 1
    queue.push(index)
  }

  return components
}

function toCandidateBox(component: ComponentStats, scale: number): CandidateBox {
  return {
    x: Math.round(component.minX / scale),
    y: Math.round(component.minY / scale),
    width: Math.max(1, Math.round((component.maxX - component.minX + 1) / scale)),
    height: Math.max(1, Math.round((component.maxY - component.minY + 1) / scale)),
    changedPixels: component.changedPixels,
  }
}

function padBox(box: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
  const padX = Math.max(8, Math.round(box.width * 0.35))
  const padY = Math.max(8, Math.round(box.height * 0.65))
  const x = Math.max(0, box.x - padX)
  const y = Math.max(0, box.y - padY)
  const right = Math.min(imageWidth, box.x + box.width + padX)
  const bottom = Math.min(imageHeight, box.y + box.height + padY)
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  }
}

function fitBoxesToCount(boxes: BoundingBox[], count: number): BoundingBox[] {
  const fitted = [...boxes].sort(readingOrder)
  if (count <= 0) return []

  while (fitted.length > count) {
    let bestIndex = 0
    let bestScore = Number.POSITIVE_INFINITY
    for (let i = 0; i < fitted.length - 1; i++) {
      const score = mergeScore(fitted[i], fitted[i + 1])
      if (score < bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    fitted.splice(bestIndex, 2, unionBox(fitted[bestIndex], fitted[bestIndex + 1]))
  }

  return fitted
}

function mergeScore(a: BoundingBox, b: BoundingBox): number {
  const centerAX = a.x + a.width / 2
  const centerAY = a.y + a.height / 2
  const centerBX = b.x + b.width / 2
  const centerBY = b.y + b.height / 2
  const dx = Math.abs(centerAX - centerBX) / Math.max(a.width, b.width, 1)
  const dy = Math.abs(centerAY - centerBY) / Math.max(a.height, b.height, 1)
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const overlapBonus = overlapX / Math.max(Math.min(a.width, b.width), 1)
  return dx + dy - overlapBonus
}

function unionBox(a: BoundingBox, b: BoundingBox): BoundingBox {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

function readingOrder(a: BoundingBox, b: BoundingBox): number {
  const rowTolerance = Math.max(16, Math.min(a.height, b.height) * 0.8)
  if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y
  return a.x - b.x
}

function calcAutoFontSize(text: string, bbox: BoundingBox): number {
  if (bbox.width <= 0 || bbox.height <= 0) return 14
  const textLen = Math.max(text.length, 1)
  const charW = 0.58
  const lineH = 1.22
  let size = Math.min(36, bbox.width / 3.2, bbox.height * 0.5)

  while (size > 10) {
    const charsPerLine = Math.max(1, Math.floor(bbox.width / (size * charW)))
    const lines = Math.ceil(textLen / charsPerLine)
    if (lines * size * lineH <= bbox.height * 0.92) break
    size -= 1
  }

  return Math.round(Math.max(10, Math.min(size, 60)))
}
