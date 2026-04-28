/**
 * Translation Memory - IndexedDB cache for translated text.
 * Before calling Ollama/LLM, check cache first.
 * Key = hash(originalText + sourceLang), value = translatedText.
 * TTL: 30 days, max 10,000 entries with LRU eviction.
 */

const DB_NAME = 'moxzk-translation-memory'
const LEGACY_DB_NAME = 'mg-translation-memory'
const STORE_NAME = 'translations'
const DB_VERSION = 1
const MAX_ENTRIES = 10_000
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface TranslationMemoryEntry {
  key: string
  originalText: string
  sourceLang: string
  translatedText: string
  createdAt: number
  accessedAt: number
}

export interface TranslationMemoryStore {
  get(key: string): Promise<TranslationMemoryEntry | null>
  put(entry: TranslationMemoryEntry): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  count(): Promise<number>
  listByAccessed(): Promise<TranslationMemoryEntry[]>
}

export interface TranslationMemoryServiceOptions {
  store?: TranslationMemoryStore
  maxEntries?: number
  ttlMs?: number
  now?: () => number
  logger?: Pick<Console, 'warn'>
}

class IndexedDbTranslationMemoryStore implements TranslationMemoryStore {
  async get(key: string): Promise<TranslationMemoryEntry | null> {
    const entry = await this.getFromDb(DB_NAME, key)
    return entry ?? this.getFromDb(LEGACY_DB_NAME, key)
  }

  private async getFromDb(dbName: string, key: string): Promise<TranslationMemoryEntry | null> {
    const db = await this.openDB(dbName)
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve((req.result as TranslationMemoryEntry | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  }

  async put(entry: TranslationMemoryEntry): Promise<void> {
    const db = await this.openDB(DB_NAME)
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async delete(key: string): Promise<void> {
    await Promise.all([DB_NAME, LEGACY_DB_NAME].map(async (dbName) => {
      const db = await this.openDB(dbName)
      return new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
      })
    }))
  }

  async clear(): Promise<void> {
    await Promise.all([DB_NAME, LEGACY_DB_NAME].map(async (dbName) => {
      const db = await this.openDB(dbName)
      return new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).clear()
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
      })
    }))
  }

  async count(): Promise<number> {
    const counts = await Promise.all([DB_NAME, LEGACY_DB_NAME].map((dbName) => this.countFromDb(dbName)))
    return counts.reduce((sum, count) => sum + count, 0)
  }

  private async countFromDb(dbName: string): Promise<number> {
    const db = await this.openDB(dbName)
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(0)
    })
  }

  async listByAccessed(): Promise<TranslationMemoryEntry[]> {
    const lists = await Promise.all([DB_NAME, LEGACY_DB_NAME].map((dbName) => this.listByAccessedFromDb(dbName)))
    return Array.from(new Map(lists.flat().map((entry) => [entry.key, entry])).values())
  }

  private async listByAccessedFromDb(dbName: string): Promise<TranslationMemoryEntry[]> {
    const db = await this.openDB(dbName)
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const idx = tx.objectStore(STORE_NAME).index('accessedAt')
      const entries: TranslationMemoryEntry[] = []
      const cursor = idx.openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (c) {
          entries.push(c.value as TranslationMemoryEntry)
          c.continue()
        } else {
          resolve(entries)
        }
      }
      cursor.onerror = () => resolve([])
    })
  }

  private openDB(dbName = DB_NAME): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          store.createIndex('accessedAt', 'accessedAt')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
}

export class TranslationMemoryService {
  private readonly store: TranslationMemoryStore
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly now: () => number
  private readonly logger: Pick<Console, 'warn'>

  constructor(options: TranslationMemoryServiceOptions = {}) {
    this.store = options.store ?? new IndexedDbTranslationMemoryStore()
    this.maxEntries = options.maxEntries ?? MAX_ENTRIES
    this.ttlMs = options.ttlMs ?? TTL_MS
    this.now = options.now ?? Date.now
    this.logger = options.logger ?? console
  }

  async lookup(text: string, lang: string): Promise<string | null> {
    try {
      const key = hashKey(text, lang)
      const entry = await this.store.get(key)
      if (!entry) return null

      if (this.now() - entry.createdAt > this.ttlMs) {
        await this.store.delete(key)
        return null
      }

      await this.store.put({ ...entry, accessedAt: this.now() })
      return entry.translatedText
    } catch {
      return null
    }
  }

  async save(text: string, lang: string, translated: string): Promise<void> {
    try {
      const now = this.now()
      await this.store.put({
        key: hashKey(text, lang),
        originalText: text,
        sourceLang: lang,
        translatedText: translated,
        createdAt: now,
        accessedAt: now,
      })
      await this.evictIfNeeded()
    } catch (err) {
      this.logger.warn('[translationMemory] Failed to save:', err)
    }
  }

  async stats(): Promise<{ count: number }> {
    try {
      return { count: await this.store.count() }
    } catch {
      return { count: 0 }
    }
  }

  async clear(): Promise<void> {
    try {
      await this.store.clear()
    } catch (err) {
      this.logger.warn('[translationMemory] Failed to clear:', err)
    }
  }

  private async evictIfNeeded(): Promise<void> {
    const count = await this.store.count()
    if (count <= this.maxEntries) return

    let deleted = 0
    const toDelete = count - this.maxEntries
    for (const entry of await this.store.listByAccessed()) {
      if (deleted >= toDelete) break
      await this.store.delete(entry.key)
      deleted += 1
    }
  }
}

function hashKey(text: string, lang: string): string {
  // Simple FNV-1a-like hash for fast lookup
  let hash = 2166136261
  const input = `${lang}:${text}`
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const defaultTranslationMemoryService = new TranslationMemoryService()

export async function lookupMemory(text: string, lang: string): Promise<string | null> {
  return defaultTranslationMemoryService.lookup(text, lang)
}

export async function saveMemory(text: string, lang: string, translated: string): Promise<void> {
  return defaultTranslationMemoryService.save(text, lang, translated)
}

export async function getMemoryStats(): Promise<{ count: number }> {
  return defaultTranslationMemoryService.stats()
}

export async function clearMemory(): Promise<void> {
  return defaultTranslationMemoryService.clear()
}
