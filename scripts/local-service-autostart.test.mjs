import test from 'node:test'
import assert from 'node:assert/strict'
import { autoStartRequiredLocalServices, isLocalServiceUrl } from '../src/services/localServiceAutoStart.ts'

function createRuntime(overrides = {}) {
  const calls = []
  const runtime = {
    capabilities: {
      canStartLocalServices: true,
    },
    localServices: {
      async startPanelCleanerBridge() {
        calls.push('panelcleaner')
        return { ok: true }
      },
      async startOllama() {
        calls.push('ollama')
        return { ok: true }
      },
    },
    panelCleaner: {
      async getStatus() {
        calls.push('panelcleaner-status')
        return { ok: true }
      },
    },
    ...overrides,
  }
  return { runtime, calls }
}

test('isLocalServiceUrl accepts loopback hosts only', () => {
  assert.equal(isLocalServiceUrl(''), true)
  assert.equal(isLocalServiceUrl('http://localhost:11434'), true)
  assert.equal(isLocalServiceUrl('http://127.0.0.1:5055'), true)
  assert.equal(isLocalServiceUrl('http://[::1]:11434'), true)
  assert.equal(isLocalServiceUrl('https://example.com'), false)
  assert.equal(isLocalServiceUrl('not-a-url'), false)
})

test('clean-only startup only starts panelcleaner', async () => {
  const { runtime, calls } = createRuntime()
  const result = await autoStartRequiredLocalServices({
    runtime,
    settings: {
      panelCleanerBridgeUrl: 'http://localhost:5055',
      panelCleanerExecutablePath: '',
      ollamaUrl: 'http://localhost:11434',
    },
    mode: 'clean_only',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls, ['panelcleaner', 'panelcleaner-status'])
})

test('translate startup can skip cleanup and only start ollama', async () => {
  const { runtime, calls } = createRuntime()
  const result = await autoStartRequiredLocalServices({
    runtime,
    settings: {
      panelCleanerBridgeUrl: 'http://localhost:5055',
      panelCleanerExecutablePath: '',
      ollamaUrl: 'http://localhost:11434',
    },
    mode: 'gemma_vision_full',
    needsCleanup: false,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls, ['ollama'])
})

test('remote endpoints do not trigger local startup helpers', async () => {
  const { runtime, calls } = createRuntime()
  const result = await autoStartRequiredLocalServices({
    runtime,
    settings: {
      panelCleanerBridgeUrl: 'https://cleanup.example.com',
      panelCleanerExecutablePath: '',
      ollamaUrl: 'https://ollama.example.com',
    },
    mode: 'gemma_vision_full',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls, [])
})

test('panelcleaner startup failure stops the chain and returns the error', async () => {
  const { runtime, calls } = createRuntime({
    localServices: {
      async startPanelCleanerBridge() {
        calls.push('panelcleaner')
        return { ok: false, error: 'bridge failed' }
      },
      async startOllama() {
        calls.push('ollama')
        return { ok: true }
      },
    },
  })

  const result = await autoStartRequiredLocalServices({
    runtime,
    settings: {
      panelCleanerBridgeUrl: 'http://localhost:5055',
      panelCleanerExecutablePath: '',
      ollamaUrl: 'http://localhost:11434',
    },
    mode: 'gemma_vision_full',
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, 'bridge failed')
  assert.deepEqual(calls, ['panelcleaner'])
})
