/**
 * IndexedDB-based image cache with LRU eviction.
 * Key = R2 object key, Value = Blob + metadata
 * Stale-while-revalidate: use cache first, refresh if > 7 days
 */

const DB_NAME = 'mg-translater-cache'
const DB_VERSION = 1
const STORE_NAME = 'images'
const MAX_CACHE_BYTES = 500 * 1024 * 1024 // 500MB
const STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry {
  key: string
  blob: Blob
  size: number
  lastAccessed: number
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('lastAccessed', 'lastAccessed')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

/** Get cached blob by key. Returns null if not found. */
export async function getCached(key: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const store = txStore(db, 'readwrite')
      const req = store.get(key)
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined
        if (!entry) {
          resolve(null)
          return
        }
        // Update lastAccessed (LRU touch)
        entry.lastAccessed = Date.now()
        store.put(entry)
        resolve(entry.blob)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** Check if a cached entry is stale (> 7 days old) */
export async function isStale(key: string): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const req = txStore(db, 'readonly').get(key)
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined
        if (!entry) {
          resolve(true)
          return
        }
        resolve(Date.now() - entry.createdAt > STALE_MS)
      }
      req.onerror = () => resolve(true)
    })
  } catch {
    return true
  }
}

/** Store blob in cache. Runs LRU eviction if over size limit. */
export async function putCache(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()

    // Evict if necessary
    await evictIfNeeded(db, blob.size)

    const entry: CacheEntry = {
      key,
      blob,
      size: blob.size,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const req = txStore(db, 'readwrite').put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('[imageCache] putCache failed:', e)
  }
}

/** Remove a single key from cache */
export async function removeCache(key: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const req = txStore(db, 'readwrite').delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

/** Clear entire cache */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const req = txStore(db, 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

/** Get total cache size in bytes */
export async function getCacheSize(): Promise<number> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const store = txStore(db, 'readonly')
      let total = 0
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (c) {
          total += (c.value as CacheEntry).size
          c.continue()
        } else {
          resolve(total)
        }
      }
      cursor.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

/** LRU eviction: remove oldest-accessed entries until under limit */
async function evictIfNeeded(db: IDBDatabase, incomingSize: number): Promise<void> {
  const currentSize = await new Promise<number>((resolve) => {
    const store = txStore(db, 'readonly')
    let total = 0
    const cursor = store.openCursor()
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) {
        total += (c.value as CacheEntry).size
        c.continue()
      } else {
        resolve(total)
      }
    }
    cursor.onerror = () => resolve(0)
  })

  if (currentSize + incomingSize <= MAX_CACHE_BYTES) return

  // Collect all entries sorted by lastAccessed (oldest first)
  const entries = await new Promise<CacheEntry[]>((resolve) => {
    const store = txStore(db, 'readonly')
    const idx = store.index('lastAccessed')
    const items: CacheEntry[] = []
    const cursor = idx.openCursor()
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) {
        items.push(c.value as CacheEntry)
        c.continue()
      } else {
        resolve(items)
      }
    }
    cursor.onerror = () => resolve([])
  })

  let freed = 0
  const target = currentSize + incomingSize - MAX_CACHE_BYTES
  const keysToDelete: string[] = []

  for (const entry of entries) {
    if (freed >= target) break
    keysToDelete.push(entry.key)
    freed += entry.size
  }

  if (keysToDelete.length > 0) {
    const store = txStore(db, 'readwrite')
    for (const k of keysToDelete) {
      store.delete(k)
    }
    console.log(`[imageCache] LRU evicted ${keysToDelete.length} entries (${(freed / 1024 / 1024).toFixed(1)}MB)`)
  }
}
