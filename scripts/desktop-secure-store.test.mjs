import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadViteModule(modulePath) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule(modulePath)
  } finally {
    await server.close()
  }
}

function createLocalStorageMock(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries))
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

function createDefaultSettings() {
  return {
    panelCleanerBridgeUrl: 'http://localhost:5055',
    panelCleanerExecutablePath: '',
    sourceLang: 'auto',
    fontMoodMap: {},
    theme: 'studio-dark',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma4',
    ollamaApiKey: '',
    translationContextEnabled: true,
    translationMode: 'concise',
    translationStyleGuide: 'keep context',
  }
}

test('secure store manager encrypts, loads, and deletes secrets', async () => {
  const { createSecureStoreManager } = await loadViteModule('/electron/main/secureStoreCore.ts')
  const files = new Map()
  const manager = createSecureStoreManager({
    crypto: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^enc:/, ''),
    },
    fileAccess: {
      mkdir: async () => {},
      readFile: async (filePath) => {
        if (!files.has(filePath)) {
          const error = new Error('missing')
          error.code = 'ENOENT'
          throw error
        }
        return files.get(filePath)
      },
      writeFile: async (filePath, contents) => {
        files.set(filePath, contents)
      },
    },
    filePath: 'secure-secrets.json',
  })

  assert.equal(await manager.getSecret('ollama'), null)
  await manager.setSecret('ollama', 'top-secret')
  assert.equal(await manager.getSecret('ollama'), 'top-secret')
  await manager.deleteSecret('ollama')
  assert.equal(await manager.getSecret('ollama'), null)
})

test('secure store manager reports when encryption is unavailable', async () => {
  const { createSecureStoreManager } = await loadViteModule('/electron/main/secureStoreCore.ts')
  const manager = createSecureStoreManager({
    crypto: {
      isEncryptionAvailable: () => false,
      encryptString: (value) => Buffer.from(value, 'utf8'),
      decryptString: (value) => value.toString('utf8'),
    },
    fileAccess: {
      mkdir: async () => {},
      readFile: async () => '{"version":1,"secrets":{}}',
      writeFile: async () => {},
    },
    filePath: 'secure-secrets.json',
  })

  await assert.rejects(
    () => manager.setSecret('ollama', 'top-secret'),
    /safeStorage is not available on this machine/,
  )
})

test('settings storage migrates legacy Ollama API keys into Electron secure storage', async () => {
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const defaults = createDefaultSettings()
  let storedSecret = null
  globalThis.localStorage = createLocalStorageMock({
    'moxzk-settings': JSON.stringify({
      ...defaults,
      ollamaApiKey: 'legacy-secret',
    }),
  })
  globalThis.window = {
    moxzkRuntime: {
      secureStore: {
        getSecret: async () => ({ ok: true, data: null }),
        setSecret: async (_key, value) => {
          storedSecret = value
          return { ok: true, data: { ok: true } }
        },
        deleteSecret: async () => ({ ok: true, data: { ok: true } }),
      },
    },
  }

  try {
    const {
      loadStoredSettingsSnapshot,
      hydrateSecureSettings,
      persistSettings,
    } = await loadViteModule('/src/services/settingsStorage.ts')

    const snapshot = loadStoredSettingsSnapshot(defaults)
    assert.equal(snapshot.settings.ollamaApiKey, '')
    assert.equal(snapshot.legacyOllamaApiKey, 'legacy-secret')

    const hydrated = await hydrateSecureSettings(snapshot.settings, snapshot.legacyOllamaApiKey)
    assert.equal(hydrated.ollamaApiKey, 'legacy-secret')
    assert.equal(storedSecret, 'legacy-secret')
    assert.equal(JSON.parse(globalThis.localStorage.getItem('moxzk-settings')).ollamaApiKey, undefined)

    await persistSettings({ ...hydrated, ollamaApiKey: 'next-secret' })
    assert.equal(storedSecret, 'next-secret')
    assert.equal(JSON.parse(globalThis.localStorage.getItem('moxzk-settings')).ollamaApiKey, undefined)
  } finally {
    globalThis.window = originalWindow
    globalThis.localStorage = originalLocalStorage
  }
})
