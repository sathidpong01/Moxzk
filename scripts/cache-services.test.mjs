import test from 'node:test'
import assert from 'node:assert/strict'
import { ImageCacheService } from '../src/services/imageCache.ts'
import { TranslationMemoryService } from '../src/services/translationMemory.ts'

class MemoryImageStore {
  entries = new Map()

  async get(key) {
    return this.entries.get(key) ?? null
  }

  async put(entry) {
    this.entries.set(entry.key, { ...entry })
  }

  async delete(key) {
    this.entries.delete(key)
  }

  async clear() {
    this.entries.clear()
  }

  async list() {
    return [...this.entries.values()].map((entry) => ({ ...entry }))
  }
}

class MemoryTranslationStore {
  entries = new Map()

  async get(key) {
    return this.entries.get(key) ?? null
  }

  async put(entry) {
    this.entries.set(entry.key, { ...entry })
  }

  async delete(key) {
    this.entries.delete(key)
  }

  async clear() {
    this.entries.clear()
  }

  async count() {
    return this.entries.size
  }

  async listByAccessed() {
    return [...this.entries.values()]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.accessedAt - b.accessedAt)
  }
}

const silentLogger = {
  log: () => {},
  warn: () => {},
}

test('ImageCacheService touches hits and evicts least recently used entries', async () => {
  const store = new MemoryImageStore()
  let now = 1_000
  const service = new ImageCacheService({
    store,
    maxBytes: 10,
    staleMs: 100,
    now: () => now,
    logger: silentLogger,
  })

  await service.put('old', new Blob(['12345']))
  now += 10
  await service.put('new', new Blob(['1234']))
  now += 10
  assert.ok(await service.get('new'))
  now += 10
  await service.put('incoming', new Blob(['12345']))

  assert.equal(await service.get('old'), null)
  assert.ok(await service.get('new'))
  assert.ok(await service.get('incoming'))
})

test('ImageCacheService reports stale entries from injected clock', async () => {
  const store = new MemoryImageStore()
  let now = 1_000
  const service = new ImageCacheService({
    store,
    staleMs: 50,
    now: () => now,
    logger: silentLogger,
  })

  await service.put('page-1', new Blob(['image']))
  assert.equal(await service.isStale('page-1'), false)
  now += 51
  assert.equal(await service.isStale('page-1'), true)
})

test('TranslationMemoryService expires old entries and evicts least recently used entries', async () => {
  const store = new MemoryTranslationStore()
  let now = 5_000
  const service = new TranslationMemoryService({
    store,
    maxEntries: 2,
    ttlMs: 100,
    now: () => now,
    logger: silentLogger,
  })

  await service.save('one', 'ja', 'หนึ่ง')
  now += 10
  await service.save('two', 'ja', 'สอง')
  now += 10
  assert.equal(await service.lookup('one', 'ja'), 'หนึ่ง')
  now += 10
  await service.save('three', 'ja', 'สาม')

  assert.equal(await service.lookup('two', 'ja'), null)
  assert.equal(await service.lookup('one', 'ja'), 'หนึ่ง')
  assert.equal(await service.lookup('three', 'ja'), 'สาม')

  now += 101
  assert.equal(await service.lookup('one', 'ja'), null)
})
