import { GoogleGenAI } from '@google/genai'
import type { MoodType, TextRegion, BoundingBox } from '../types'
import { getMoodFont } from '../config/fonts'

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
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set')
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

  return `คุณเป็นนักแปลมังงะมืออาชีพ ที่เข้าใจอารมณ์ตัวละครจากภาพและบริบท

## งานของคุณ
1. ดูภาพมังงะที่แนบมา — สังเกตสีหน้าตัวละคร, ขนาด/สไตล์ speech bubble, ฉากหลัง
2. อ่าน OCR text ที่ตรวจจับได้จากภาพ
3. แปลเป็นภาษาไทยที่เป็นธรรมชาติ
4. วิเคราะห์ mood ของแต่ละ text region จากภาพจริง

## OCR Text Regions (${sourceLang}):
${regions.join('\n')}

## Mood Types
- normal: สนทนาทั่วไป
- shouting: ตะโกน / โกรธ / ตื่นเต้นมาก
- whisper: กระซิบ / นุ่มนวล / เสียงเบา
- comedy: ตลก / สนุกสนาน / เสียดสี
- narration: บรรยาย / เล่าเรื่อง / ความคิดภายใน
- sfx: เสียงเอฟเฟกต์ (ドーン, バキ, etc.)

## ตอบเป็น JSON เท่านั้น:
{
  "translations": [
    {
      "index": 0,
      "original": "OCR text ต้นฉบับ",
      "translated": "คำแปลภาษาไทย",
      "mood": "normal|shouting|whisper|comedy|narration|sfx",
      "suggestedFont": "ชื่อฟอนต์ที่เหมาะสม"
    }
  ]
}

## กฎสำคัญ
- แปลให้เป็นธรรมชาติ ไม่ใช่แปลตรงตัว
- ถ้าเป็น SFX ให้เขียนเสียงเป็นไทย (เช่น "ドーン" → "โครม!!")
- mood ต้องอิงจากภาพจริง ไม่ใช่แค่ข้อความ
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

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
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
    const font = getMoodFont(mood)
    const bbox = bboxes[item.index] ?? { x: 0, y: 0, width: 100, height: 30 }

    return {
      id: `region-${item.index}`,
      bbox,
      originalText: item.original,
      translatedText: item.translated,
      mood,
      suggestedFont: item.suggestedFont || font.name,
      fontSize: Math.max(12, Math.min(bbox.height * 0.6, 48)),
      fontColor: '#ffffff',
      rotation: 0,
    }
  })
}
