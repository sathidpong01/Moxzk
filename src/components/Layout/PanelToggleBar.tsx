import { useAppStore, type PanelId } from '../../store/appStore'
import { Paintbrush, PanelRightOpen, Cpu, Sparkles, ScrollText } from 'lucide-react'

const PANEL_ICONS: { id: PanelId; icon: typeof Paintbrush; label: string }[] = [
  { id: 'brush', icon: Paintbrush, label: 'Brush Tools' },
  { id: 'properties', icon: PanelRightOpen, label: 'Properties' },
  { id: 'resource', icon: Cpu, label: 'Resource Monitor' },
  { id: 'quota', icon: Sparkles, label: 'AI Quota' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
]

export default function PanelToggleBar() {
  const panels = useAppStore((s) => s.panels)
  const togglePanel = useAppStore((s) => s.togglePanel)
  const step = useAppStore((s) => s.currentStep)
  if (step !== 'edit') return null

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 floating-panel-sm px-3 py-2 flex items-center gap-1.5 panel-enter">
      {PANEL_ICONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`btn btn-sm btn-square transition-all ${
            panels[id] ? 'btn-primary' : 'btn-ghost opacity-50 hover:opacity-100'
          }`}
          onClick={() => togglePanel(id)}
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}
