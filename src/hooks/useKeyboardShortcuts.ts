/**
 * Global keyboard shortcuts for the editor.
 * Only active when currentStep === 'edit'.
 */

import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export interface ShortcutDef {
  key: string
  ctrl?: boolean
  shift?: boolean
  label: string
  action: string
}

export const SHORTCUT_LIST: ShortcutDef[] = [
  { key: 'z', ctrl: true, label: 'Ctrl+Z', action: 'Undo brush stroke' },
  { key: 'z', ctrl: true, shift: true, label: 'Ctrl+Shift+Z', action: 'Redo' },
  { key: 's', ctrl: true, label: 'Ctrl+S', action: 'Save (prevent default)' },
  { key: 'b', label: 'B', action: 'Brush tool' },
  { key: 'e', label: 'E', action: 'Eraser' },
  { key: 'v', label: 'V', action: 'Select tool' },
  { key: 'i', label: 'I', action: 'Eyedropper' },
  { key: '[', label: '[', action: 'ลด brush size' },
  { key: ']', label: ']', action: 'เพิ่ม brush size' },
  { key: 'Escape', label: 'Esc', action: 'Deselect / ปิด modal' },
  { key: 'Delete', label: 'Del', action: 'ลบ region ที่เลือก' },
]

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = useAppStore.getState()
      if (state.currentStep !== 'edit') return

      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey

      // Ctrl+Z / Ctrl+Shift+Z — Undo / Redo brush strokes
      if (ctrl && e.key === 'z') {
        e.preventDefault()
        if (shift) {
          state.redoBrushStroke()
        } else {
          state.undoBrushStroke()
        }
        return
      }

      // Ctrl+S — prevent browser save dialog
      if (ctrl && e.key === 's') {
        e.preventDefault()
        return
      }

      // Single-key shortcuts (no ctrl)
      if (ctrl) return

      switch (e.key) {
        case 'b':
        case 'B':
          state.setActiveTool('brush')
          break
        case 'e':
        case 'E':
          state.setActiveTool('eraser')
          break
        case 'v':
        case 'V':
          state.setActiveTool('select')
          state.selectRegion(null)
          break
        case 'i':
        case 'I':
          state.setActiveTool('eyedropper')
          break
        case '[': {
          const size = Math.max(1, (state.brushSize ?? 10) - 2)
          state.setBrushSize(size)
          break
        }
        case ']': {
          const size = Math.min(100, (state.brushSize ?? 10) + 2)
          state.setBrushSize(size)
          break
        }
        case 'Escape':
          state.selectRegion(null)
          break
        case 'Delete':
        case 'Backspace': {
          if (state.selectedRegionId) {
            state.deleteRegion(state.selectedRegionId)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
