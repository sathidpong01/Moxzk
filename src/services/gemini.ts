import { GoogleGenAI } from '@google/genai'
import type { MoodType, TextRegion, BoundingBox } from '../types'
import { incrementQuota, updateQuotaFromError } from './geminiQuota'
// Font resolution now handled by resolveFont in config/fonts.ts

interface GeminiTranslationItem {
  index: number
  original: string
  translated: string
  mood: MoodType
  suggestedFont: string
}

interface GeminiTranslationResponse {
  translations: GeminiTranslationItem[]
}

function getClient(apiKeyOverride?: string): GoogleGenAI {
  const apiKey = apiKeyOverride || import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    console.error('[gemini] API key is not set. Provide via Settings or .env.local VITE_GEMINI_API_KEY=your_key')
    throw new Error('Gemini API Key ไม่ได้ตั้งค่า — ไปที่ Settings เพื่อใส่ API Key')
  }
  console.log('[gemini] API key loaded:', apiKey.slice(0, 8) + '...')
  return new GoogleGenAI({ apiKey })
}

function buildPrompt(
  ocrTexts: string[],
  bboxes: BoundingBox[],
  sourceLang: string,
): string {
  const regions = ocrTexts.map((text, i) => {
    const b = bboxes[i]
    return `[${i}] "${text}" (x:${b?.x ?? 0}, y:${b?.y ?? 0}, w:${b?.width ?? 0}, h:${b?.height ?? 0})`
  })

  const langInstruction = sourceLang === 'auto'
    ? `ตรวจจับภาษาต้นฉบับจากข้อความ OCR โดยอัตโนมัติ`
    : `ภาษาต้นฉบับคือ: ${sourceLang}`

  return `คุณเป็นนักแปลมังงะมืออาชีพ ที่เข้าใจอารมณ์ตัวละครจากภาพและบริบท

## งานของคุณ
1. ดูภาพมังงะที่แนบมา — สังเกตสีหน้าตัวละคร, ขนาด/สไตล์ speech bubble, ฉากหลัง
2. อ่าน OCR text ที่ตรวจจับได้จากภาพ
3. ${langInstruction}
4. แปลเป็นภาษาไทยที่เป็นธรรมชาติ
5. วิเคราะห์ mood ของแต่ละ text region จากภาพจริง

## OCR Text Regions${sourceLang !== 'auto' ? ` (${sourceLang})` : ''}:
${regions.join('\n')}

## Mood Types
- normal: สนทนาทั่วไป
- shouting: ตะโกน / โกรธ / ตื่นเต้นมาก
- whisper: กระซิบ / นุ่มนวล / เสียงเบา
- comedy: ตลก / สนุกสนาน / เสียดสี
- narration: บรรยาย / เล่าเรื่อง / ความคิดภายใน
- sfx: เสียงเอฟเฟกต์ (ドーン, バキ, etc.)

## Available Font IDs (suggestedFont ต้องเป็น ID จากรายการนี้เท่านั้น):
- "normal" — สนทนาทั่วไป, บรรยาย
- "normal_bold" — สนทนาจริงจัง, เน้นข้อความ
- "normal_italic" — ความคิดในใจ, เสียงภายใน
- "shouting" — ตะโกน, โกรธ, ตกใจ, เน้นหนัก
- "comedy" — ตลก, สนุกสนาน
- "comedy_bold" — ตลก เน้น
- "whisper" — กระซิบ, เสียงเบา, นุ่มนวล
- "narration" — บรรยาย, เล่าเรื่อง
- "sfx" — เสียงเอฟเฟกต์ SFX
- "cute" — เป็นกันเอง, น่ารัก

## ตอบเป็น JSON เท่านั้น:
{
  "translations": [
    {
      "index": 0,
      "original": "OCR text ต้นฉบับ",
      "translated": "คำแปลภาษาไทย",
      "mood": "normal|shouting|whisper|comedy|narration|sfx",
      "suggestedFont": "ชื่อฟอนต์จากรายการ Available Fonts ด้านบน"
    }
  ]
}

## กฎสำคัญ
- แปลให้เป็นธรรมชาติ ไม่ใช่แปลตรงตัว
- ถ้าเป็น SFX ให้เขียนเสียงเป็นไทย (เช่น "ドーン" → "โครม!!")
- mood ต้องอิงจากภาพจริง ไม่ใช่แค่ข้อความ
- suggestedFont ต้องเลือกจาก Available Fonts เท่านั้น ห้ามใช้ชื่อฟอนต์อื่น
- ตอบ JSON เท่านั้น ไม่ต้องมี markdown code block`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function calcAutoFontSize(text: string, bbox: BoundingBox): number {
  const { width, height } = bbox
  if (width <= 0 || height <= 0) return 14

  const textLen = Math.max(text.length, 1)
  // Thai chars are roughly 0.55× fontSize wide, with 1.3 line-height
  const charW = 0.55
  const lineH = 1.3
  // Solve: area ≈ textLen * charW * fontSize * lineH * fontSize
  // fontSize ≈ sqrt(area / (textLen * charW * lineH))
  const area = width * height
  let fs = Math.sqrt(area / (textLen * charW * lineH))

  // Ensure at least 2 chars per line
  fs = Math.min(fs, width / 2)
  // Don't exceed bbox height
  fs = Math.min(fs, height * 0.85)
  // Clamp
  fs = Math.max(10, Math.min(fs, 60))

  return Math.round(fs)
}

function repairAndParseJson(raw: string): GeminiTranslationResponse {
  // Step 1: extract outermost JSON object
  const objMatch = raw.match(/\{[\s\S]*/)
  if (!objMatch) throw new Error(`No JSON found in Gemini response: ${raw.slice(0, 200)}`)

  let json = objMatch[0]

  // Step 2: sanitize common issues
  json = json
    .replace(/,\s*([\]}])/g, '$1')      // trailing commas
    .replace(/[\x00-\x1F\x7F]/g, ' ')   // control characters

  // Step 3: try direct parse
  try { return JSON.parse(json) } catch { /* continue */ }

  // Step 4: handle truncated JSON — close open brackets/braces
  // Find the last complete object in the translations array
  const arrStart = json.indexOf('[')
  if (arrStart === -1) throw new Error(`No translations array in Gemini response: ${raw.slice(0, 200)}`)

  // Find all complete translation objects (ending with })
  const regex = /\{[^{}]*"index"\s*:\s*\d+[^{}]*\}/g
  const completeObjects: string[] = []
  let m
  while ((m = regex.exec(json)) !== null) {
    // Verify each extracted object is valid JSON
    try {
      JSON.parse(m[0])
      completeObjects.push(m[0])
    } catch { /* skip incomplete */ }
  }

  if (completeObjects.length === 0) {
    throw new Error(`Could not extract any translation objects from Gemini response: ${raw.slice(0, 300)}`)
  }

  // Reconstruct valid JSON from salvaged objects
  const repaired = `{"translations":[${completeObjects.join(',')}]}`
  console.warn(`[gemini] Repaired truncated JSON: salvaged ${completeObjects.length} of possible regions`)
  try {
    return JSON.parse(repaired)
  } catch (e) {
    throw new Error(`Failed to parse repaired Gemini JSON: ${(e as Error).message}\nSalvaged: ${completeObjects.length} objects`)
  }
}

function parseMood(mood: string): MoodType {
  const valid: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']
  return valid.includes(mood as MoodType) ? (mood as MoodType) : 'normal'
}

export async function translateWithImage(
  imageFile: File,
  ocrTexts: string[],
  bboxes: BoundingBox[],
  sourceLang: string = 'ja',
  apiKey?: string,
): Promise<TextRegion[]> {
  const client = getClient(apiKey)
  const base64 = await fileToBase64(imageFile)
  const prompt = buildPrompt(ocrTexts, bboxes, sourceLang)

  console.log('[gemini] Calling Gemini with', ocrTexts.length, 'OCR texts, model: gemini-2.5-flash')

  let text: string
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: imageFile.type || 'image/png',
                data: base64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    })
    text = response.text ?? ''
    incrementQuota()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    // Check if it's a 429 quota error
    if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
      updateQuotaFromError(errMsg)
    }
    throw err
  }
  console.log('[gemini] Raw response length:', text.length, 'preview:', text.slice(0, 300))
  let parsed: GeminiTranslationResponse

  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = repairAndParseJson(text)
  }

  return parsed.translations.map((item) => {
    const mood = parseMood(item.mood)
    const bbox = bboxes[item.index] ?? { x: 0, y: 0, width: 100, height: 30 }
    const fontSize = calcAutoFontSize(item.translated, bbox)

    return {
      id: `region-${item.index}`,
      bbox,
      originalText: item.original,
      translatedText: item.translated,
      mood,
      suggestedFont: item.suggestedFont || mood,
      fontSize,
      fontColor: '#000000',
      rotation: 0,
      strokeWidth: 0,
      strokeColor: '#ffffff',
    }
  })
}
