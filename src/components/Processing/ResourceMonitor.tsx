import { useEffect, useMemo, useState } from 'react'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'
import { GripVertical, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { Badge, IconButton } from '../ui/primitives'

interface SystemInfo {
  gpuRenderer: string
  cpuCores: number
  ramGB: number | null
  jsHeapMB: number | null
  jsHeapLimitMB: number | null
}

function getGpuInfo(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return 'N/A'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return gl.getParameter(gl.RENDERER) ?? 'N/A'
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? 'N/A'
  } catch {
    return 'N/A'
  }
}

function getSystemInfo(): SystemInfo {
  const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory

  return {
    gpuRenderer: getGpuInfo(),
    cpuCores: navigator.hardwareConcurrency ?? 0,
    ramGB: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
    jsHeapMB: perfMemory ? Math.round(perfMemory.usedJSHeapSize / 1048576) : null,
    jsHeapLimitMB: perfMemory ? Math.round(perfMemory.jsHeapSizeLimit / 1048576) : null,
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// SVG circular progress ring
function CircleGauge({
  percent,
  label,
  color,
  size = 44,
}: {
  percent: number
  label: string
  color: string
  size?: number
}) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/10"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Percent text overlay */}
      <div
        className="absolute flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-[9px] font-bold tabular-nums" style={{ color }}>
          {Math.round(percent)}%
        </span>
      </div>
      <span className="text-[9px] font-medium text-[var(--mg-muted)]">{label}</span>
    </div>
  )
}

interface ResourceMonitorProps {
  isProcessing: boolean
}

export default function ResourceMonitor({ isProcessing }: ResourceMonitorProps) {
  const { position, dragHandleProps } = useFloatingPanel({
    id: 'resource-monitor',
    defaultPosition: { x: 16, y: window.innerHeight - 120 },
    defaultVisible: true,
  })
  // Visibility controlled by store, not hook
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 50,
  }
  const togglePanel = useAppStore((s) => s.togglePanel)
  const sysInfo = useMemo(() => getSystemInfo(), [])
  const [elapsed, setElapsed] = useState(0)
  const [heapMB, setHeapMB] = useState(sysInfo.jsHeapMB)
  const [heapPercent, setHeapPercent] = useState(0)

  // Elapsed timer
  useEffect(() => {
    if (!isProcessing) return
    setElapsed(0)
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isProcessing])

  // Memory poll (Chrome only) — every 3 seconds
  useEffect(() => {
    if (!isProcessing) return
    const poll = () => {
      const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
      if (perfMemory) {
        const used = Math.round(perfMemory.usedJSHeapSize / 1048576)
        const limit = Math.round(perfMemory.jsHeapSizeLimit / 1048576)
        setHeapMB(used)
        setHeapPercent(limit > 0 ? Math.round((used / limit) * 100) : 0)
      }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [isProcessing])

  // Shorten GPU name for display
  const gpuShort = useMemo(() => {
    const r = sysInfo.gpuRenderer
    const nv = r.match(/(?:RTX|GTX|GT|Quadro)\s*\d+\s*\w*/i)
    if (nv) return nv[0].trim()
    const amd = r.match(/(?:RX|Radeon)\s*\d+\s*\w*/i)
    if (amd) return amd[0].trim()
    const intel = r.match(/Intel.*?(?:UHD|Iris|HD)\s*\w*/i)
    if (intel) return intel[0].trim()
    if (r.length > 18) return r.slice(0, 16) + '…'
    return r
  }, [sysInfo.gpuRenderer])

  // Approximate CPU "usage" — not real, just shows core count as a visual
  const cpuVisual = Math.min(100, Math.round((sysInfo.cpuCores / 16) * 100))
  // RAM visual — approximate usage ratio
  const ramVisual = sysInfo.ramGB ? Math.min(100, Math.round(((heapMB ?? 0) / (sysInfo.ramGB * 1024)) * 100)) : 0

  return (
    <div style={panelStyle} className="floating-panel-sm panel-enter px-3 py-2 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div {...dragHandleProps} className="flex items-center gap-1 drag-handle flex-1">
          <GripVertical size={10} className="text-[var(--mg-dim)]" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--mg-muted)]">ทรัพยากร</span>
          {isProcessing && (
            <span className="ml-1 font-mono text-[10px] tabular-nums text-blue-300">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
        <IconButton label="ปิดทรัพยากรเครื่อง" className="h-6 w-6" onClick={() => togglePanel('resource', false)}>
          <X size={10} />
        </IconButton>
      </div>
      <div className="flex items-center gap-2">
        {/* Circular gauges */}
        <div className="relative">
          <CircleGauge percent={cpuVisual} label={`${sysInfo.cpuCores}c`} color="#818cf8" size={36} />
        </div>
        {heapMB !== null && (
          <div className="relative">
            <CircleGauge percent={heapPercent} label={`${heapMB}M`} color="#fbbf24" size={36} />
          </div>
        )}
        {sysInfo.ramGB && (
          <div className="relative">
            <CircleGauge percent={ramVisual} label={`${sysInfo.ramGB}G`} color="#34d399" size={36} />
          </div>
        )}
        <div className="flex items-center gap-1 ml-1" title={sysInfo.gpuRenderer}>
          <Badge>GPU</Badge>
          <span className="max-w-[100px] truncate text-[9px] text-[var(--mg-muted)]">{gpuShort}</span>
        </div>
      </div>
    </div>
  )
}
