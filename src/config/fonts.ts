import type { FontDefinition, FontMoodMap, MoodType } from '../types'

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

export function fontToCss(font: FontDefinition): string {
  return `${font.style === 'italic' ? 'italic ' : ''}${font.weight} 1rem "${font.family}", sans-serif`
}

export async function registerCustomFont(
  name: string,
  file: File,
): Promise<FontDefinition> {
  const url = URL.createObjectURL(file)
  const fontFace = new FontFace(name, `url(${url})`)
  await fontFace.load()
  document.fonts.add(fontFace)

  return {
    name,
    family: name,
    weight: 400,
    style: 'normal',
    isCustom: true,
    url,
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
