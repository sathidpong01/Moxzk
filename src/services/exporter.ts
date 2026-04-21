import Konva from 'konva'
import { saveAs } from 'file-saver'
import type { ExportFormat, ImageEntry, TextRegion } from '../types'
import type { AlbumPage } from '../types/database'
import { resolveRegionFont } from '../config/fonts'
import { layoutTextInBox, normalizeTextAlign, normalizeTextLayoutMode } from '../utils/textLayout'
import { drawBrushOverlay } from './brushStrokes'
import { downloadImage } from './storageService'
import { webRuntime } from '../runtime/webRuntime'

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

export interface ImageEntryExportOptions {
  format: ExportFormat
  quality: number
  albumTitle: string
  selectedIds: string[]
  onProgress?: (current: number, total: number) => void
}

export async function exportImageEntries(
  entries: ImageEntry[],
  options: ImageEntryExportOptions,
): Promise<'folder' | 'zip'> {
  const selected = entries
    .filter((entry) => options.selectedIds.includes(entry.id))
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))

  if (selected.length === 0) throw new Error('ไม่มีหน้าที่เลือกสำหรับ export')

  const rendered: Array<{ name: string; blob: Blob }> = []
  for (let i = 0; i < selected.length; i += 1) {
    const entry = selected[i]
    const blob = await renderImageEntryToBlob(entry, options.format, options.quality)
    const pageNumber = String(entry.pageNumber ?? i + 1).padStart(3, '0')
    rendered.push({
      name: `${safeFilename(options.albumTitle || 'manga')}_${pageNumber}.${extensionForFormat(options.format)}`,
      blob,
    })
    options.onProgress?.(i + 1, selected.length)
  }

  return webRuntime.files.saveExportFiles(rendered, options.albumTitle || 'manga')
}

export async function renderImageEntryToBlob(
  entry: ImageEntry,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const image = await loadHtmlImage(entry.cleanedImageUrl || entry.originalUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  drawBrushOverlay(ctx, canvas.width, canvas.height, entry.brushStrokes)
  drawTextRegions(ctx, entry.regions)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Export canvas failed')),
      MIME_TYPES[format],
      format === 'png' ? undefined : quality,
    )
  })
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

function drawTextRegions(ctx: CanvasRenderingContext2D, regions: TextRegion[]) {
  for (const region of regions) {
    const text = region.translatedText || ''
    if (!text.trim()) continue
    const font = resolveRegionFont(region)
    const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
    const textAlign = normalizeTextAlign(region.textAlign)
    const weight = font.weight >= 700 ? '700' : '400'
    const style = font.style === 'italic' ? 'italic ' : ''
    const fontFamily = font.family.includes(' ') ? `"${font.family}"` : font.family
    const layout = layoutMode === 'artistic'
      ? null
      : layoutTextInBox(text, region.bbox, region.fontSize, {
          fontFamily: font.family,
          fontWeight: weight,
          fontStyle: font.style,
        })
    const size = layoutMode === 'artistic' ? Math.max(8, region.fontSize) : layout!.fontSize

    ctx.save()
    ctx.translate(region.bbox.x + region.bbox.width / 2, region.bbox.y + region.bbox.height / 2)
    ctx.rotate((region.rotation || 0) * Math.PI / 180)
    ctx.font = `${style}${weight} ${size}px ${fontFamily}, sans-serif`
    ctx.fillStyle = region.fontColor
    ctx.strokeStyle = region.strokeColor
    ctx.lineWidth = region.strokeWidth
    ctx.lineJoin = region.strokeJoin ?? 'round'
    ctx.textBaseline = 'middle'
    ctx.textAlign = textAlign

    const lines = layout?.lines ?? text.split(/\r?\n/)
    const lineHeight = size * 1.18
    const totalHeight = lines.length * lineHeight
    const startY = -totalHeight / 2 + lineHeight / 2
    const textX = textAlign === 'left'
      ? -region.bbox.width / 2
      : textAlign === 'right'
        ? region.bbox.width / 2
        : 0
    for (let i = 0; i < lines.length; i += 1) {
      const y = startY + i * lineHeight
      if (region.strokeWidth > 0) ctx.strokeText(lines[i], textX, y)
      ctx.fillText(lines[i], textX, y)
    }
    ctx.restore()
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('โหลดรูปสำหรับ export ไม่สำเร็จ'))
    img.src = src
  })
}

function extensionForFormat(format: ExportFormat): string {
  return format === 'jpg' ? 'jpg' : format
}

function safeFilename(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'manga'
}

// ── Batch Album Export ──────────────────────────────────────────────

export interface BatchExportOptions {
  format: ExportFormat
  quality: number
  onProgress?: (current: number, total: number) => void
}

export async function exportAlbumPages(
  pages: AlbumPage[],
  albumTitle: string,
  options: BatchExportOptions = { format: 'webp', quality: 0.92 },
): Promise<void> {
  const { format, quality, onProgress } = options
  const ext = format === 'jpg' ? 'jpg' : format
  const mime = MIME_TYPES[format]

  if (pages.length === 0) return

  if (pages.length === 1) {
    const page = pages[0]
    const blob = await pageToBlob(page, mime, quality)
    if (blob) {
      const num = String(page.page_number).padStart(3, '0')
      await webRuntime.files.saveFile({ name: `${safeFilename(albumTitle)}_${num}.${ext}`, blob })
    }
    onProgress?.(1, 1)
    return
  }

  const rendered: Array<{ name: string; blob: Blob }> = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const blob = await pageToBlob(page, mime, quality)
    if (blob) {
      const num = String(page.page_number).padStart(3, '0')
      rendered.push({ name: `${safeFilename(albumTitle)}_${num}.${ext}`, blob })
    }
    onProgress?.(i + 1, pages.length)
  }

  if (rendered.length > 0) {
    await webRuntime.files.saveExportFiles(rendered, albumTitle)
  }
}

async function pageToBlob(
  page: AlbumPage,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  // If thumbnail_key is a data URL, convert it to the target format
  const key = page.thumbnail_key as string | null
  if (!key) return null

  if (key.startsWith('data:') || key.startsWith('blob:') || /^https?:\/\//.test(key)) {
    return imageSourceToBlob(key, mime, quality)
  }

  let objectUrl: string | null = null
  try {
    objectUrl = await downloadImage(key)
    return imageSourceToBlob(objectUrl, mime, quality)
  } finally {
    if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl)
  }
}

function imageSourceToBlob(src: string, mime: string, quality: number): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => resolve(blob),
        mime,
        quality,
      )
    }
    img.onerror = () => resolve(null)
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}
