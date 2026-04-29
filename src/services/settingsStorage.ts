import type { AppSettings, FontMoodMap, TranslationMode } from '../types'
import { LEGACY_FATHER_SON_STYLE_GUIDE } from './story-context'

const SETTINGS_KEY = 'moxzk-settings'

interface SerializedSettings {
  panelCleanerBridgeUrl?: string
  panelCleanerExecutablePath?: string
  sourceLang: string
  fontMoodMap: FontMoodMap
  theme?: string
  ollamaUrl?: string
  ollamaModel?: string
  ollamaApiKey?: string
  translationContextEnabled?: boolean
  translationMode?: TranslationMode
  translationStyleGuide?: string
}

export function saveSettings(settings: AppSettings): void {
  try {
    const serialized: SerializedSettings = {
      panelCleanerBridgeUrl: settings.panelCleanerBridgeUrl,
      panelCleanerExecutablePath: settings.panelCleanerExecutablePath,
      sourceLang: settings.sourceLang,
      fontMoodMap: settings.fontMoodMap,
      theme: settings.theme,
      ollamaUrl: settings.ollamaUrl,
      ollamaModel: settings.ollamaModel,
      ollamaApiKey: settings.ollamaApiKey,
      translationContextEnabled: settings.translationContextEnabled,
      translationMode: settings.translationMode,
      translationStyleGuide: settings.translationStyleGuide,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(serialized))
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

export function loadSettings(defaults: AppSettings): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults

    const parsed: SerializedSettings = JSON.parse(raw)
    return {
      panelCleanerBridgeUrl: parsed.panelCleanerBridgeUrl || defaults.panelCleanerBridgeUrl,
      panelCleanerExecutablePath: parsed.panelCleanerExecutablePath || defaults.panelCleanerExecutablePath,
      sourceLang: (parsed.sourceLang as AppSettings['sourceLang']) || defaults.sourceLang,
      fontMoodMap: parsed.fontMoodMap || defaults.fontMoodMap,
      theme: normalizeTheme(parsed.theme, defaults.theme),
      ollamaUrl: parsed.ollamaUrl || defaults.ollamaUrl,
      ollamaModel: parsed.ollamaModel || defaults.ollamaModel,
      ollamaApiKey: parsed.ollamaApiKey || defaults.ollamaApiKey,
      translationContextEnabled: parsed.translationContextEnabled ?? defaults.translationContextEnabled,
      translationMode: normalizeTranslationMode(parsed.translationMode, defaults.translationMode),
      translationStyleGuide: normalizeTranslationStyleGuide(parsed.translationStyleGuide, defaults.translationStyleGuide),
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
    return defaults
  }
}

function normalizeTheme(theme: string | undefined, fallback: string): string {
  return theme === 'studio-dark' ? theme : fallback
}

function normalizeTranslationStyleGuide(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback
  return value === LEGACY_FATHER_SON_STYLE_GUIDE ? fallback : value
}

function normalizeTranslationMode(value: string | undefined, fallback: TranslationMode): TranslationMode {
  return value === 'faithful' || value === 'concise' ? value : fallback
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY)
}
