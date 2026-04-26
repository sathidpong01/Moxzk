import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
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

test('Thai manga prompt exposes concise and faithful translation modes', () => {
  return ollamaService.then(({ buildThaiMangaRules }) => {
    const concise = buildThaiMangaRules({ enabled: false, translationMode: 'concise' })
    const faithful = buildThaiMangaRules({ enabled: false, translationMode: 'faithful' })

    assert.match(concise, /Translation mode: concise/)
    assert.match(concise, /speech-balloon friendly/)
    assert.match(concise, /Never drop negation, questions, conditions, reasons, names, relationship terms, threats, promises, or emotional tone/)
    assert.match(faithful, /Translation mode: faithful/)
    assert.match(faithful, /Stay close to the source meaning/)
  })
})

test('Ollama vision flow asks for balloonShape metadata without controlling artistic mode', () => {
  const source = fs.readFileSync('src/services/ollama.ts', 'utf8')

  assert.match(source, /balloonShape/)
  assert.match(source, /round/)
  assert.match(source, /cloud/)
  assert.match(source, /box/)
  assert.equal(/artisticFit must be one of|\"artisticFit\"/.test(source), false)
})
