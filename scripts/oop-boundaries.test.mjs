import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const viteModuleCache = new Map()

async function loadViteModule(path) {
  if (viteModuleCache.has(path)) return viteModuleCache.get(path)

  const loaded = (async () => {
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
  })()

  viteModuleCache.set(path, loaded)
  return loaded
}

function createAbortableFetch() {
  return async (_url, init = {}) => new Promise((_, reject) => {
    const signal = init.signal
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    signal?.addEventListener('abort', () => {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

test('web runtime is exposed as an AppRuntime class instance', async () => {
  const { WebRuntime, webRuntime } = await loadViteModule('/src/runtime/webRuntime.ts')

  assert.ok(webRuntime instanceof WebRuntime)
  assert.equal(webRuntime.kind, 'web')
  assert.equal(webRuntime.capabilities.canStartLocalServices, false)
  assert.equal(typeof webRuntime.ollama.getServerStatus, 'function')
  assert.equal(typeof webRuntime.files.saveExportFiles, 'function')
  assert.equal(typeof webRuntime.ollama.pullModel, 'function')
  assert.equal(typeof webRuntime.localServices.beginUsage, 'function')
  assert.equal(typeof webRuntime.localServices.getManagedStatus, 'function')
})

test('web runtime local service lifecycle helpers stay inert and explicit', async () => {
  const { webRuntime } = await loadViteModule('/src/runtime/webRuntime.ts')

  await webRuntime.localServices.beginUsage('ollama')
  await webRuntime.localServices.endUsage('panelcleaner')
  assert.deepEqual(
    await webRuntime.localServices.getManagedStatus(),
    {
      panelcleaner: {
        running: false,
        ownedByApp: false,
        inFlightCount: 0,
        idleTimeoutMs: null,
        idleDeadlineAt: null,
        command: null,
        lastError: null,
      },
      ollama: {
        running: false,
        ownedByApp: false,
        inFlightCount: 0,
        idleTimeoutMs: null,
        idleDeadlineAt: null,
        command: null,
        lastError: null,
      },
    },
  )
  assert.deepEqual(
    await webRuntime.localServices.stopOwnedServices(),
    { ok: false, error: 'Web runtime cannot stop local services.' },
  )
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

test('OllamaClient reports timeout on stalled status checks', async () => {
  const { OllamaClient } = await loadViteModule('/src/services/ollama.ts')
  const client = new OllamaClient()
  const originalFetch = globalThis.fetch

  globalThis.fetch = createAbortableFetch()

  try {
    const status = await client.getStatus({
      ollamaUrl: 'http://localhost:11434',
      timeoutMs: 20,
    })

    assert.equal(status.ok, false)
    assert.match(status.error ?? '', /Ollama request timed out after 20ms/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OllamaClient pulls a local model and reports streaming progress', async () => {
  const { OllamaClient } = await loadViteModule('/src/services/ollama.ts')
  const client = new OllamaClient()
  const originalFetch = globalThis.fetch
  const progress = []
  let captured = null

  globalThis.fetch = async (url, init = {}) => {
    captured = {
      url: String(url),
      method: init.method,
      headers: init.headers,
      body: JSON.parse(String(init.body)),
    }
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('{"status":"pulling manifest"}\n'))
        controller.enqueue(encoder.encode('{"status":"downloading","digest":"sha256:abc","total":100,"completed":40}\n'))
        controller.enqueue(encoder.encode('{"status":"success"}\n'))
        controller.close()
      },
    })
    return new Response(stream, { status: 200 })
  }

  try {
    const result = await client.pullModel({
      ollamaUrl: 'http://localhost:11434/api',
      model: 'gemma3:4b',
      onProgress: (event) => progress.push(event),
    })

    assert.equal(captured.url, 'http://localhost:11434/api/pull')
    assert.equal(captured.method, 'POST')
    assert.equal(captured.headers['Content-Type'], 'application/json')
    assert.deepEqual(captured.body, { model: 'gemma3:4b', stream: true })
    assert.deepEqual(progress.map((event) => event.status), ['pulling manifest', 'downloading', 'success'])
    assert.deepEqual(result, { status: 'success' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OllamaClient reports pull network failures', async () => {
  const { OllamaClient } = await loadViteModule('/src/services/ollama.ts')
  const client = new OllamaClient()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => {
    return new Response('offline', { status: 503, statusText: 'Service Unavailable' })
  }

  try {
    await assert.rejects(
      () => client.pullModel({ ollamaUrl: 'http://localhost:11434', model: 'gemma3:4b' }),
      /Ollama error 503: offline/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
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

test('PanelCleanerClient reports timeout on stalled bridge status checks', async () => {
  const { PanelCleanerClient } = await loadViteModule('/src/services/panelcleaner-api.ts')
  const client = new PanelCleanerClient()
  const originalFetch = globalThis.fetch

  globalThis.fetch = createAbortableFetch()

  try {
    const status = await client.getStatus({
      bridgeUrl: 'http://localhost:5055',
      timeoutMs: 20,
    })

    assert.equal(status.ok, false)
    assert.match(status.error ?? '', /PanelCleaner bridge request timed out after 20ms/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
