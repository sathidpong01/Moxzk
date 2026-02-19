import type { AppSettings, FontMoodMap } from '../types'

const SETTINGS_KEY = 'mg-translater-settings'

interface SerializedSettings {
  geminiApiKey: string
  translatorApiUrl: string
  sourceLang: string
  fontMoodMap: FontMoodMap
  theme?: string
  geminiModel?: string
  translationEngine?: string
  ollamaUrl?: string
  ollamaModel?: string
  libreTranslateUrl?: string
}

export function saveSettings(settings: AppSettings): void {
  try {
    const serialized: SerializedSettings = {
      geminiApiKey: settings.geminiApiKey,
      translatorApiUrl: settings.translatorApiUrl,
      sourceLang: settings.sourceLang,
      fontMoodMap: settings.fontMoodMap,
      theme: settings.theme,
      geminiModel: settings.geminiModel,
      translationEngine: settings.translationEngine,
      ollamaUrl: settings.ollamaUrl,
      ollamaModel: settings.ollamaModel,
      libreTranslateUrl: settings.libreTranslateUrl,
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
      geminiApiKey: parsed.geminiApiKey || defaults.geminiApiKey,
      translatorApiUrl: parsed.translatorApiUrl || defaults.translatorApiUrl,
      sourceLang: (parsed.sourceLang as AppSettings['sourceLang']) || defaults.sourceLang,
      fontMoodMap: parsed.fontMoodMap || defaults.fontMoodMap,
      theme: parsed.theme || defaults.theme,
      geminiModel: (parsed.geminiModel as AppSettings['geminiModel']) || defaults.geminiModel,
      translationEngine: (parsed.translationEngine as AppSettings['translationEngine']) || defaults.translationEngine,
      ollamaUrl: parsed.ollamaUrl || defaults.ollamaUrl,
      ollamaModel: parsed.ollamaModel || defaults.ollamaModel,
      libreTranslateUrl: parsed.libreTranslateUrl || defaults.libreTranslateUrl,
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
    return defaults
  }
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY)
}
