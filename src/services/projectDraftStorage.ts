import type { AppSettings, AppStep, BrushStroke, ImageEntry, TextRegion } from '../types'
import type { RuntimeProjectDraft } from '../runtime/types'

const DB_NAME = 'mg-project-drafts'
const STORE_NAME = 'drafts'
const DRAFT_KEY = 'current-project'
const DB_VERSION = 1

export interface ProjectDraftSourceState {
  currentStep: AppStep
  imageEntries: ImageEntry[]
  activeImageId: string | null
  regions: TextRegion[]
  brushStrokes: BrushStroke[]
  cleanedImageUrl: string | null
  originalImageUrl: string | null
  settings: AppSettings
}

export function createProjectDraftSnapshot(state: ProjectDraftSourceState): RuntimeProjectDraft | null {
  if (state.currentStep === 'upload' || state.imageEntries.length === 0) return null

  const imageEntries = state.imageEntries.map((entry) => {
    if (entry.id !== state.activeImageId) return entry
    return {
      ...entry,
      originalUrl: state.originalImageUrl ?? entry.originalUrl,
      cleanedImageUrl: state.cleanedImageUrl ?? entry.cleanedImageUrl,
      regions: state.regions,
      brushStrokes: state.brushStrokes,
    }
  })

  return {
    version: 1,
    savedAt: Date.now(),
    currentStep: state.currentStep,
    activeImageId: state.activeImageId,
    imageEntries,
    regions: state.regions,
    brushStrokes: state.brushStrokes,
    cleanedImageUrl: state.cleanedImageUrl,
    originalImageUrl: state.originalImageUrl,
    settings: state.settings,
  }
}

export async function saveProjectDraft(draft: RuntimeProjectDraft): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(draft, DRAFT_KEY)
  } catch (err) {
    console.warn('[projectDraft] Failed to save:', err)
  }
}

export async function loadProjectDraft(): Promise<RuntimeProjectDraft | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY)
      req.onsuccess = () => resolve(normalizeDraft(req.result))
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function clearProjectDraft(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(DRAFT_KEY)
  } catch {
    // ignore unavailable storage
  }
}

function normalizeDraft(value: unknown): RuntimeProjectDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Partial<RuntimeProjectDraft>
  if (draft.version !== 1 || !Array.isArray(draft.imageEntries)) return null
  return draft as RuntimeProjectDraft
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
