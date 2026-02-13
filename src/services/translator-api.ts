import type { TranslatorConfig, BoundingBox } from '../types'

const DEFAULT_CONFIG: TranslatorConfig = {
  translator: { translator: 'none', target_lang: 'THA', no_text_lang_skip: true },
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
  formData.append('image', file)
  formData.append('config', JSON.stringify(config))

  const res = await fetch(`${getApiUrl()}/translate/with-form/json/stream`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error(`Translation request failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
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
          console.log('[translator-api] Raw JSON result:', JSON.stringify(parsed).slice(0, 500))
          console.log('[translator-api] translations count:', Array.isArray(parsed?.translations) ? parsed.translations.length : 'N/A')
          regions = parseRegions(parsed)
          console.log('[translator-api] Parsed regions:', regions.length, regions.slice(0, 2))
        } catch (e) {
          console.error('[translator-api] JSON parse error:', e, 'raw length:', text.length)
          onProgress?.({ status: 'error', message: `Failed to parse result: ${text.slice(0, 200)}` })
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
  formData.append('image', file)
  formData.append('config', JSON.stringify(config))

  const res = await fetch(`${getApiUrl()}/translate/with-form/image/stream`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error(`Image stream request failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
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

function concatBuffers(a: Uint8Array<ArrayBufferLike>, b: Uint8Array<ArrayBufferLike>): Uint8Array {
  const result = new Uint8Array(a.length + b.length)
  result.set(a, 0)
  result.set(b, a.length)
  return result
}

function parseRegions(data: unknown): OcrRegion[] {
  let items: Record<string, unknown>[]
  if (Array.isArray(data)) {
    items = data
  } else if (
    data &&
    typeof data === 'object' &&
    'translations' in (data as Record<string, unknown>) &&
    Array.isArray((data as Record<string, unknown>).translations)
  ) {
    items = (data as Record<string, unknown>).translations as Record<string, unknown>[]
  } else {
    return []
  }

  return items.map((item) => {
    const xyxy = item.xyxy as number[] | undefined
    const minX = item.minX as number | undefined
    const minY = item.minY as number | undefined
    const maxX = item.maxX as number | undefined
    const maxY = item.maxY as number | undefined

    let bbox: BoundingBox
    if (xyxy && xyxy.length === 4) {
      bbox = {
        x: xyxy[0],
        y: xyxy[1],
        width: xyxy[2] - xyxy[0],
        height: xyxy[3] - xyxy[1],
      }
    } else if (minX != null && minY != null && maxX != null && maxY != null) {
      bbox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      }
    } else {
      bbox = { x: 0, y: 0, width: 100, height: 30 }
    }

    let text = ''
    if (typeof item.text === 'string') {
      text = item.text
    } else if (item.text && typeof item.text === 'object') {
      const textDict = item.text as Record<string, string>
      const values = Object.values(textDict)
      text = values[0] ?? ''
    }

    const confidence = (item.prob as number) ?? 0
    return { bbox, text, confidence }
  })
}
