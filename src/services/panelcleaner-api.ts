import type { BoundingBox } from '../types'
import type { OcrRegion, StreamProgress, TranslatorResponse } from './translator-api'
import { runWithRequestTimeout } from './request-timeout'
import { withLocalServiceUsage } from './localServiceUsage'

export interface PanelCleanerOptions {
  bridgeUrl?: string
  executablePath?: string
  runOcr?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

interface PanelCleanerBridgeResponse {
  cleanedImageBase64?: string
  cleanedImageMimeType?: string
  ocrCsv?: string
  logs?: string[]
  error?: string
  command?: string
  source?: PanelCleanerStatus['source']
}

interface PanelCleanerBatchBridgeResponse {
  results?: PanelCleanerBatchItemResponse[]
  error?: string
}

interface PanelCleanerBatchItemResponse {
  id: string
  cleanedImageBase64?: string
  cleanedImageMimeType?: string
  error?: string
  logs?: string[]
}

export interface PanelCleanerBatchInput {
  id: string
  file: File
}

export interface PanelCleanerBatchResult {
  id: string
  cleanedImageBlob?: Blob
  error?: string
  logs?: string[]
}

export interface PanelCleanerStatus {
  ok: boolean
  version?: string
  command?: string
  source?: 'explicit' | 'managed' | 'dev' | 'path'
  error?: string
  installHint?: string
}

const DEFAULT_PANELCLEANER_BRIDGE_URL = 'http://localhost:5055'

export function getPanelCleanerBridgeUrl(url?: string): string {
  return (url || import.meta.env.VITE_PANELCLEANER_BRIDGE_URL || DEFAULT_PANELCLEANER_BRIDGE_URL)
    .trim()
    .replace(/\/+$/, '')
}

export class PanelCleanerClient {
  processImage(
    file: File,
    options: PanelCleanerOptions = {},
    onProgress?: (progress: StreamProgress) => void,
  ): Promise<TranslatorResponse> {
    return processImageWithPanelCleaner(file, options, onProgress)
  }

  processBatch(
    images: PanelCleanerBatchInput[],
    options: PanelCleanerOptions = {},
    onProgress?: (progress: StreamProgress) => void,
  ): Promise<PanelCleanerBatchResult[]> {
    return processImagesWithPanelCleanerBatch(images, options, onProgress)
  }

  getStatus(options: PanelCleanerOptions = {}): Promise<PanelCleanerStatus> {
    return getPanelCleanerStatus(options)
  }
}

export const defaultPanelCleanerClient = new PanelCleanerClient()

export async function processImageWithPanelCleaner(
  file: File,
  options: PanelCleanerOptions = {},
  onProgress?: (progress: StreamProgress) => void,
): Promise<TranslatorResponse> {
  onProgress?.({ status: 'progress', message: 'กำลังเตรียมรูปสำหรับลบข้อความ' })

  const res = await withLocalServiceUsage('panelcleaner', () =>
    runWithRequestTimeout(
      { label: 'PanelCleaner', signal: options.signal, timeoutMs: options.timeoutMs },
      async (signal) => fetch(`${getPanelCleanerBridgeUrl(options.bridgeUrl)}/panelcleaner/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: {
            name: file.name,
            mimeType: file.type || 'image/png',
            base64: await fileToBase64(file),
          },
          executablePath: options.executablePath || undefined,
          runOcr: options.runOcr ?? false,
        }),
        signal,
      }),
    ),
  )

  const data = await readBridgeResponse(res)
  data.logs?.forEach((message) => onProgress?.({ status: 'progress', message: `PanelCleaner: ${message}` }))

  if (!data.cleanedImageBase64) {
    throw new Error('PanelCleaner ไม่ได้ส่งรูปที่ลบข้อความแล้วกลับมา')
  }

  const cleanedImageBlob = base64ToBlob(data.cleanedImageBase64, data.cleanedImageMimeType || 'image/png')
  const regions = data.ocrCsv ? parsePanelCleanerOcrCsv(data.ocrCsv) : []

  onProgress?.({ status: 'progress', message: `ลบข้อความเสร็จ${regions.length ? ` พบข้อความ ${regions.length} จุด` : ''}` })
  return { cleanedImageBlob, regions }
}

export async function processImagesWithPanelCleanerBatch(
  images: PanelCleanerBatchInput[],
  options: PanelCleanerOptions = {},
  onProgress?: (progress: StreamProgress) => void,
): Promise<PanelCleanerBatchResult[]> {
  if (images.length === 0) return []
  onProgress?.({ status: 'progress', message: `กำลังเตรียมรูป ${images.length} หน้าเพื่อลบข้อความ` })

  const res = await withLocalServiceUsage('panelcleaner', () =>
    runWithRequestTimeout(
      { label: 'PanelCleaner', signal: options.signal, timeoutMs: options.timeoutMs },
      async (signal) => fetch(`${getPanelCleanerBridgeUrl(options.bridgeUrl)}/panelcleaner/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: await Promise.all(images.map(async (item) => ({
            id: item.id,
            image: {
              name: item.file.name,
              mimeType: item.file.type || 'image/png',
              base64: await fileToBase64(item.file),
            },
          }))),
          executablePath: options.executablePath || undefined,
        }),
        signal,
      }),
    ),
  )

  const data = await readBridgeBatchResponse(res)
  const results = data.results ?? []
  onProgress?.({ status: 'progress', message: `PanelCleaner: batch finished ${results.length} images` })

  return results.map((item) => ({
    id: item.id,
    cleanedImageBlob: item.cleanedImageBase64
      ? base64ToBlob(item.cleanedImageBase64, item.cleanedImageMimeType || 'image/png')
      : undefined,
    error: item.error,
    logs: item.logs,
  }))
}

export async function getPanelCleanerStatus(options: PanelCleanerOptions = {}): Promise<PanelCleanerStatus> {
  try {
    const res = await withLocalServiceUsage('panelcleaner', () =>
      runWithRequestTimeout(
        { label: 'PanelCleaner', signal: options.signal, timeoutMs: options.timeoutMs },
        (signal) => fetch(`${getPanelCleanerBridgeUrl(options.bridgeUrl)}/panelcleaner/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ executablePath: options.executablePath || undefined }),
          signal,
        }),
      ),
    )
    const data = await readBridgeJson(res)
    if (!res.ok) return { ok: false, error: data.error, installHint: data.installHint }
    return {
      ok: true,
      version: data.version,
      command: data.command,
      ...(data.source ? { source: data.source } : {}),
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      installHint: 'กดเริ่ม PanelCleaner ก่อน ถ้ายังไม่พบชุดใช้งานให้กดติดตั้ง PanelCleaner',
    }
  }
}

export function parsePanelCleanerOcrCsv(csv: string): OcrRegion[] {
  const rows = parseCsvRows(csv)
  if (rows.length <= 1) return []

  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const indexOf = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1
  const startXIndex = indexOf('startx', 'minx', 'x')
  const startYIndex = indexOf('starty', 'miny', 'y')
  const endXIndex = indexOf('endx', 'maxx')
  const endYIndex = indexOf('endy', 'maxy')
  const widthIndex = indexOf('width', 'w')
  const heightIndex = indexOf('height', 'h')
  const textIndex = indexOf('text', 'ocr', 'content')

  return rows.slice(1).flatMap((row) => {
    const text = textIndex >= 0 ? (row[textIndex] ?? '').trim() : ''
    if (!text) return []

    const x = parseNumber(row[startXIndex])
    const y = parseNumber(row[startYIndex])
    if (x == null || y == null) return []

    const endX = parseNumber(row[endXIndex])
    const endY = parseNumber(row[endYIndex])
    const width = parseNumber(row[widthIndex]) ?? (endX != null ? endX - x : 100)
    const height = parseNumber(row[heightIndex]) ?? (endY != null ? endY - y : 30)
    const bbox: BoundingBox = {
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
    }

    return [{ bbox, text, confidence: 0 }]
  })
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const next = csv[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      field += '"'
      i++
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

async function readBridgeResponse(res: Response): Promise<PanelCleanerBridgeResponse & { version?: string; installHint?: string }> {
  const data = await readBridgeJson(res)
  if (!res.ok && data.error) throw new Error(data.error)
  if (!res.ok) throw new Error(`PanelCleaner ทำงานไม่สำเร็จ (${res.status})`)
  return data
}

async function readBridgeBatchResponse(res: Response): Promise<PanelCleanerBatchBridgeResponse> {
  const data = await readBridgeJson(res) as PanelCleanerBatchBridgeResponse
  if (!res.ok && data.error) throw new Error(data.error)
  if (!res.ok) throw new Error(`PanelCleaner ทำงานไม่สำเร็จ (${res.status})`)
  return data
}

async function readBridgeJson(res: Response): Promise<PanelCleanerBridgeResponse & { version?: string; installHint?: string }> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`PanelCleaner ส่งข้อมูลกลับมาไม่ถูกต้อง: ${text.slice(0, 200)}`)
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Could not read image as base64'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

function parseNumber(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
