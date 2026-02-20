import type { TextRegion } from '../../types'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'
import { useAppStore } from '../../store/appStore'
import { GripVertical, X } from 'lucide-react'
import PropertiesPanel from './PropertiesPanel'

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
    defaultPosition: { x: window.innerWidth - 300, y: 60 },
    defaultVisible: true,
  })
  const togglePanel = useAppStore((s) => s.togglePanel)

  return (
    <div style={panelStyle} className="floating-panel p-3 w-72 max-h-[80vh] overflow-y-auto panel-enter">
      <div className="flex items-center justify-between mb-2">
        <div {...dragHandleProps} className="flex items-center gap-1 drag-handle flex-1">
          <GripVertical size={14} className="text-base-content/30" />
          <span className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Properties
          </span>
        </div>
        <button
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => togglePanel('properties', false)}
        >
          <X size={12} />
        </button>
      </div>
      <PropertiesPanel region={region} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  )
}
