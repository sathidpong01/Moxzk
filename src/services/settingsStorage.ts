import type { AppSettings, FontMoodMap } from '../types'

const SETTINGS_KEY = 'mg-translater-settings'

interface SerializedSettings {
  geminiApiKey: string
  translatorApiUrl: string
  sourceLang: string
  fontMoodMap: FontMoodMap
}

export function saveSettings(settings: AppSettings): void {
  try {
    const serialized: SerializedSettings = {
      geminiApiKey: settings.geminiApiKey,
      translatorApiUrl: settings.translatorApiUrl,
      sourceLang: settings.sourceLang,
      fontMoodMap: settings.fontMoodMap,
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
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
    return defaults
  }
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY)
}
