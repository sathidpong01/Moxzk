import type { BoundingBox, MoodType, TextRegion, TextBalloonShape } from '../types'
import { lookupMemory, saveMemory } from './translationMemory'
import { buildStoryContextBlock, type TranslationStoryContext } from './story-context'
import { detectSourceLanguageFromText, normalizeSourceLanguage } from './sourceLanguage'
import { runWithRequestTimeout } from './request-timeout'
import { normalizeTextBalloonShape } from '../utils/textLayout'
import { withLocalServiceUsage } from './localServiceUsage'

export interface OllamaOptions {
  ollamaUrl?: string
  ollamaModel?: string
  ollamaApiKey?: string
  signal?: AbortSignal
  timeoutMs?: number
  storyContext?: TranslationStoryContext
}

export interface OllamaStatus {
  ok: boolean
  url: string
  version?: string
  error?: string
}

export interface OllamaModelTag {
  name: string
  model?: string
  modified_at?: string
  size?: number
}

export interface OllamaPullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
}

export interface OllamaPullOptions extends OllamaOptions {
  model: string
  onProgress?: (progress: OllamaPullProgress) => void
}

interface OllamaChatResponse {
  message?: { content?: string }
  response?: string
  error?: string
}

interface OllamaTranslationItem {
  index: number
  original?: string
  translated?: string
  translatedText?: string
  mood?: string
  suggestedFont?: string
  balloonShape?: string
  bubbleShape?: string
  bbox?: Partial<BoundingBox>
  x?: number
  y?: number
  width?: number
  height?: number
  minX?: number
  minY?: number
  maxX?: number
  maxY?: number
  xyxy?: number[]
}

interface OllamaTranslationResponse {
  translations?: OllamaTranslationItem[]
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_OLLAMA_MODEL = 'gemma4'
const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']
const TEXT_DETECTION_SCOPE_RULES = `Default text scope:
- Prioritize speech balloons and narration boxes.
- Skip decorative SFX, tiny background effects, signs, watermarks, and incidental text outside balloons unless it is essential to the story.
- If a pre-detected region is only decorative effect text or too small to translate reliably, return that index with empty original and translated strings.`

export function normalizeOllamaBaseUrl(apiUrl?: string): string {
  const trimmed = (apiUrl || DEFAULT_OLLAMA_URL).trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_OLLAMA_URL
}

export function buildOllamaApiUrl(apiUrl: string | undefined, path: string): string {
  const base = normalizeOllamaBaseUrl(apiUrl)
  const apiPath = path.startsWith('/') ? path : `/${path}`

  if (base.endsWith('/api') && apiPath.startsWith('/api/')) {
    return `${base}${apiPath.slice('/api'.length)}`
  }

  return `${base}${apiPath}`
}

function isOllamaCloudUrl(apiUrl?: string): boolean {
  try {
    return new URL(normalizeOllamaBaseUrl(apiUrl)).hostname === 'ollama.com'
  } catch {
    return false
  }
}

function buildHeaders(options: OllamaOptions = {}): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = options.ollamaApiKey?.trim()
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Ollama returned invalid JSON: ${text.slice(0, 200)}`)
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

function getTranslationModeRules(context?: TranslationStoryContext): string {
  const mode = context?.translationMode === 'faithful' ? 'faithful' : 'concise'
  if (mode === 'faithful') {
    return `Translation mode: faithful
- Stay close to the source meaning, tone, implied subject, and order of ideas.
- Preserve nuance even if the Thai line becomes longer.
- You may shorten only filler that does not change information, speaker intent, relationship, or emotional tone.`
  }

  return `Translation mode: concise
- Make the Thai line short, clear, and speech-balloon friendly.
- Remove filler and redundant wording, but do not summarize away meaning.
- Never drop negation, questions, conditions, reasons, names, relationship terms, threats, promises, or emotional tone.
- Prefer compact natural Thai phrasing over literal source word order.`
}

export function buildThaiMangaRules(context?: TranslationStoryContext): string {
  const storyBlock = buildStoryContextBlock(context)
  return `Thai localization rules:
- Translate for Thai manga readers, but preserve the full meaning of every source line.
- Do not summarize away clauses, negations, questions, relationship words, names, or tone markers.
- Keep translations concise enough for a speech balloon only after preserving meaning.
- Do not hard-wrap translated text just to fit the balloon. Return each region as one editable string.
- Use \\n only for intentional line breaks, separate SFX strokes, or meaningfully separate beats.
- For Thai readability in narrow balloons, prefer concise phrases and natural clause spacing; never split Thai words unnaturally.
- Cover image context broadly: relationships, age, hierarchy, intimacy, uncertain gendered language, inner monologue, narration, jokes, sarcasm, recurring terms, and SFX.
- Preserve speaker relationship and pronouns consistently across pages.
- Avoid inventing or changing relationships. This applies to family roles, siblings, partners, friends, rivals, hierarchy, seniority, workplace roles, school roles, customer/staff roles, and strangers.
- When Thai requires a pronoun or address term, infer it from established context and image evidence. If uncertain, choose a neutral phrasing rather than forcing a wrong relationship.
- Use natural Thai dialogue. Prefer clear wording over literal word order.
- If the text is SFX, render the sound naturally in Thai.
${getTranslationModeRules(context)}
${storyBlock ? `\n${storyBlock}` : ''}`
}

function buildVisionPrompt(
  ocrTexts: string[],
  bboxes: BoundingBox[],
  sourceLang: string,
  context?: TranslationStoryContext,
): string {
  const langInstruction = sourceLang === 'auto'
    ? 'Detect the source language from OCR text automatically.'
    : `The source language is ${sourceLang}.`

  const regions = ocrTexts.map((text, i) => {
    const bbox = bboxes[i] ?? { x: 0, y: 0, width: 100, height: 30 }
    return `[${i}] "${text}" (x:${bbox.x}, y:${bbox.y}, w:${bbox.width}, h:${bbox.height})`
  })

  return `You are a professional manga translator and Thai localizer. Use the image context plus OCR regions to translate each region into natural Thai.

${langInstruction}
${buildThaiMangaRules(context)}
${TEXT_DETECTION_SCOPE_RULES}

OCR regions:
${regions.join('\n')}

Mood values:
- normal
- shouting
- whisper
- comedy
- narration
- sfx

Font values:
- normal
- normal_bold
- normal_italic
- shouting
- comedy
- comedy_bold
- whisper
- narration
- sfx
- cute

Return JSON only, with this exact shape:
{
  "translations": [
    {
      "index": 0,
      "original": "OCR text",
      "translated": "Thai translation",
      "mood": "normal",
      "suggestedFont": "normal",
      "balloonShape": "round"
    }
  ]
}

Rules:
- Preserve every input index.
- Choose mood from the allowed mood values only.
- Choose suggestedFont from the allowed font values only.
- Choose balloonShape from: round, cloud, box.
- Do not include markdown fences or explanations.`
}

function buildBoxedVisionPrompt(
  bboxes: BoundingBox[],
  sourceLang: string,
  imageSize?: { width: number; height: number },
  context?: TranslationStoryContext,
): string {
  const langInstruction = sourceLang === 'auto'
    ? 'Detect the source language from the manga page automatically.'
    : `The source language is ${sourceLang}.`
  const imageSizeInstruction = imageSize
    ? `The image size is ${imageSize.width}x${imageSize.height} pixels. The region coordinates are absolute pixels in that image.`
    : 'The region coordinates are absolute pixels in the original image.'

  const regions = bboxes.map((bbox, i) => (
    `[${i}] (x:${bbox.x}, y:${bbox.y}, w:${bbox.width}, h:${bbox.height})`
  ))

  return `You are a professional manga OCR and Thai localization engine.

${langInstruction}
${imageSizeInstruction}
${buildThaiMangaRules(context)}
${TEXT_DETECTION_SCOPE_RULES}

Read and translate only the text inside these pre-detected regions:
${regions.join('\n')}

Return JSON only, with this exact shape:
{
  "translations": [
    {
      "index": 0,
      "original": "source text",
      "translated": "Thai translation",
      "mood": "normal",
      "suggestedFont": "normal",
      "balloonShape": "round"
    }
  ]
}

Rules:
- Preserve every input index exactly.
- Do not create new regions and do not change coordinates.
- If a region contains no readable text, return that index with empty original and translated strings.
- mood must be one of: normal, shouting, whisper, comedy, narration, sfx.
- suggestedFont must be one of: normal, normal_bold, normal_italic, shouting, comedy, comedy_bold, whisper, narration, sfx, cute.
- balloonShape must be one of: round, cloud, box.
- Output JSON only.`
}

function buildVisionOnlyPrompt(
  sourceLang: string,
  imageSize?: { width: number; height: number },
  context?: TranslationStoryContext,
): string {
  const langInstruction = sourceLang === 'auto'
    ? 'Detect the source language from the manga page automatically.'
    : `The source language is ${sourceLang}.`
  const sizeInstruction = imageSize
    ? `The image size is ${imageSize.width}x${imageSize.height} pixels. Return absolute pixel coordinates in that coordinate space.`
    : 'Return absolute pixel coordinates for each detected text region.'

  return `You are a professional manga OCR and Thai localization engine.

${langInstruction}
${sizeInstruction}
${buildThaiMangaRules(context)}
${TEXT_DETECTION_SCOPE_RULES}

Detect every visible manga text region in the image, translate each region into natural Thai, and choose mood/font metadata.

Return JSON only, with this exact shape:
{
  "translations": [
    {
      "index": 0,
      "bbox": { "x": 10, "y": 20, "width": 100, "height": 50 },
      "original": "source text",
      "translated": "Thai translation",
      "mood": "normal",
      "suggestedFont": "normal",
      "balloonShape": "round"
    }
  ]
}

Rules:
- Use absolute pixel coordinates.
- Include speech bubbles and narration boxes. Skip small decorative SFX/effects by default.
- Return one item per speech balloon or narration box. Do not split one balloon into separate lines.
- Order items top-to-bottom, then left-to-right within the same row.
- If text is unreadable, omit that region instead of guessing.
- Keep source transcription as complete as possible. Do not omit words just because they wrap across lines.
- mood must be one of: normal, shouting, whisper, comedy, narration, sfx.
- suggestedFont must be one of: normal, normal_bold, normal_italic, shouting, comedy, comedy_bold, whisper, narration, sfx, cute.
- balloonShape must be one of: round, cloud, box.
- Output JSON only.`
}

function buildTextPrompt(text: string, sourceLang: string, context?: TranslationStoryContext): string {
  const langLabel: Record<string, string> = {
    ja: 'Japanese',
    zh: 'Chinese',
    en: 'English',
    auto: 'the source language',
  }

  return `Translate the following ${langLabel[sourceLang] ?? 'source'} manga text to Thai. Be natural, not literal, but do not drop meaning. Output only the translated Thai text.

${buildThaiMangaRules(context)}

Text:
${text}`
}

function calcAutoFontSize(text: string, bbox: BoundingBox): number {
  const { width, height } = bbox
  if (width <= 0 || height <= 0) return 14

  const textLen = Math.max(text.length, 1)
  const charW = 0.58
  const lineH = 1.22
  let fs = Math.min(36, width / 3.2, height * 0.5)

  while (fs > 10) {
    const charsPerLine = Math.max(1, Math.floor(width / (fs * charW)))
    const lines = Math.ceil(textLen / charsPerLine)
    if (lines * fs * lineH <= height * 0.92) break
    fs -= 1
  }

  return Math.round(Math.max(10, Math.min(fs, 60)))
}

function parseMood(mood?: string): MoodType {
  return MOODS.includes(mood as MoodType) ? (mood as MoodType) : 'normal'
}

function inferBalloonShape(
  rawShape: string | undefined,
  mood: MoodType,
  bbox: BoundingBox,
): TextBalloonShape {
  const explicit = normalizeTextBalloonShape(rawShape, mood)
  if (rawShape === 'round' || rawShape === 'cloud' || rawShape === 'box' || rawShape === 'bubble') {
    return explicit
  }
  if (mood === 'narration') return 'box'
  if (bbox.width / Math.max(1, bbox.height) < 1.12 && bbox.height >= 84) return 'cloud'
  return explicit
}

function stripJsonFences(raw: string): string {
  return raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
}

export function parseOllamaTranslationJson(raw: string): OllamaTranslationResponse {
  const cleaned = stripJsonFences(raw)
  try {
    const parsed = JSON.parse(cleaned) as OllamaTranslationResponse | OllamaTranslationItem[]
    return Array.isArray(parsed) ? { translations: parsed } : parsed
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error(`Ollama response did not contain JSON: ${cleaned.slice(0, 200)}`)
    }
    const sanitized = match[0]
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/[\x00-\x1F\x7F]/g, ' ')
    try {
      return JSON.parse(sanitized) as OllamaTranslationResponse
    } catch (err) {
      throw new Error(`Could not parse Ollama translation JSON: ${(err as Error).message}`)
    }
  }
}

function toTextRegions(
  parsed: OllamaTranslationResponse,
  ocrTexts: string[],
  bboxes: BoundingBox[],
): TextRegion[] {
  if (!Array.isArray(parsed.translations)) {
    throw new Error('Ollama response JSON is missing translations[]')
  }

  return parsed.translations.map((item, fallbackIndex) => {
    const index = Number.isInteger(item.index) ? item.index : fallbackIndex
    const bbox = bboxes[index] ?? { x: 0, y: 0, width: 100, height: 30 }
    const original = item.original || ocrTexts[index] || ''
    const translated = item.translated || item.translatedText || original
    const mood = parseMood(item.mood)
    const balloonShape = inferBalloonShape(item.balloonShape || item.bubbleShape, mood, bbox)

    return {
      id: `region-${index}`,
      bbox,
      originalText: original,
      translatedText: translated,
      mood,
      suggestedFont: item.suggestedFont || mood,
      fontSize: calcAutoFontSize(translated, bbox),
      fontColor: '#000000',
      rotation: 0,
      strokeWidth: 0,
      strokeColor: '#ffffff',
      textLayoutMode: 'balloon_fit',
      balloonShape,
      artisticFit: 'free',
      textAlign: 'center',
      textScaleX: 1,
      textScaleY: 1,
    }
  })
}

function readImageSize(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    const done = (size?: { width: number; height: number }) => {
      URL.revokeObjectURL(url)
      resolve(size)
    }
    image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => done(undefined)
    image.src = url
  })
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoundingBox(item: OllamaTranslationItem): BoundingBox | null {
  const raw = item.bbox ?? {}
  const x = toNumber(raw.x ?? item.x ?? item.minX)
  const y = toNumber(raw.y ?? item.y ?? item.minY)
  const width = toNumber(raw.width ?? item.width)
  const height = toNumber(raw.height ?? item.height)

  if (x != null && y != null && width != null && height != null) {
    return normalizeBoundingBox({ x, y, width, height })
  }

  const minX = toNumber(raw.x ?? item.minX ?? item.xyxy?.[0])
  const minY = toNumber(raw.y ?? item.minY ?? item.xyxy?.[1])
  const maxX = toNumber(item.maxX ?? item.xyxy?.[2])
  const maxY = toNumber(item.maxY ?? item.xyxy?.[3])
  if (minX != null && minY != null && maxX != null && maxY != null) {
    return normalizeBoundingBox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
  }

  return null
}

function normalizeBoundingBox(bbox: BoundingBox): BoundingBox {
  const width = Math.max(1, Math.round(Math.abs(bbox.width)))
  const height = Math.max(1, Math.round(Math.abs(bbox.height)))
  const x = Math.round(bbox.width < 0 ? bbox.x + bbox.width : bbox.x)
  const y = Math.round(bbox.height < 0 ? bbox.y + bbox.height : bbox.y)
  return { x, y, width, height }
}

function toVisionTextRegions(parsed: OllamaTranslationResponse, translate: boolean): TextRegion[] {
  if (!Array.isArray(parsed.translations)) {
    throw new Error('Ollama response JSON is missing translations[]')
  }

  return parsed.translations.flatMap((item, fallbackIndex) => {
    const bbox = parseBoundingBox(item)
    const original = item.original?.trim() ?? ''
    if (!bbox || !original) return []

    const index = Number.isInteger(item.index) ? item.index : fallbackIndex
    const translated = translate
      ? (item.translated || item.translatedText || original)
      : ''
    const mood = parseMood(item.mood)
    const balloonShape = inferBalloonShape(item.balloonShape || item.bubbleShape, mood, bbox)

    return [{
      id: `region-${index}`,
      bbox,
      originalText: original,
      translatedText: translated,
      mood,
      suggestedFont: item.suggestedFont || mood,
      fontSize: calcAutoFontSize(translated || original, bbox),
      fontColor: '#000000',
      rotation: 0,
      strokeWidth: 0,
      strokeColor: '#ffffff',
      textLayoutMode: 'balloon_fit',
      balloonShape,
      artisticFit: 'free',
      textAlign: 'center',
      textScaleX: 1,
      textScaleY: 1,
    }]
  })
}

async function postOllamaChat(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; images?: string[] }>,
  options: OllamaOptions = {},
  format?: 'json',
): Promise<string> {
  const model = options.ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL
  const res = await withLocalServiceUsage(
    'ollama',
    () => runWithRequestTimeout(
      { label: 'Ollama', signal: options.signal, timeoutMs: options.timeoutMs },
      (signal) => fetch(buildOllamaApiUrl(options.ollamaUrl, '/api/chat'), {
        method: 'POST',
        headers: buildHeaders(options),
        signal,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...(format ? { format } : {}),
        }),
      }),
    ),
  )

  const data = await parseJsonResponse<OllamaChatResponse>(res)
  const content = data.message?.content ?? data.response ?? ''
  if (data.error) throw new Error(data.error)
  if (!content.trim()) throw new Error('Ollama returned an empty response')
  return content.trim()
}

function parseDetectedLanguageResponse(content: string): 'ja' | 'zh' | 'en' | 'auto' {
  const normalized = normalizeSourceLanguage(content)
  if (normalized !== 'auto') return normalized

  const tokenMatch = content.toLowerCase().match(/\b(ja|zh|en|auto)\b/)
  return normalizeSourceLanguage(tokenMatch?.[1])
}

export class OllamaClient {
  detectSourceLanguageFromImage(
    imageFile: File,
    options: OllamaOptions = {},
  ): Promise<'ja' | 'zh' | 'en' | 'auto'> {
    return detectSourceLanguageFromImage(imageFile, options)
  }

  translateImage(
    imageFile: File,
    ocrTexts: string[],
    bboxes: BoundingBox[],
    sourceLang: string = 'auto',
    options: OllamaOptions = {},
  ): Promise<TextRegion[]> {
    return translateWithOllamaImage(imageFile, ocrTexts, bboxes, sourceLang, options)
  }

  translateBoxedVision(
    imageFile: File,
    bboxes: BoundingBox[],
    sourceLang: string = 'auto',
    options: OllamaOptions = {},
  ): Promise<TextRegion[]> {
    return translateWithOllamaBoxedVision(imageFile, bboxes, sourceLang, options)
  }

  translateVision(
    imageFile: File,
    sourceLang: string = 'auto',
    options: OllamaOptions = {},
  ): Promise<TextRegion[]> {
    return translateWithOllamaVision(imageFile, sourceLang, options)
  }

  translateText(
    text: string,
    sourceLang: string,
    options: OllamaOptions = {},
  ): Promise<string> {
    return translateWithOllamaText(text, sourceLang, options)
  }

  translateSingleRegion(
    text: string,
    sourceLang: string,
    options: OllamaOptions = {},
  ): Promise<string> {
    return translateSingleRegion(text, sourceLang, options)
  }

  getStatus(options: OllamaOptions = {}): Promise<OllamaStatus> {
    return getOllamaStatus(options)
  }

  listModels(options: OllamaOptions = {}): Promise<OllamaModelTag[]> {
    return listOllamaModels(options)
  }

  pullModel(options: OllamaPullOptions): Promise<OllamaPullProgress> {
    return pullOllamaModel(options)
  }
}

export const defaultOllamaClient = new OllamaClient()

export async function detectSourceLanguageFromImage(
  imageFile: File,
  options: OllamaOptions = {},
): Promise<'ja' | 'zh' | 'en' | 'auto'> {
  const base64 = await fileToBase64(imageFile)
  const content = await postOllamaChat(
    [{
      role: 'user',
      content: `Identify the primary source language used in this manga page.

Reply with exactly one lowercase code:
- ja for Japanese
- zh for Chinese
- en for English
- auto if mixed, unclear, or unreadable

Do not add explanations or punctuation.`,
      images: [base64],
    }],
    options,
  )

  return parseDetectedLanguageResponse(content)
}

export async function translateWithOllamaImage(
  imageFile: File,
  ocrTexts: string[],
  bboxes: BoundingBox[],
  sourceLang: string = 'auto',
  options: OllamaOptions = {},
): Promise<TextRegion[]> {
  if (ocrTexts.length === 0) return []

  const base64 = await fileToBase64(imageFile)
  const prompt = buildVisionPrompt(ocrTexts, bboxes, sourceLang, options.storyContext)
  const content = await postOllamaChat(
    [{ role: 'user', content: prompt, images: [base64] }],
    options,
    'json',
  )
  const parsed = parseOllamaTranslationJson(content)
  const regions = toTextRegions(parsed, ocrTexts, bboxes)

  await Promise.allSettled(
    regions
      .filter((region) => region.originalText && region.translatedText)
      .map((region) => saveMemory(region.originalText, sourceLang, region.translatedText)),
  )

  return regions
}

export async function translateWithOllamaBoxedVision(
  imageFile: File,
  bboxes: BoundingBox[],
  sourceLang: string = 'auto',
  options: OllamaOptions = {},
): Promise<TextRegion[]> {
  if (bboxes.length === 0) return []

  const [base64, imageSize] = await Promise.all([
    fileToBase64(imageFile),
    readImageSize(imageFile),
  ])
  const content = await postOllamaChat(
    [{ role: 'user', content: buildBoxedVisionPrompt(bboxes, sourceLang, imageSize, options.storyContext), images: [base64] }],
    options,
    'json',
  )
  const parsed = parseOllamaTranslationJson(content)
  const regions = toTextRegions(parsed, bboxes.map(() => ''), bboxes)
    .filter((region) => region.originalText.trim() || region.translatedText.trim())

  await Promise.allSettled(
    regions
      .filter((region) => region.originalText && region.translatedText)
      .map((region) => saveMemory(region.originalText, sourceLang, region.translatedText)),
  )

  return regions
}

export async function translateWithOllamaVision(
  imageFile: File,
  sourceLang: string = 'auto',
  options: OllamaOptions = {},
): Promise<TextRegion[]> {
  const [base64, imageSize] = await Promise.all([
    fileToBase64(imageFile),
    readImageSize(imageFile),
  ])
  const content = await postOllamaChat(
    [{ role: 'user', content: buildVisionOnlyPrompt(sourceLang, imageSize, options.storyContext), images: [base64] }],
    options,
    'json',
  )
  const parsed = parseOllamaTranslationJson(content)
  const regions = toVisionTextRegions(parsed, true)

  await Promise.allSettled(
    regions
      .filter((region) => region.originalText && region.translatedText)
      .map((region) => saveMemory(region.originalText, sourceLang, region.translatedText)),
  )

  return regions
}

export async function translateWithOllamaText(
  text: string,
  sourceLang: string,
  options: OllamaOptions = {},
): Promise<string> {
  return postOllamaChat([{ role: 'user', content: buildTextPrompt(text, sourceLang, options.storyContext) }], options)
}

export async function translateSingleRegion(
  text: string,
  sourceLang: string,
  options: OllamaOptions = {},
): Promise<string> {
  const detected = sourceLang === 'auto' ? detectSourceLanguageFromText(text) : null
  const resolvedSourceLang = sourceLang === 'auto'
    ? (detected?.language ?? 'auto')
    : sourceLang

  const cached = await lookupMemory(text, resolvedSourceLang)
  if (cached) return cached

  const result = await translateWithOllamaText(text, resolvedSourceLang, options)
  await saveMemory(text, resolvedSourceLang, result).catch(() => {})
  return result
}

export async function getOllamaStatus(options: OllamaOptions = {}): Promise<OllamaStatus> {
  const url = normalizeOllamaBaseUrl(options.ollamaUrl)

  if (isOllamaCloudUrl(url) && !options.ollamaApiKey?.trim()) {
    return { ok: false, url, error: 'Ollama Cloud ต้องใช้ API key' }
  }

  try {
    const res = await withLocalServiceUsage('ollama', () =>
      runWithRequestTimeout(
        { label: 'Ollama', signal: options.signal, timeoutMs: options.timeoutMs },
        (signal) => fetch(buildOllamaApiUrl(url, '/api/version'), {
          headers: buildHeaders(options),
          signal,
        }),
      ),
    )
    const data = await parseJsonResponse<{ version?: string }>(res)
    return { ok: true, url, version: data.version || (isOllamaCloudUrl(url) ? 'cloud' : undefined) }
  } catch (err) {
    return { ok: false, url, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function listOllamaModels(options: OllamaOptions = {}): Promise<OllamaModelTag[]> {
  const url = normalizeOllamaBaseUrl(options.ollamaUrl)
  if (isOllamaCloudUrl(url) && !options.ollamaApiKey?.trim()) {
    throw new Error('Ollama Cloud ต้องใช้ API key')
  }

  const res = await withLocalServiceUsage('ollama', () =>
    runWithRequestTimeout(
      { label: 'Ollama', signal: options.signal, timeoutMs: options.timeoutMs },
      (signal) => fetch(buildOllamaApiUrl(url, '/api/tags'), {
        headers: buildHeaders(options),
        signal,
      }),
    ),
  )
  const data = await parseJsonResponse<{ models?: OllamaModelTag[] }>(res)
  return Array.isArray(data.models) ? data.models : []
}

export async function pullOllamaModel(options: OllamaPullOptions): Promise<OllamaPullProgress> {
  const model = options.model.trim()
  if (!model) throw new Error('กรุณาระบุชื่อโมเดล Ollama')

  const url = normalizeOllamaBaseUrl(options.ollamaUrl)
  if (isOllamaCloudUrl(url)) {
    throw new Error('การติดตั้งโมเดลในเครื่องรองรับเฉพาะ Local Ollama endpoint')
  }

  const res = await withLocalServiceUsage('ollama', () =>
    runWithRequestTimeout(
      { label: 'Ollama', signal: options.signal, timeoutMs: options.timeoutMs },
      (signal) => fetch(buildOllamaApiUrl(url, '/api/pull'), {
        method: 'POST',
        headers: buildHeaders(options),
        signal,
        body: JSON.stringify({ model, stream: true }),
      }),
    ),
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`)
  }

  if (!res.body) {
    const data = await parseJsonResponse<OllamaPullProgress>(res)
    options.onProgress?.(data)
    return data
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latest: OllamaPullProgress = { status: 'starting' }

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const event = JSON.parse(trimmed) as OllamaPullProgress & { error?: string }
    if (event.error) throw new Error(event.error)
    latest = {
      status: event.status || latest.status,
      ...(event.digest ? { digest: event.digest } : {}),
      ...(typeof event.total === 'number' ? { total: event.total } : {}),
      ...(typeof event.completed === 'number' ? { completed: event.completed } : {}),
    }
    options.onProgress?.(latest)
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) consumeLine(line)
    if (done) break
  }

  consumeLine(buffer)
  return latest
}
