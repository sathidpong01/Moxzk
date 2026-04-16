/**
 * Translation Memory — IndexedDB cache for translated text.
 * Before calling Ollama/LLM, check cache first.
 * Key = hash(originalText + sourceLang), value = translatedText.
 * TTL: 30 days, max 10,000 entries with LRU eviction.
 */

const DB_NAME = 'mg-translation-memory'
const STORE_NAME = 'translations'
const DB_VERSION = 1
const MAX_ENTRIES = 10_000
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface MemoryEntry {
  key: string
  originalText: string
  sourceLang: string
  translatedText: string
  createdAt: number
  accessedAt: number
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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
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

export async function lookupMemory(text: string, lang: string): Promise<string | null> {
  try {
    const db = await openDB()
    const key = hashKey(text, lang)

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)

      req.onsuccess = () => {
        const entry: MemoryEntry | undefined = req.result
        if (!entry) {
          resolve(null)
          return
        }

        // Check TTL
        if (Date.now() - entry.createdAt > TTL_MS) {
          store.delete(key)
          resolve(null)
          return
        }

        // Update access time (LRU)
        entry.accessedAt = Date.now()
        store.put(entry)
        resolve(entry.translatedText)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function saveMemory(text: string, lang: string, translated: string): Promise<void> {
  try {
    const db = await openDB()
    const key = hashKey(text, lang)
    const now = Date.now()

    const entry: MemoryEntry = {
      key,
      originalText: text,
      sourceLang: lang,
      translatedText: translated,
      createdAt: now,
      accessedAt: now,
    }

    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(entry)

    // Evict LRU if over limit
    const countReq = store.count()
    countReq.onsuccess = () => {
      if (countReq.result > MAX_ENTRIES) {
        const idx = store.index('accessedAt')
        const toDelete = countReq.result - MAX_ENTRIES
        let deleted = 0
        const cursor = idx.openCursor()
        cursor.onsuccess = () => {
          const c = cursor.result
          if (c && deleted < toDelete) {
            c.delete()
            deleted++
            c.continue()
          }
        }
      }
    }
  } catch (err) {
    console.warn('[translationMemory] Failed to save:', err)
  }
}

export async function getMemoryStats(): Promise<{ count: number }> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.count()
      req.onsuccess = () => resolve({ count: req.result })
      req.onerror = () => resolve({ count: 0 })
    })
  } catch {
    return { count: 0 }
  }
}

export async function clearMemory(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch (err) {
    console.warn('[translationMemory] Failed to clear:', err)
  }
}
