import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadViteModule(path) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule(path)
  } finally {
    await server.close()
  }
}

test('web runtime is exposed as an AppRuntime class instance', async () => {
  const { WebRuntime, webRuntime } = await loadViteModule('/src/runtime/webRuntime.ts')

  assert.ok(webRuntime instanceof WebRuntime)
  assert.equal(webRuntime.kind, 'web')
  assert.equal(webRuntime.capabilities.canStartLocalServices, false)
  assert.equal(typeof webRuntime.ollama.getServerStatus, 'function')
  assert.equal(typeof webRuntime.files.saveExportFiles, 'function')
})

test('OllamaClient preserves cloud API key and api path behavior', async () => {
  const { OllamaClient } = await loadViteModule('/src/services/ollama.ts')
  const client = new OllamaClient()
  const originalFetch = globalThis.fetch
  let captured = null

  globalThis.fetch = async (url, init = {}) => {
    captured = {
      url: String(url),
      headers: init.headers,
    }
    return new Response(JSON.stringify({ models: [{ name: 'gemma4' }] }), { status: 200 })
  }

  try {
    const models = await client.listModels({
      ollamaUrl: 'https://ollama.com/api',
      ollamaApiKey: ' secret ',
    })

    assert.deepEqual(models, [{ name: 'gemma4' }])
    assert.equal(captured.url, 'https://ollama.com/api/tags')
    assert.equal(captured.headers.Authorization, 'Bearer secret')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OllamaClient keeps cloud status guard without an API key', async () => {
  const { OllamaClient } = await loadViteModule('/src/services/ollama.ts')
  const client = new OllamaClient()

  assert.deepEqual(
    await client.getStatus({ ollamaUrl: 'https://ollama.com' }),
    { ok: false, url: 'https://ollama.com', error: 'Ollama Cloud ต้องใช้ API key' },
  )
})

test('PanelCleanerClient posts status checks to the normalized bridge URL', async () => {
  const { PanelCleanerClient } = await loadViteModule('/src/services/panelcleaner-api.ts')
  const client = new PanelCleanerClient()
  const originalFetch = globalThis.fetch
  let captured = null

  globalThis.fetch = async (url, init = {}) => {
    captured = {
      url: String(url),
      method: init.method,
      headers: init.headers,
      body: JSON.parse(String(init.body)),
    }
    return new Response(JSON.stringify({ version: '1.0.0', command: 'pcleaner' }), { status: 200 })
  }

  try {
    const status = await client.getStatus({
      bridgeUrl: 'http://localhost:5055///',
      executablePath: 'C:\\Tools\\pcleaner.exe',
    })

    assert.deepEqual(status, { ok: true, version: '1.0.0', command: 'pcleaner' })
    assert.equal(captured.url, 'http://localhost:5055/panelcleaner/status')
    assert.equal(captured.method, 'POST')
    assert.equal(captured.headers['Content-Type'], 'application/json')
    assert.equal(captured.body.executablePath, 'C:\\Tools\\pcleaner.exe')
  } finally {
    globalThis.fetch = originalFetch
  }
})
