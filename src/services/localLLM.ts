/**
 * Local LLM translation services: LibreTranslate + Ollama
 * Used as alternatives to Gemini API for translation.
 */

import type { TextRegion, BoundingBox, MoodType } from '../types'
import { lookupMemory, saveMemory } from './translationMemory'

// ── LibreTranslate ──────────────────────────────────────────────────

interface LibreTranslateResponse {
  translatedText: string
}

export async function translateWithLibreTranslate(
  text: string,
  sourceLang: string,
  targetLang: string = 'th',
  apiUrl: string = 'http://localhost:5004',
): Promise<string> {
  const langMap: Record<string, string> = {
    ja: 'ja', zh: 'zh', en: 'en', auto: 'auto', th: 'th',
  }

  const res = await fetch(`${apiUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: langMap[sourceLang] ?? 'auto',
      target: langMap[targetLang] ?? 'th',
      format: 'text',
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LibreTranslate error ${res.status}: ${errText}`)
  }

  const data: LibreTranslateResponse = await res.json()
  return data.translatedText
}

// ── Ollama ──────────────────────────────────────────────────────────

interface OllamaChatResponse {
  message: { content: string }
}

export async function translateWithOllama(
  text: string,
  sourceLang: string,
  model: string = 'typhoon2:8b',
  apiUrl: string = 'http://localhost:11434',
): Promise<string> {
  const langLabel: Record<string, string> = {
    ja: 'Japanese', zh: 'Chinese', en: 'English', auto: 'the source language',
  }

  const prompt = `You are a professional manga translator. Translate the following ${langLabel[sourceLang] ?? 'source'} text to Thai. Output ONLY the translated text, nothing else.\n\nText: ${text}`

  const res = await fetch(`${apiUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${errText}`)
  }

  const data: OllamaChatResponse = await res.json()
  return data.message.content.trim()
}

// ── Batch translate using local LLM ─────────────────────────────────

export async function translateRegionsWithLocalLLM(
  ocrTexts: string[],
  bboxes: BoundingBox[],
  sourceLang: string,
  engine: 'libretranslate' | 'ollama',
  options: {
    libreTranslateUrl?: string
    ollamaUrl?: string
    ollamaModel?: string
  } = {},
): Promise<TextRegion[]> {
  const results: TextRegion[] = []

  for (let i = 0; i < ocrTexts.length; i++) {
    const text = ocrTexts[i]
    const bbox = bboxes[i] ?? { x: 0, y: 0, width: 100, height: 30 }

    let translated: string
    try {
      if (engine === 'libretranslate') {
        translated = await translateWithLibreTranslate(
          text, sourceLang, 'th', options.libreTranslateUrl,
        )
      } else {
        translated = await translateWithOllama(
          text, sourceLang, options.ollamaModel, options.ollamaUrl,
        )
      }
    } catch (err) {
      console.warn(`[localLLM] Failed to translate region ${i}:`, err)
      translated = text
    }

    const mood: MoodType = 'normal'
    const fontSize = calcAutoFontSize(translated, bbox)

    results.push({
      id: `region-${i}`,
      bbox,
      originalText: text,
      translatedText: translated,
      mood,
      suggestedFont: 'normal',
      fontSize,
      fontColor: '#000000',
      rotation: 0,
      strokeWidth: 0,
      strokeColor: '#ffffff',
    })
  }

  return results
}

function calcAutoFontSize(text: string, bbox: BoundingBox): number {
  const { width, height } = bbox
  if (width <= 0 || height <= 0) return 14
  const textLen = Math.max(text.length, 1)
  const charW = 0.55
  const lineH = 1.3
  const area = width * height
  let fs = Math.sqrt(area / (textLen * charW * lineH))
  fs = Math.min(fs, width / 2)
  fs = Math.min(fs, height * 0.85)
  fs = Math.max(10, Math.min(fs, 60))
  return Math.round(fs)
}

// ── Single region translate (for per-box translate button) ──────────

export async function translateSingleRegion(
  text: string,
  sourceLang: string,
  engine: 'gemini' | 'libretranslate' | 'ollama',
  options: {
    apiKey?: string
    modelId?: string
    libreTranslateUrl?: string
    ollamaUrl?: string
    ollamaModel?: string
  } = {},
): Promise<string> {
  // Check translation memory first
  const cached = await lookupMemory(text, sourceLang)
  if (cached) {
    console.log('[localLLM] Translation memory hit for:', text.slice(0, 30))
    return cached
  }

  let result: string
  if (engine === 'libretranslate') {
    result = await translateWithLibreTranslate(text, sourceLang, 'th', options.libreTranslateUrl)
    await saveMemory(text, sourceLang, result).catch(() => {})
    return result
  }
  if (engine === 'ollama') {
    result = await translateWithOllama(text, sourceLang, options.ollamaModel, options.ollamaUrl)
    await saveMemory(text, sourceLang, result).catch(() => {})
    return result
  }
  // Gemini — use simple text-only prompt (no image needed for single region)
  const { GoogleGenAI } = await import('@google/genai')
  const apiKey = options.apiKey || import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API Key ไม่ได้ตั้งค่า')

  const client = new GoogleGenAI({ apiKey })
  const model = options.modelId || 'gemini-2.5-flash'

  const langLabel: Record<string, string> = {
    ja: 'Japanese', zh: 'Chinese', en: 'English', auto: 'the source language',
  }

  const response = await client.models.generateContent({
    model,
    contents: `Translate the following ${langLabel[sourceLang] ?? 'source'} manga text to Thai. Be natural, not literal. Output ONLY the translated text.\n\nText: ${text}`,
    config: { temperature: 0.3, maxOutputTokens: 256 },
  })

  result = response.text?.trim() ?? text
  await saveMemory(text, sourceLang, result).catch(() => {})
  return result
}
