import { useAppStore, type PanelId } from '../../store/appStore'
import { Eraser, Hand, MousePointer2, Paintbrush, PanelRightOpen, Pipette, Cpu, ScrollText } from 'lucide-react'
import { ToolButton } from '../ui/primitives'
import type { ActiveTool } from '../../types'

const TOOL_ICONS: { id: ActiveTool; icon: typeof MousePointer2; label: string; shortcut?: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', shortcut: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'eyedropper', icon: Pipette, label: 'Eyedropper', shortcut: 'I' },
  { id: 'pan', icon: Hand, label: 'Pan', shortcut: 'Space' },
]

const PANEL_ICONS: { id: PanelId; icon: typeof Paintbrush; label: string }[] = [
  { id: 'brush', icon: Paintbrush, label: 'Brush Panel' },
  { id: 'properties', icon: PanelRightOpen, label: 'Properties' },
  { id: 'resource', icon: Cpu, label: 'Resource Monitor' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
]

export default function PanelToggleBar() {
  const panels = useAppStore((s) => s.panels)
  const togglePanel = useAppStore((s) => s.togglePanel)
  const activeTool = useAppStore((s) => s.activeTool)
  const setActiveTool = useAppStore((s) => s.setActiveTool)
  const step = useAppStore((s) => s.currentStep)
  if (step !== 'edit') return null

  return (
    <div className="floating-panel-sm panel-enter fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 px-3 py-2">
      {TOOL_ICONS.map(({ id, icon: Icon, label, shortcut }) => (
        <ToolButton
          key={id}
          label={label}
          shortcut={shortcut}
          active={activeTool === id}
          onClick={() => setActiveTool(id)}
        >
          <Icon size={16} />
        </ToolButton>
      ))}
      <div className="mx-1 h-6 w-px bg-[var(--mg-border)]" />
      {PANEL_ICONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`mg-tool ${panels[id] ? 'mg-tool-active' : 'opacity-55 hover:opacity-100'}`}
          onClick={() => togglePanel(id)}
          aria-label={label}
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}
