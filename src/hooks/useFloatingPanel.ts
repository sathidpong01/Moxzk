import { useCallback, useEffect, useRef, useState } from 'react'
import type { FloatingPanelPosition } from '../types'

const STORAGE_PREFIX = 'mg-panel-'

interface UseFloatingPanelOptions {
  id: string
  defaultPosition: { x: number; y: number }
  defaultVisible?: boolean
}

interface UseFloatingPanelReturn {
  position: { x: number; y: number }
  visible: boolean
  toggleVisible: (show?: boolean) => void
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void
    style: React.CSSProperties
  }
  panelStyle: React.CSSProperties
}

function loadPanelState(id: string): FloatingPanelPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function savePanelState(id: string, state: FloatingPanelPosition): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable
  }
}

export function useFloatingPanel({
  id,
  defaultPosition,
  defaultVisible = true,
}: UseFloatingPanelOptions): UseFloatingPanelReturn {
  const saved = useRef(loadPanelState(id))
  const [position, setPosition] = useState(
    saved.current ? { x: saved.current.x, y: saved.current.y } : defaultPosition,
  )
  const [visible, setVisible] = useState(saved.current?.visible ?? defaultVisible)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Persist on change
  useEffect(() => {
    savePanelState(id, { x: position.x, y: position.y, visible })
  }, [id, position, visible])

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.max(0, Math.min(window.innerWidth - 60, prev.x)),
        y: Math.max(0, Math.min(window.innerHeight - 40, prev.y)),
      }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleVisible = useCallback(
    (show?: boolean) => {
      setVisible((prev) => show ?? !prev)
    },
    [],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isDragging.current = true
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const newX = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dragOffset.current.x))
        const newY = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dragOffset.current.y))
        setPosition({ x: newX, y: newY })
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [position],
  )

  const dragHandleProps = {
    onMouseDown: handleMouseDown,
    style: { cursor: 'grab', userSelect: 'none' as const },
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 50,
    display: visible ? undefined : 'none',
  }

  return { position, visible, toggleVisible, dragHandleProps, panelStyle }
}
