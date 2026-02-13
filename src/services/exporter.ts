import type { ExportFormat, ExportOptions } from '../types'

const DEFAULT_OPTIONS: ExportOptions = {
  format: 'png',
  quality: 0.95,
  scale: 1,
}

const MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

export function exportCanvas(
  canvas: HTMLCanvasElement,
  options: Partial<ExportOptions> = {},
): Blob {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const mimeType = MIME_TYPES[opts.format]

  let exportCanvas = canvas
  if (opts.scale !== 1) {
    exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width * opts.scale
    exportCanvas.height = canvas.height * opts.scale
    const ctx = exportCanvas.getContext('2d')
    if (ctx) {
      ctx.scale(opts.scale, opts.scale)
      ctx.drawImage(canvas, 0, 0)
    }
  }

  const dataUrl = exportCanvas.toDataURL(mimeType, opts.quality)
  return dataUrlToBlob(dataUrl)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAndDownload(
  canvas: HTMLCanvasElement,
  filename: string,
  options: Partial<ExportOptions> = {},
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const blob = exportCanvas(canvas, opts)
  const ext = opts.format === 'jpg' ? 'jpg' : opts.format
  const finalName = filename.replace(/\.[^.]+$/, '') + '.' + ext
  downloadBlob(blob, finalName)
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(parts[1])
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}
