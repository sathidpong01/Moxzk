import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

async function loadOllamaService() {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  try {
    return await server.ssrLoadModule('/src/services/ollama.ts')
  } finally {
    await server.close()
  }
}

const ollamaService = loadOllamaService()

test('Thai manga prompt keeps translated text editable instead of hard-wrapped', () => {
  return ollamaService.then(({ buildThaiMangaRules }) => {
    const rules = buildThaiMangaRules()

    assert.match(rules, /Do not hard-wrap translated text/)
    assert.match(rules, /one editable string/)
    assert.match(rules, /Use \\n only for intentional line breaks/)
  })
})
