import { useEffect, useState } from 'react'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'
import { getQuota, getUsagePercent, type GeminiTier } from '../../services/geminiQuota'
import { useAppStore } from '../../store/appStore'
import { GripVertical, X, Sparkles } from 'lucide-react'

const TIER_LABELS: Record<GeminiTier, string> = {
  free: 'Free',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  unknown: '—',
}

const TIER_COLORS: Record<GeminiTier, string> = {
  free: 'badge-warning',
  tier1: 'badge-info',
  tier2: 'badge-success',
  tier3: 'badge-primary',
  unknown: 'badge-ghost',
}

export default function FloatingQuotaBar() {
  const { position, dragHandleProps } = useFloatingPanel({
    id: 'quota-bar',
    defaultPosition: { x: window.innerWidth - 360, y: window.innerHeight - 80 },
    defaultVisible: true,
  })
  // Override panelStyle: visibility is controlled by store, not hook
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 50,
  }
  const togglePanel = useAppStore((s) => s.togglePanel)

  const [quota, setQuota] = useState(getQuota())
  const [percent, setPercent] = useState(getUsagePercent())

  // Poll quota every 3 seconds (in case it changes from another component)
  useEffect(() => {
    const interval = setInterval(() => {
      setQuota(getQuota())
      setPercent(getUsagePercent())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const barColor =
    percent >= 80 ? 'progress-error' :
    percent >= 50 ? 'progress-warning' :
    'progress-primary'

  const textColor =
    percent >= 80 ? 'text-error' :
    percent >= 50 ? 'text-warning' :
    'text-base-content/70'

  return (
    <div style={panelStyle} className="floating-panel-sm px-3 py-2 panel-enter min-w-[320px]">
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <div {...dragHandleProps} className="drag-handle shrink-0">
          <GripVertical size={12} className="text-base-content/20" />
        </div>

        {/* Gemini icon + label */}
        <Sparkles size={12} className="text-primary shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
          Gemini
        </span>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2">
          <progress
            className={`progress ${barColor} h-2 flex-1`}
            value={quota.used}
            max={quota.limit}
          />
          <span className={`text-xs font-mono tabular-nums ${textColor}`}>
            {quota.used}/{quota.limit}
          </span>
        </div>

        {/* Tier badge */}
        <span className={`badge badge-xs ${TIER_COLORS[quota.tier]}`}>
          {TIER_LABELS[quota.tier]}
        </span>

        {/* Close */}
        <button
          className="btn btn-ghost btn-xs btn-square ml-1"
          onClick={() => togglePanel('quota', false)}
        >
          <X size={10} />
        </button>
      </div>

      {/* Warning when near limit */}
      {percent >= 80 && (
        <p className="text-[9px] text-error mt-1">
          Quota nearly exhausted! Consider upgrading tier or waiting until midnight PT.
        </p>
      )}
    </div>
  )
}
