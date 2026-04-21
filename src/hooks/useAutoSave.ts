/**
 * Auto-save draft to IndexedDB every intervalMs.
 * Saves project draft with all pages, active regions, brush strokes, settings,
 * and file references that IndexedDB can structured-clone.
 * On app reload, can restore from draft.
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import {
  clearProjectDraft,
  createProjectDraftSnapshot,
  loadProjectDraft,
  saveProjectDraft,
} from '../services/projectDraftStorage'
import type { RuntimeProjectDraft } from '../runtime/types'

export const loadDraft = loadProjectDraft
export const clearDraft = clearProjectDraft

export function useAutoSave(intervalMs = 30_000): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const state = useAppStore.getState()
      const draft = createProjectDraftSnapshot({
        currentStep: state.currentStep,
        imageEntries: state.imageEntries,
        activeImageId: state.activeImageId,
        regions: state.regions,
        brushStrokes: state.brushStrokes,
        cleanedImageUrl: state.cleanedImageUrl,
        originalImageUrl: state.originalImageUrl,
        settings: state.settings,
      })

      if (!draft) return

      void saveProjectDraft(draft)
      console.log('[autoSave] Draft saved', new Date().toLocaleTimeString())
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [intervalMs])
}

export type { RuntimeProjectDraft as DraftData }
