import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getAppRuntime } from '../../runtime'
import type { AppRuntime, RuntimeWindowState } from '../../runtime'

const DEFAULT_WINDOW_STATE: RuntimeWindowState = {
  isMaximized: false,
}

export default function AppChromeBar() {
  const runtime = useMemo<AppRuntime>(() => getAppRuntime(), [])
  const [windowState, setWindowState] = useState<RuntimeWindowState>(DEFAULT_WINDOW_STATE)

  const canUseWindowControls = runtime.kind === 'electron' && runtime.capabilities.canUseCustomWindowControls

  useEffect(() => {
    if (!canUseWindowControls) return
    let mounted = true
    runtime.windowControls.getState()
      .then((state) => {
        if (mounted) setWindowState(state)
      })
      .catch((error) => {
        console.warn('[window-controls] Failed to read window state:', error)
      })

    const cleanup = runtime.windowControls.onStateChange((state) => {
      setWindowState(state)
    })
    return () => {
      mounted = false
      cleanup()
    }
  }, [canUseWindowControls, runtime])

  if (!canUseWindowControls) return null

  const handleMinimize = () => {
    void runtime.windowControls.minimize().then((result) => {
      if (!result.ok) console.warn('[window-controls] Minimize failed:', result.error)
    })
  }

  const handleToggleMaximize = () => {
    void runtime.windowControls.toggleMaximize()
      .then(setWindowState)
      .catch((error) => {
        console.warn('[window-controls] Toggle maximize failed:', error)
      })
  }

  const handleClose = () => {
    void runtime.windowControls.close().then((result) => {
      if (!result.ok) console.warn('[window-controls] Close failed:', result.error)
    })
  }

  return (
    <>
      <div className="moxzk-chrome-divider" aria-hidden="true" />
      <div className="moxzk-window-controls">
        <button className="moxzk-window-control" type="button" aria-label="Minimize" title="Minimize" onClick={handleMinimize}>
          <Minus size={13} />
        </button>
        <button
          className="moxzk-window-control"
          type="button"
          aria-label={windowState.isMaximized ? 'Restore' : 'Maximize'}
          title={windowState.isMaximized ? 'Restore' : 'Maximize'}
          onClick={handleToggleMaximize}
        >
          {windowState.isMaximized ? <Copy size={12} /> : <Square size={11} />}
        </button>
        <button className="moxzk-window-control moxzk-window-control-close" type="button" aria-label="Close" title="Close" onClick={handleClose}>
          <X size={14} />
        </button>
      </div>
    </>
  )
}
