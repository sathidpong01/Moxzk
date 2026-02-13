import { GoogleGenAI } from '@google/genai'
import type { MoodType, TextRegion, BoundingBox } from '../types'
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

function getClient(): GoogleGenAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    console.error('[gemini] VITE_GEMINI_API_KEY is not set in environment. Check .env.local has VITE_GEMINI_API_KEY=your_key')
    throw new Error('VITE_GEMINI_API_KEY is not set — ตรวจสอบ .env.local ว่ามี VITE_GEMINI_API_KEY=xxx')
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

function parseMood(mood: string): MoodType {
  const valid: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']
  return valid.includes(mood as MoodType) ? (mood as MoodType) : 'normal'
}

export async function translateWithImage(
  imageFile: File,
  ocrTexts: string[],
  bboxes: BoundingBox[],
  sourceLang: string = 'ja',
): Promise<TextRegion[]> {
  const client = getClient()
  const base64 = await fileToBase64(imageFile)
  const prompt = buildPrompt(ocrTexts, bboxes, sourceLang)

  console.log('[gemini] Calling Gemini with', ocrTexts.length, 'OCR texts, model: gemini-2.5-flash')
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
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  })

  const text = response.text ?? ''
  console.log('[gemini] Raw response length:', text.length, 'preview:', text.slice(0, 300))
  let parsed: GeminiTranslationResponse

  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      throw new Error(`Failed to parse Gemini response: ${text.slice(0, 200)}`)
    }
  }

  return parsed.translations.map((item) => {
    const mood = parseMood(item.mood)
    const bbox = bboxes[item.index] ?? { x: 0, y: 0, width: 100, height: 30 }

    return {
      id: `region-${item.index}`,
      bbox,
      originalText: item.original,
      translatedText: item.translated,
      mood,
      suggestedFont: item.suggestedFont || mood,
      fontSize: Math.max(12, Math.min(bbox.height * 0.6, 48)),
      fontColor: '#000000',
      rotation: 0,
    }
  })
}
