import Konva from 'konva'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { ExportFormat, ImageEntry, TextRegion } from '../types'
import type { AlbumPage } from '../types/database'
import { resolveRegionFont } from '../config/fonts'
import { layoutTextInBox, normalizeTextLayoutMode } from '../utils/textLayout'
import { drawBrushOverlay } from './brushStrokes'

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

  const directoryPicker = getDirectoryPicker()
  if (directoryPicker) {
    try {
      const dir = await directoryPicker()
      for (const file of rendered) {
        const handle = await dir.getFileHandle(file.name, { create: true })
        const writable = await handle.createWritable()
        await writable.write(file.blob)
        await writable.close()
      }
      return 'folder'
    } catch (error) {
      if (isAbortError(error)) throw error
      console.warn('[export] folder export failed, falling back to zip:', error)
    }
  }

  const zip = new JSZip()
  for (const file of rendered) {
    zip.file(file.name, file.blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${safeFilename(options.albumTitle || 'manga')}.zip`)
  return 'zip'
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
    ctx.textAlign = layoutMode === 'artistic' ? 'left' : 'center'

    const lines = layout?.lines ?? text.split(/\r?\n/)
    const lineHeight = size * 1.18
    const totalHeight = lines.length * lineHeight
    const startY = -totalHeight / 2 + lineHeight / 2
    for (let i = 0; i < lines.length; i += 1) {
      const x = layoutMode === 'artistic' ? -region.bbox.width / 2 : 0
      const y = startY + i * lineHeight
      if (region.strokeWidth > 0) ctx.strokeText(lines[i], x, y)
      ctx.fillText(lines[i], x, y)
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

type DirectoryPicker = () => Promise<{
  getFileHandle: (name: string, options: { create: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}>

function getDirectoryPicker(): DirectoryPicker | null {
  const candidate = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  return typeof candidate === 'function' ? candidate.bind(window) : null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
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

  // Single page → direct download (no zip)
  if (pages.length === 1) {
    const page = pages[0]
    const blob = await pageToBlob(page, mime, quality)
    if (blob) {
      const num = String(page.page_number).padStart(3, '0')
      saveAs(blob, `${albumTitle}_${num}.${ext}`)
    }
    onProgress?.(1, 1)
    return
  }

  // Multiple pages → ZIP
  const zip = new JSZip()

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const blob = await pageToBlob(page, mime, quality)
    if (blob) {
      const num = String(page.page_number).padStart(3, '0')
      zip.file(`${albumTitle}_${num}.${ext}`, blob)
    }
    onProgress?.(i + 1, pages.length)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${albumTitle}.zip`)
}

async function pageToBlob(
  page: AlbumPage,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  // If thumbnail_key is a data URL, convert it to the target format
  const key = page.thumbnail_key as string | null
  if (!key) return null

  if (key.startsWith('data:')) {
    return new Promise<Blob | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => resolve(blob),
          mime,
          quality,
        )
      }
      img.onerror = () => resolve(null)
      img.src = key
    })
  }

  // TODO: If it's an R2 key, fetch presigned URL and download
  return null
}
