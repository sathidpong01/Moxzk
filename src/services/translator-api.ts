import type { TranslatorConfig, BoundingBox } from '../types'

const DEFAULT_CONFIG: TranslatorConfig = {
  translator: { translator: 'none' },
  detector: { detector: 'ctd', detection_size: 2048 },
  inpainter: { inpainter: 'lama_large', inpainting_size: 2048 },
  ocr: { ocr: '48px' },
}

export interface OcrRegion {
  bbox: BoundingBox
  text: string
  confidence: number
}

export interface TranslatorResponse {
  regions: OcrRegion[]
  cleanedImageBlob: Blob | null
}

export interface StreamProgress {
  status: 'progress' | 'queue' | 'waiting' | 'result' | 'error'
  message: string
  data?: unknown
}

const STATUS_CODES: Record<number, StreamProgress['status']> = {
  0: 'result',
  1: 'progress',
  2: 'error',
  3: 'queue',
  4: 'waiting',
}

function getApiUrl(): string {
  return import.meta.env.VITE_TRANSLATOR_API_URL ?? 'http://localhost:5003'
}

export async function getQueueSize(): Promise<number> {
  const res = await fetch(`${getApiUrl()}/queue-size`)
  if (!res.ok) throw new Error(`Queue size request failed: ${res.status}`)
  const data = await res.json()
  return data.size ?? 0
}

export async function translateImageJson(
  file: File,
  config: TranslatorConfig = DEFAULT_CONFIG,
  onProgress?: (progress: StreamProgress) => void,
): Promise<OcrRegion[]> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('config', JSON.stringify(config))

  const res = await fetch(`${getApiUrl()}/translate/with-form/json/stream`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error(`Translation request failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  let buffer = new Uint8Array(0)
  let regions: OcrRegion[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer = concatBuffers(buffer, value)

    while (buffer.length >= 5) {
      const statusCode = buffer[0]
      const dataSize = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(1, false)

      if (buffer.length < 5 + dataSize) break

      const data = buffer.slice(5, 5 + dataSize)
      buffer = buffer.slice(5 + dataSize)

      const status = STATUS_CODES[statusCode] ?? 'error'
      const text = new TextDecoder().decode(data)

      if (status === 'result') {
        try {
          const parsed = JSON.parse(text)
          regions = parseRegions(parsed)
        } catch {
          onProgress?.({ status: 'error', message: `Failed to parse result: ${text}` })
        }
      } else if (status === 'error') {
        throw new Error(`Translation error: ${text}`)
      } else {
        onProgress?.({ status, message: text })
      }
    }
  }

  return regions
}

export async function translateImageStream(
  file: File,
  config: TranslatorConfig = DEFAULT_CONFIG,
  onProgress?: (progress: StreamProgress) => void,
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('config', JSON.stringify(config))

  const res = await fetch(`${getApiUrl()}/translate/with-form/image/stream`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error(`Image stream request failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  let buffer = new Uint8Array(0)
  let imageBlob: Blob | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer = concatBuffers(buffer, value)

    while (buffer.length >= 5) {
      const statusCode = buffer[0]
      const dataSize = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(1, false)

      if (buffer.length < 5 + dataSize) break

      const data = buffer.slice(5, 5 + dataSize)
      buffer = buffer.slice(5 + dataSize)

      const status = STATUS_CODES[statusCode] ?? 'error'

      if (status === 'result') {
        imageBlob = new Blob([data], { type: 'image/png' })
      } else if (status === 'error') {
        const text = new TextDecoder().decode(data)
        throw new Error(`Image stream error: ${text}`)
      } else {
        const text = new TextDecoder().decode(data)
        onProgress?.({ status, message: text })
      }
    }
  }

  if (!imageBlob) throw new Error('No image data received')
  return imageBlob
}

export async function processImage(
  file: File,
  config: TranslatorConfig = DEFAULT_CONFIG,
  onProgress?: (progress: StreamProgress) => void,
): Promise<TranslatorResponse> {
  const [regions, cleanedImageBlob] = await Promise.all([
    translateImageJson(file, config, onProgress),
    translateImageStream(file, config, onProgress),
  ])

  return { regions, cleanedImageBlob }
}

function concatBuffers(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length)
  result.set(a, 0)
  result.set(b, a.length)
  return result
}

function parseRegions(data: unknown): OcrRegion[] {
  if (!Array.isArray(data)) return []

  return data.map((item: Record<string, unknown>, index: number) => {
    const xyxy = item.xyxy as number[] | undefined
    const text = (item.text as string) ?? ''
    const confidence = (item.prob as number) ?? 0

    let bbox: BoundingBox
    if (xyxy && xyxy.length === 4) {
      bbox = {
        x: xyxy[0],
        y: xyxy[1],
        width: xyxy[2] - xyxy[0],
        height: xyxy[3] - xyxy[1],
      }
    } else {
      bbox = { x: 0, y: 0, width: 100, height: 30 }
    }

    return { bbox, text, confidence, id: `region-${index}` } as OcrRegion & { id: string }
  })
}
