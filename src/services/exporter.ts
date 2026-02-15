import Konva from 'konva'
import { saveAs } from 'file-saver'
import type { ExportFormat } from '../types'

const MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

export function renderStageToDataUrl(
  stage: Konva.Stage,
  scale: number,
): string {
  const saved = {
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
    x: stage.x(),
    y: stage.y(),
  }

  // Hide any transformer nodes before export
  stage.find('Transformer').forEach((t) => t.visible(false))

  stage.scaleX(1)
  stage.scaleY(1)
  stage.x(0)
  stage.y(0)
  stage.batchDraw()

  // Use pixelRatio = 1/scale to export at original image resolution
  const pixelRatio = scale > 0 ? 1 / scale : 2
  const dataUrl = stage.toDataURL({
    mimeType: 'image/png',
    quality: 1,
    pixelRatio,
  })

  // Restore transformer visibility
  stage.find('Transformer').forEach((t) => t.visible(true))

  stage.scaleX(saved.scaleX)
  stage.scaleY(saved.scaleY)
  stage.x(saved.x)
  stage.y(saved.y)
  stage.batchDraw()

  return dataUrl
}

export function exportFromDataUrl(
  srcDataUrl: string,
  filename: string,
  options: { format: ExportFormat; quality: number },
): void {
  const ext = options.format === 'jpg' ? 'jpg' : options.format
  const finalName = filename.replace(/\.[^.]+$/, '') + '.' + ext

  if (options.format === 'png') {
    const blob = dataUrlToBlob(srcDataUrl)
    saveAs(blob, finalName)
    return
  }

  // Re-encode via canvas for jpg/webp format + quality
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) saveAs(blob, finalName)
      },
      MIME_TYPES[options.format],
      options.quality,
    )
  }
  img.src = srcDataUrl
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
