import type { TextRegion } from '../../types'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'
import { useAppStore } from '../../store/appStore'
import { GripVertical, X } from 'lucide-react'
import PropertiesPanel from './PropertiesPanel'
import { IconButton } from '../ui/primitives'

export default function FloatingProperties({
  region,
  onUpdate,
  onDelete,
}: {
  region: TextRegion
  onUpdate: (id: string, u: Partial<TextRegion>) => void
  onDelete: (id: string) => void
}) {
  const { panelStyle, dragHandleProps } = useFloatingPanel({
    id: 'properties-panel',
    defaultPosition: { x: Math.max(24, window.innerWidth - 380), y: 92 },
    defaultVisible: true,
  })
  const togglePanel = useAppStore((s) => s.togglePanel)

  return (
    <div style={panelStyle} className="floating-panel panel-enter flex max-h-[82vh] w-80 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--mg-border)] px-3 py-2">
        <div {...dragHandleProps} className="flex items-center gap-1 drag-handle flex-1">
          <GripVertical size={14} className="text-[var(--mg-dim)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--mg-muted)]">
            คุณสมบัติข้อความ
          </span>
        </div>
        <IconButton label="ปิดคุณสมบัติข้อความ" onClick={() => togglePanel('properties', false)}>
          <X size={12} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <PropertiesPanel region={region} onUpdate={onUpdate} onDelete={onDelete} />
      </div>
    </div>
  )
}
