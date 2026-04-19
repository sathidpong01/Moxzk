import type { FontDefinition, FontMoodMap, MoodType, TextRegion } from '../types'
import { saveFont, fileToArrayBuffer, type StoredFont } from '../services/fontStorage'

export const BUILT_IN_FONTS: FontDefinition[] = [
  { name: 'Sarabun', family: 'Sarabun', weight: 400, style: 'normal', isCustom: false },
  { name: 'Sarabun Bold', family: 'Sarabun', weight: 700, style: 'normal', isCustom: false },
  { name: 'Sarabun Italic', family: 'Sarabun', weight: 400, style: 'italic', isCustom: false },
  { name: 'Kanit Bold', family: 'Kanit', weight: 700, style: 'normal', isCustom: false },
  { name: 'K2D', family: 'K2D', weight: 400, style: 'normal', isCustom: false },
  { name: 'K2D Bold', family: 'K2D', weight: 700, style: 'normal', isCustom: false },
  { name: 'Prompt Light', family: 'Prompt', weight: 300, style: 'normal', isCustom: false },
  { name: 'Prompt', family: 'Prompt', weight: 400, style: 'normal', isCustom: false },
  { name: 'Bai Jamjuree Bold', family: 'Bai Jamjuree', weight: 700, style: 'normal', isCustom: false },
  { name: 'Mitr', family: 'Mitr', weight: 400, style: 'normal', isCustom: false },
]

export const DEFAULT_MOOD_MAP: FontMoodMap = {
  normal: { name: 'Sarabun', family: 'Sarabun', weight: 400, style: 'normal', isCustom: false },
  shouting: { name: 'Kanit Bold', family: 'Kanit', weight: 700, style: 'normal', isCustom: false },
  whisper: { name: 'Prompt Light', family: 'Prompt', weight: 300, style: 'normal', isCustom: false },
  comedy: { name: 'K2D', family: 'K2D', weight: 400, style: 'normal', isCustom: false },
  narration: { name: 'Sarabun Italic', family: 'Sarabun', weight: 400, style: 'italic', isCustom: false },
  sfx: { name: 'Bai Jamjuree Bold', family: 'Bai Jamjuree', weight: 700, style: 'normal', isCustom: false },
}

export function getMoodFont(mood: MoodType, moodMap: FontMoodMap = DEFAULT_MOOD_MAP): FontDefinition {
  return moodMap[mood] ?? DEFAULT_MOOD_MAP.normal
}

export function findFontByName(name: string): FontDefinition | null {
  return BUILT_IN_FONTS.find((f) => f.name === name) ?? null
}

export const FONT_ID_MAP: Record<string, FontDefinition> = {
  normal: { name: 'Sarabun', family: 'Sarabun', weight: 400, style: 'normal', isCustom: false },
  normal_bold: { name: 'Sarabun Bold', family: 'Sarabun', weight: 700, style: 'normal', isCustom: false },
  normal_italic: { name: 'Sarabun Italic', family: 'Sarabun', weight: 400, style: 'italic', isCustom: false },
  shouting: { name: 'Kanit Bold', family: 'Kanit', weight: 700, style: 'normal', isCustom: false },
  comedy: { name: 'K2D', family: 'K2D', weight: 400, style: 'normal', isCustom: false },
  comedy_bold: { name: 'K2D Bold', family: 'K2D', weight: 700, style: 'normal', isCustom: false },
  whisper: { name: 'Prompt Light', family: 'Prompt', weight: 300, style: 'normal', isCustom: false },
  narration: { name: 'Prompt', family: 'Prompt', weight: 400, style: 'normal', isCustom: false },
  sfx: { name: 'Bai Jamjuree Bold', family: 'Bai Jamjuree', weight: 700, style: 'normal', isCustom: false },
  cute: { name: 'Mitr', family: 'Mitr', weight: 400, style: 'normal', isCustom: false },
}

export function resolveFont(suggestedFont: string, mood: MoodType, moodMap: FontMoodMap = DEFAULT_MOOD_MAP): FontDefinition {
  // 1. Try font ID map (AI-suggested IDs like "shouting", "whisper")
  if (FONT_ID_MAP[suggestedFont]) return FONT_ID_MAP[suggestedFont]
  // 2. Try built-in font by name (legacy)
  const builtIn = BUILT_IN_FONTS.find((f) => f.name === suggestedFont)
  if (builtIn) return builtIn
  // 3. Treat as custom font name
  if (suggestedFont) {
    return { name: suggestedFont, family: suggestedFont, weight: 400, style: 'normal', isCustom: true }
  }
  // 4. Fall back to mood-based default
  return getMoodFont(mood, moodMap)
}

export function getRegionFontKey(region: Pick<TextRegion, 'fontId' | 'suggestedFont' | 'mood'>): string {
  return region.fontId || region.suggestedFont || region.mood
}

export function resolveRegionFont(
  region: Pick<TextRegion, 'fontId' | 'suggestedFont' | 'mood'>,
  moodMap: FontMoodMap = DEFAULT_MOOD_MAP,
): FontDefinition {
  return resolveFont(getRegionFontKey(region), region.mood, moodMap)
}

export function fontToCss(font: FontDefinition): string {
  return `${font.style === 'italic' ? 'italic ' : ''}${font.weight} 1rem "${font.family}", sans-serif`
}

export async function registerCustomFont(
  name: string,
  file: File,
): Promise<FontDefinition> {
  const arrayBuffer = await fileToArrayBuffer(file)

  const fontFace = new FontFace(name, arrayBuffer)
  await fontFace.load()
  document.fonts.add(fontFace)

  const stored: StoredFont = {
    name,
    family: name,
    weight: 400,
    style: 'normal',
    data: arrayBuffer,
    mimeType: file.type || 'font/ttf',
    createdAt: Date.now(),
  }
  await saveFont(stored)

  return {
    name,
    family: name,
    weight: 400,
    style: 'normal',
    isCustom: true,
  }
}

export async function restoreCustomFont(stored: StoredFont): Promise<FontDefinition> {
  const fontFace = new FontFace(stored.name, stored.data)
  await fontFace.load()
  document.fonts.add(fontFace)

  return {
    name: stored.name,
    family: stored.family,
    weight: stored.weight,
    style: stored.style,
    isCustom: true,
  }
}

export const MOOD_LABELS: Record<MoodType, string> = {
  normal: 'สนทนาทั่วไป',
  shouting: 'ตะโกน / โกรธ',
  whisper: 'กระซิบ / นุ่มนวล',
  comedy: 'ตลก / สนุกสนาน',
  narration: 'บรรยาย / เล่าเรื่อง',
  sfx: 'เสียงเอฟเฟกต์',
}
