import type { ImageEntry, TextRegion } from '../types'

export interface TranslationStoryContext {
  enabled: boolean
  pageNumber?: number
  totalPages?: number
  styleGuide?: string
  previousLines?: Array<{
    pageNumber?: number
    original: string
    translated: string
  }>
}

const MAX_CONTEXT_LINES = 24
const MAX_LINE_CHARS = 180

export const DEFAULT_TRANSLATION_STYLE_GUIDE = [
  'แปลเป็นไทยธรรมชาติแบบมังงะผู้ใหญ่ ไม่แปลแข็งหรือสุภาพเกินไป',
  'รักษาความสัมพันธ์ของตัวละครให้ต่อเนื่องทั้งเรื่อง ไม่ว่าจะเป็นครอบครัว พี่น้อง คู่รัก เพื่อน เจ้านาย/ลูกน้อง ครู/ศิษย์ รุ่นพี่/รุ่นน้อง คู่แข่ง หรือคนแปลกหน้า',
  'คำเรียกแทนตัวและคำเรียกคู่สนทนาต้องตามบริบทภาพ บทก่อนหน้า อายุ ลำดับชั้น ความสนิท และอารมณ์ของฉาก',
  'ถ้าบทก่อนหน้าหรือภาพ establish ความสัมพันธ์ไว้แล้ว ห้ามเปลี่ยนเป็นความสัมพันธ์อื่นโดยไม่มีหลักฐานจากต้นฉบับ',
  'อย่าตัดคำถาม ปฏิเสธ เหตุผล คำเรียก ความสัมพันธ์ หรือคำลงท้ายที่เปลี่ยนน้ำเสียงของประโยค',
].join('\n')

export const LEGACY_FATHER_SON_STYLE_GUIDE = [
  'แปลเป็นไทยธรรมชาติแบบมังงะผู้ใหญ่ ไม่แปลแข็งหรือสุภาพเกินไป',
  'รักษาความสัมพันธ์ของตัวละครให้ต่อเนื่องทั้งเรื่อง เช่น father/son = พ่อ/ลูกชาย',
  'คำเรียกคู่สนทนาต้องตามบริบทภาพและบทก่อนหน้า ห้ามเดาสลับเป็นพี่/น้องถ้าไม่มีหลักฐาน',
  'อย่าตัดคำถาม ปฏิเสธ เหตุผล หรือคำลงท้ายที่เปลี่ยนน้ำเสียงของประโยค',
].join('\n')

export function compactLine(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LINE_CHARS)
}

export function collectPreviousTranslationLines(
  entries: ImageEntry[],
  currentEntryId: string,
  liveTranslatedLines: TranslationStoryContext['previousLines'] = [],
): TranslationStoryContext['previousLines'] {
  const lines: NonNullable<TranslationStoryContext['previousLines']> = []

  for (const entry of entries) {
    if (entry.id === currentEntryId) break
    for (const region of entry.regions ?? []) {
      const original = compactLine(region.originalText)
      const translated = compactLine(region.translatedText)
      if (!original || !translated) continue
      lines.push({ pageNumber: entry.pageNumber, original, translated })
    }
  }

  lines.push(...liveTranslatedLines)
  return lines.slice(-MAX_CONTEXT_LINES)
}

export function buildStoryContextBlock(context?: TranslationStoryContext): string {
  if (!context?.enabled) return ''

  const parts: string[] = [
    'Story continuity context:',
    `- Current page: ${context.pageNumber ?? '?'}${context.totalPages ? ` / ${context.totalPages}` : ''}.`,
    '- Maintain the same speaker relationships, names, honorifics, pronouns, and recurring terms across pages.',
    '- Track every relationship category, including family, siblings, romantic partners, friends, rivals, coworkers, boss/subordinate, teacher/student, senior/junior, customer/staff, and strangers.',
    '- If an earlier line or the image establishes a relationship, keep that relationship consistent unless the source explicitly changes it.',
    '- Choose Thai pronouns and address terms from the relationship, age, hierarchy, intimacy, and scene tone. Do not invent a different relationship to make the sentence sound natural.',
    '- Do not drop meaning to make text shorter. Keep every important clause, question, negation, relationship term, and implied subject.',
    '- You may compress wording only after preserving the full meaning.',
  ]

  const styleGuide = context.styleGuide?.trim()
  if (styleGuide) {
    parts.push('Project style guide:')
    parts.push(styleGuide)
  }

  if (context.previousLines?.length) {
    parts.push('Previous translated lines:')
    for (const line of context.previousLines) {
      parts.push(
        `- p${line.pageNumber ?? '?'}: ${compactLine(line.original)} => ${compactLine(line.translated)}`,
      )
    }
  }

  return parts.join('\n')
}

export function appendTranslatedLines(
  target: NonNullable<TranslationStoryContext['previousLines']>,
  pageNumber: number | undefined,
  regions: TextRegion[],
): void {
  for (const region of regions) {
    const original = compactLine(region.originalText)
    const translated = compactLine(region.translatedText)
    if (!original || !translated) continue
    target.push({ pageNumber, original, translated })
  }
  if (target.length > MAX_CONTEXT_LINES) {
    target.splice(0, target.length - MAX_CONTEXT_LINES)
  }
}
