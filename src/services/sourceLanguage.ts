import type { AppSettings } from '../types'

export type SourceLanguage = AppSettings['sourceLang']
export type ResolvedSourceLanguage = Exclude<SourceLanguage, 'auto'> | 'auto'

export interface SourceLanguageDetection {
  language: ResolvedSourceLanguage
  confidence: 'low' | 'medium' | 'high'
}

const HIRAGANA_REGEX = /\p{Script=Hiragana}/gu
const KATAKANA_REGEX = /\p{Script=Katakana}/gu
const HAN_REGEX = /\p{Script=Han}/gu
const LATIN_REGEX = /[A-Za-z]/g

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

export function normalizeSourceLanguage(value: string | null | undefined): ResolvedSourceLanguage {
  if (!value) return 'auto'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'ja' || normalized === 'zh' || normalized === 'en') return normalized
  return 'auto'
}

export function detectSourceLanguageFromText(text: string): SourceLanguageDetection {
  const sample = text.trim()
  if (!sample) return { language: 'auto', confidence: 'low' }

  const hiragana = countMatches(sample, HIRAGANA_REGEX)
  const katakana = countMatches(sample, KATAKANA_REGEX)
  const kana = hiragana + katakana
  const han = countMatches(sample, HAN_REGEX)
  const latin = countMatches(sample, LATIN_REGEX)

  if (kana >= 2) return { language: 'ja', confidence: 'high' }
  if (kana >= 1 && han >= 1) return { language: 'ja', confidence: 'high' }
  if (latin >= 4 && han === 0 && kana === 0) return { language: 'en', confidence: 'high' }
  if (latin >= 2 && latin >= han * 2 && kana === 0) return { language: 'en', confidence: 'medium' }
  if (han >= 2 && kana === 0) return { language: 'zh', confidence: 'medium' }
  if (han >= 1 && latin === 0 && kana === 0) return { language: 'zh', confidence: 'low' }

  return { language: 'auto', confidence: 'low' }
}

export function detectSourceLanguageFromTexts(texts: string[]): SourceLanguageDetection {
  const combined = texts
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(' ')

  return detectSourceLanguageFromText(combined)
}

export function resolveSourceLanguagePreference(
  requested: SourceLanguage,
  detected: SourceLanguageDetection | null | undefined,
): ResolvedSourceLanguage {
  if (requested !== 'auto') return requested
  return detected?.language ?? 'auto'
}
