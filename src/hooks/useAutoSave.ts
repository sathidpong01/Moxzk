import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { createProjectDraftSnapshot } from '../services/projectDraftStorage'
import { getAppRuntime } from '../runtime'
import type { RuntimeProjectDraft } from '../runtime/types'

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

      void getAppRuntime().projectDraft.save(draft)
      console.log('[autoSave] Draft saved', new Date().toLocaleTimeString())
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [intervalMs])
}

export type { RuntimeProjectDraft as DraftData }
