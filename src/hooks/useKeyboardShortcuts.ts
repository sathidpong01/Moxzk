/**
 * Global keyboard shortcuts for the editor.
 * Only active when currentStep === 'edit'.
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import type { ActiveTool } from '../types'

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
  { key: 'Escape', label: 'Esc', action: 'Deselect / ปิด overlay' },
  { key: 'Delete', label: 'Del', action: 'ลบ region ที่เลือก' },
]

interface ShortcutHandlers {
  onSave?: () => void
  onExport?: () => void
  onStartAI?: () => void
}

function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable ||
    Boolean(el.closest('[role="textbox"]'))
  )
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}): void {
  const handlersRef = useRef(handlers)
  const heldToolRef = useRef<ActiveTool | null>(null)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = useAppStore.getState()
      if (state.currentStep !== 'edit') return

      if (shouldIgnoreShortcut(e.target)) return

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

      if (ctrl && e.key === 'y') {
        e.preventDefault()
        state.redoBrushStroke()
        return
      }

      if (ctrl && e.key === 's') {
        e.preventDefault()
        handlersRef.current.onSave?.()
        return
      }

      if (ctrl && e.key === 'Enter') {
        e.preventDefault()
        handlersRef.current.onExport?.()
        return
      }

      if (ctrl && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handlersRef.current.onStartAI?.()
        return
      }

      // Single-key shortcuts (no ctrl)
      if (ctrl) return

      switch (e.key) {
        case ' ': {
          if (!e.repeat && state.activeTool !== 'pan') {
            e.preventDefault()
            heldToolRef.current = state.activeTool
            state.setActiveTool('pan')
          }
          break
        }
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
          const size = Math.min(50, (state.brushSize ?? 10) + 2)
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

    function handleKeyUp(e: KeyboardEvent) {
      const state = useAppStore.getState()
      if (state.currentStep !== 'edit') return
      if (e.key === ' ' && heldToolRef.current) {
        e.preventDefault()
        state.setActiveTool(heldToolRef.current)
        heldToolRef.current = null
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
}
