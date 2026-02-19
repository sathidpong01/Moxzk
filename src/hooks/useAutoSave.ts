/**
 * Auto-save draft to IndexedDB every intervalMs.
 * Saves regions, brushStrokes, activeImageId, and imageEntries metadata.
 * On app reload, can restore from draft.
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'

const DB_NAME = 'mg-autosave'
const STORE_NAME = 'drafts'
const DRAFT_KEY = 'current-draft'
const DB_VERSION = 1

interface DraftData {
  regions: unknown[]
  brushStrokes: unknown[]
  activeImageId: string | null
  cleanedImageUrl: string | null
  savedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDraft(data: DraftData): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, DRAFT_KEY)
  } catch (err) {
    console.warn('[autoSave] Failed:', err)
  }
}

export async function loadDraft(): Promise<DraftData | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(DRAFT_KEY)
  } catch {
    // ignore
  }
}

export function useAutoSave(intervalMs = 30_000): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const state = useAppStore.getState()
      // Only save when in edit step with regions
      if (state.currentStep !== 'edit') return
      if (state.regions.length === 0 && state.brushStrokes.length === 0) return

      const draft: DraftData = {
        regions: state.regions,
        brushStrokes: state.brushStrokes,
        activeImageId: state.activeImageId,
        cleanedImageUrl: state.cleanedImageUrl,
        savedAt: Date.now(),
      }

      saveDraft(draft)
      console.log('[autoSave] Draft saved', new Date().toLocaleTimeString())
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [intervalMs])
}
