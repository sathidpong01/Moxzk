/**
 * IndexedDB-based image cache with LRU eviction.
 * Key = R2 object key, Value = Blob + metadata
 * Stale-while-revalidate: use cache first, refresh if > 7 days
 */

const DB_NAME = 'moxzk-cache'
const LEGACY_DB_NAME = 'mg-translater-cache'
const DB_VERSION = 1
const STORE_NAME = 'images'
const MAX_CACHE_BYTES = 500 * 1024 * 1024 // 500MB
const STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface ImageCacheEntry {
  key: string
  blob: Blob
  size: number
  lastAccessed: number
  createdAt: number
}

export interface ImageCacheStore {
  get(key: string): Promise<ImageCacheEntry | null>
  put(entry: ImageCacheEntry): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  list(): Promise<ImageCacheEntry[]>
}

export interface ImageCacheServiceOptions {
  store?: ImageCacheStore
  maxBytes?: number
  staleMs?: number
  now?: () => number
  logger?: Pick<Console, 'log' | 'warn'>
}

class IndexedDbImageCacheStore implements ImageCacheStore {
  async get(key: string): Promise<ImageCacheEntry | null> {
    const entry = await this.getFromDb(DB_NAME, key)
    return entry ?? this.getFromDb(LEGACY_DB_NAME, key)
  }

  private async getFromDb(dbName: string, key: string): Promise<ImageCacheEntry | null> {
    const db = await this.openDB(dbName)
    return new Promise((resolve) => {
      const req = this.txStore(db, 'readonly').get(key)
      req.onsuccess = () => resolve((req.result as ImageCacheEntry | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  }

  async put(entry: ImageCacheEntry): Promise<void> {
    const db = await this.openDB(DB_NAME)
    return new Promise((resolve, reject) => {
      const req = this.txStore(db, 'readwrite').put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async delete(key: string): Promise<void> {
    await Promise.all([DB_NAME, LEGACY_DB_NAME].map(async (dbName) => {
      const db = await this.openDB(dbName)
      return new Promise<void>((resolve) => {
        const req = this.txStore(db, 'readwrite').delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
      })
    }))
  }

  async clear(): Promise<void> {
    await Promise.all([DB_NAME, LEGACY_DB_NAME].map(async (dbName) => {
      const db = await this.openDB(dbName)
      return new Promise<void>((resolve) => {
        const req = this.txStore(db, 'readwrite').clear()
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
      })
    }))
  }

  async list(): Promise<ImageCacheEntry[]> {
    const lists = await Promise.all([DB_NAME, LEGACY_DB_NAME].map((dbName) => this.listFromDb(dbName)))
    return Array.from(new Map(lists.flat().map((entry) => [entry.key, entry])).values())
  }

  private async listFromDb(dbName: string): Promise<ImageCacheEntry[]> {
    const db = await this.openDB(dbName)
    return new Promise((resolve) => {
      const store = this.txStore(db, 'readonly')
      const items: ImageCacheEntry[] = []
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (c) {
          items.push(c.value as ImageCacheEntry)
          c.continue()
        } else {
          resolve(items)
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
          store.createIndex('lastAccessed', 'lastAccessed')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
  }
}

export class ImageCacheService {
  private readonly store: ImageCacheStore
  private readonly maxBytes: number
  private readonly staleMs: number
  private readonly now: () => number
  private readonly logger: Pick<Console, 'log' | 'warn'>

  constructor(options: ImageCacheServiceOptions = {}) {
    this.store = options.store ?? new IndexedDbImageCacheStore()
    this.maxBytes = options.maxBytes ?? MAX_CACHE_BYTES
    this.staleMs = options.staleMs ?? STALE_MS
    this.now = options.now ?? Date.now
    this.logger = options.logger ?? console
  }

  async get(key: string): Promise<Blob | null> {
    try {
      const entry = await this.store.get(key)
      if (!entry) return null
      await this.store.put({ ...entry, lastAccessed: this.now() })
      return entry.blob
    } catch {
      return null
    }
  }

  async isStale(key: string): Promise<boolean> {
    try {
      const entry = await this.store.get(key)
      if (!entry) return true
      return this.now() - entry.createdAt > this.staleMs
    } catch {
      return true
    }
  }

  async put(key: string, blob: Blob): Promise<void> {
    try {
      await this.evictIfNeeded(blob.size)
      const now = this.now()
      await this.store.put({
        key,
        blob,
        size: blob.size,
        lastAccessed: now,
        createdAt: now,
      })
    } catch (e) {
      this.logger.warn('[imageCache] putCache failed:', e)
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.store.delete(key)
    } catch {
      // ignore cache deletion failures
    }
  }

  async clear(): Promise<void> {
    try {
      await this.store.clear()
    } catch {
      // ignore cache deletion failures
    }
  }

  async getSize(): Promise<number> {
    try {
      return (await this.store.list()).reduce((total, entry) => total + entry.size, 0)
    } catch {
      return 0
    }
  }

  private async evictIfNeeded(incomingSize: number): Promise<void> {
    const entries = await this.store.list()
    const currentSize = entries.reduce((total, entry) => total + entry.size, 0)
    if (currentSize + incomingSize <= this.maxBytes) return

    const target = currentSize + incomingSize - this.maxBytes
    let freed = 0
    const keysToDelete: string[] = []
    for (const entry of [...entries].sort((a, b) => a.lastAccessed - b.lastAccessed)) {
      if (freed >= target) break
      keysToDelete.push(entry.key)
      freed += entry.size
    }

    for (const key of keysToDelete) {
      await this.store.delete(key)
    }
    if (keysToDelete.length > 0) {
      this.logger.log(`[imageCache] LRU evicted ${keysToDelete.length} entries (${(freed / 1024 / 1024).toFixed(1)}MB)`)
    }
  }
}

const defaultImageCacheService = new ImageCacheService()

/** Get cached blob by key. Returns null if not found. */
export async function getCached(key: string): Promise<Blob | null> {
  return defaultImageCacheService.get(key)
}

/** Check if a cached entry is stale (> 7 days old) */
export async function isStale(key: string): Promise<boolean> {
  return defaultImageCacheService.isStale(key)
}

/** Store blob in cache. Runs LRU eviction if over size limit. */
export async function putCache(key: string, blob: Blob): Promise<void> {
  return defaultImageCacheService.put(key, blob)
}

/** Remove a single key from cache */
export async function removeCache(key: string): Promise<void> {
  return defaultImageCacheService.remove(key)
}

/** Clear entire cache */
export async function clearCache(): Promise<void> {
  return defaultImageCacheService.clear()
}

/** Get total cache size in bytes */
export async function getCacheSize(): Promise<number> {
  return defaultImageCacheService.getSize()
}
