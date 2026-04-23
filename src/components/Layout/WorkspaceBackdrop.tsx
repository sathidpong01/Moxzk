import { useEffect, useRef } from 'react'

const DEFAULT_POINTER = { x: 0.62, y: 0.18 }

export default function WorkspaceBackdrop() {
  const backdropRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef({ x: -1, y: -1 })

  useEffect(() => {
    const backdrop = backdropRef.current
    if (!backdrop) return

    const commitPointer = (clientX: number, clientY: number) => {
      const rect = backdrop.getBoundingClientRect()
      const nextX = Math.round(Math.max(0, Math.min(rect.width, clientX - rect.left)))
      const nextY = Math.round(Math.max(0, Math.min(rect.height, clientY - rect.top)))
      if (pointerRef.current.x === nextX && pointerRef.current.y === nextY) return
      pointerRef.current = { x: nextX, y: nextY }
      backdrop.style.setProperty('--mg-pointer-x', `${nextX}px`)
      backdrop.style.setProperty('--mg-pointer-y', `${nextY}px`)
    }

    const resetPointer = () => {
      const rect = backdrop.getBoundingClientRect()
      commitPointer(rect.left + rect.width * DEFAULT_POINTER.x, rect.top + rect.height * DEFAULT_POINTER.y)
    }

    const handleMouseMove = (event: MouseEvent) => {
      commitPointer(event.clientX, event.clientY)
    }

    const handlePointerMove = (event: PointerEvent) => {
      commitPointer(event.clientX, event.clientY)
    }

    resetPointer()
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('resize', resetPointer)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('resize', resetPointer)
    }
  }, [])

  return (
    <div ref={backdropRef} className="mg-dot-backdrop" aria-hidden="true">
      <div className="mg-dot-backdrop__base" />
      <div className="mg-dot-backdrop__dots" />
      <div className="mg-dot-backdrop__glow" />
      <div className="mg-dot-backdrop__dots mg-dot-backdrop__dots--highlight" />
    </div>
  )
}
