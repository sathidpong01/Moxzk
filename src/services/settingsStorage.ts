import type { AppSettings, FontMoodMap, TranslationMode } from '../types'
import { LEGACY_FATHER_SON_STYLE_GUIDE } from './story-context'

const SETTINGS_KEY = 'moxzk-settings'
export const OLLAMA_API_KEY_SECRET_KEY = 'settings.ollamaApiKey'

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

export interface StoredSettingsSnapshot {
  settings: AppSettings
  legacyOllamaApiKey: string | null
}

export function loadSettings(defaults: AppSettings): AppSettings {
  return loadStoredSettingsSnapshot(defaults).settings
}

export function loadStoredSettingsSnapshot(defaults: AppSettings): StoredSettingsSnapshot {
  try {
    const parsed = readSerializedSettings()
    if (!parsed) {
      return {
        settings: defaults,
        legacyOllamaApiKey: null,
      }
    }

    const legacyOllamaApiKey = normalizeSecret(parsed.ollamaApiKey)
    return {
      settings: {
        panelCleanerBridgeUrl: parsed.panelCleanerBridgeUrl || defaults.panelCleanerBridgeUrl,
        panelCleanerExecutablePath: parsed.panelCleanerExecutablePath || defaults.panelCleanerExecutablePath,
        sourceLang: (parsed.sourceLang as AppSettings['sourceLang']) || defaults.sourceLang,
        fontMoodMap: parsed.fontMoodMap || defaults.fontMoodMap,
        theme: normalizeTheme(parsed.theme, defaults.theme),
        ollamaUrl: parsed.ollamaUrl || defaults.ollamaUrl,
        ollamaModel: parsed.ollamaModel || defaults.ollamaModel,
        ollamaApiKey: shouldPersistSecretInSettings() ? (legacyOllamaApiKey ?? defaults.ollamaApiKey) : defaults.ollamaApiKey,
        translationContextEnabled: parsed.translationContextEnabled ?? defaults.translationContextEnabled,
        translationMode: normalizeTranslationMode(parsed.translationMode, defaults.translationMode),
        translationStyleGuide: normalizeTranslationStyleGuide(parsed.translationStyleGuide, defaults.translationStyleGuide),
      },
      legacyOllamaApiKey,
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
    return {
      settings: defaults,
      legacyOllamaApiKey: null,
    }
  }
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  try {
    if (shouldPersistSecretInSettings()) {
      writeSerializedSettings(serializeSettings(settings, true))
      return
    }

    const bridge = getNativeBridge()
    if (!bridge?.secureStore) {
      throw new Error('Electron secure store bridge is not available.')
    }

    await writeSecretThroughBridge(settings.ollamaApiKey, bridge)
    writeSerializedSettings(serializeSettings(settings, false))
  } catch (err) {
    console.error('Failed to save settings:', err)
    throw err
  }
}

export async function hydrateSecureSettings(settings: AppSettings, legacyOllamaApiKey: string | null): Promise<AppSettings> {
  if (shouldPersistSecretInSettings()) return settings

  const bridge = getNativeBridge()
  if (!bridge?.secureStore) return settings

  try {
    const secretResult = await bridge.secureStore.getSecret(OLLAMA_API_KEY_SECRET_KEY)
    if (!secretResult.ok) throw new Error(secretResult.error || 'Failed to read secure secret storage.')
    let secret = normalizeSecret(secretResult.data ?? null)
    if (!secret && legacyOllamaApiKey) {
      await writeSecretThroughBridge(legacyOllamaApiKey, bridge)
      secret = legacyOllamaApiKey
    }
    if (legacyOllamaApiKey) {
      writeSerializedSettings(serializeSettings({ ...settings, ollamaApiKey: secret ?? '' }, false))
    }
    return {
      ...settings,
      ollamaApiKey: secret ?? '',
    }
  } catch (err) {
    console.warn('Failed to hydrate secure settings:', err)
    return settings
  }
}

export async function clearSettings(): Promise<void> {
  localStorage.removeItem(SETTINGS_KEY)
  if (shouldPersistSecretInSettings()) return
  const bridge = getNativeBridge()
  if (!bridge?.secureStore) return
  try {
    await bridge.secureStore.deleteSecret(OLLAMA_API_KEY_SECRET_KEY)
  } catch (err) {
    console.warn('Failed to clear secure settings:', err)
  }
}

function serializeSettings(settings: AppSettings, includeOllamaApiKey: boolean): SerializedSettings {
  return {
    panelCleanerBridgeUrl: settings.panelCleanerBridgeUrl,
    panelCleanerExecutablePath: settings.panelCleanerExecutablePath,
    sourceLang: settings.sourceLang,
    fontMoodMap: settings.fontMoodMap,
    theme: settings.theme,
    ollamaUrl: settings.ollamaUrl,
    ollamaModel: settings.ollamaModel,
    ...(includeOllamaApiKey ? { ollamaApiKey: settings.ollamaApiKey } : {}),
    translationContextEnabled: settings.translationContextEnabled,
    translationMode: settings.translationMode,
    translationStyleGuide: settings.translationStyleGuide,
  }
}

function readSerializedSettings(): SerializedSettings | null {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return null
  return JSON.parse(raw) as SerializedSettings
}

function writeSerializedSettings(settings: SerializedSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

async function writeSecretThroughBridge(
  ollamaApiKey: string,
  bridge: NonNullable<Window['moxzkRuntime']>,
): Promise<void> {
  const normalized = normalizeSecret(ollamaApiKey)
  if (normalized) {
    const result = await bridge.secureStore.setSecret(OLLAMA_API_KEY_SECRET_KEY, normalized)
    if (!result.ok) throw new Error(result.error || 'Failed to store Ollama API key securely.')
    return
  }

  const result = await bridge.secureStore.deleteSecret(OLLAMA_API_KEY_SECRET_KEY)
  if (!result.ok) throw new Error(result.error || 'Failed to delete Ollama API key from secure storage.')
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

function normalizeSecret(value: string | undefined | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function shouldPersistSecretInSettings(): boolean {
  return !getNativeBridge()
}

function getNativeBridge(): Window['moxzkRuntime'] | undefined {
  if (typeof window === 'undefined') return undefined
  return window.moxzkRuntime
}
