import { useAppStore, type PanelId } from '../../store/appStore'
import type { EditorHistoryEntry, TextHistoryEntry } from '../../store/appStore'
import { ChevronDown, Cpu, Eraser, Hand, MousePointer2, Paintbrush, PanelRightOpen, Pipette, Redo2, ScrollText, Undo2 } from 'lucide-react'
import { DropdownItem, DropdownMenu, ToolButton } from '../ui/primitives'
import type { ActiveTool, TextRegion } from '../../types'

const TOOL_ICONS: { id: ActiveTool; icon: typeof MousePointer2; label: string; shortcut?: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'เลือก', shortcut: 'V' },
  { id: 'brush', icon: Paintbrush, label: 'แปรง', shortcut: 'B' },
  { id: 'eraser', icon: Eraser, label: 'ยางลบ', shortcut: 'E' },
  { id: 'eyedropper', icon: Pipette, label: 'ดูดสี', shortcut: 'I' },
  { id: 'pan', icon: Hand, label: 'เลื่อนผ้าใบ', shortcut: 'Space' },
]

const PANEL_ICONS: { id: PanelId; icon: typeof Paintbrush; label: string }[] = [
  { id: 'brush', icon: Paintbrush, label: 'แผงแปรง' },
  { id: 'properties', icon: PanelRightOpen, label: 'คุณสมบัติข้อความ' },
  { id: 'resource', icon: Cpu, label: 'ทรัพยากรเครื่อง' },
  { id: 'logs', icon: ScrollText, label: 'บันทึกระบบ' },
]

export default function PanelToggleBar() {
  const store = useAppStore()
  const panels = store.panels
  const togglePanel = store.togglePanel
  const activeTool = store.activeTool
  const setActiveTool = store.setActiveTool
  const selectRegion = store.selectRegion
  const step = store.currentStep
  if (step !== 'edit') return null
  const activeToolLabel = TOOL_ICONS.find((tool) => tool.id === activeTool)?.label ?? 'เลือก'
  const undoEntries = store._editorUndoStack.filter((entry) => entry.activeImageId === store.activeImageId)
  const redoEntries = store._editorRedoStack.filter((entry) => entry.activeImageId === store.activeImageId)
  const canUndo = undoEntries.length > 0
  const canRedo = redoEntries.length > 0
  const setTool = (id: ActiveTool) => {
    setActiveTool(id)
    if (id !== 'select') selectRegion(null)
    if (id === 'brush' || id === 'eraser' || id === 'eyedropper') {
      togglePanel('brush', true)
    }
  }
  const undo = () => {
    store.undoEditorEdit()
  }
  const redo = () => {
    store.redoEditorEdit()
  }

  return (
    <div className="floating-panel-sm panel-enter fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 px-3 py-2">
      <div className="flex items-center gap-0.5 rounded-[7px] border border-[var(--mg-border)] bg-white/[0.025] p-0.5">
        <button
          className="mg-tool h-8 w-8"
          onClick={undo}
          disabled={!canUndo}
          aria-label="ย้อนกลับ"
          title="ย้อนกลับ (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>
        <DropdownMenu
          trigger={
            <button
              className="mg-tool h-8 w-8 gap-0.5 px-1"
              disabled={undoEntries.length === 0}
              aria-label="ประวัติย้อนกลับ"
              title="ประวัติย้อนกลับ"
            >
              <span className="text-[10px] font-bold">{undoEntries.length}</span>
              <ChevronDown size={12} />
            </button>
          }
          className="w-64"
        >
          {undoEntries.length > 0 ? (
            undoEntries.slice().reverse().map((entry, index) => (
              <DropdownItem key={`undo-${index}`} onClick={() => store.undoEditorEdit(index + 1)}>
                <span className="min-w-6 text-[10px] font-bold text-[var(--mg-dim)]">{index + 1}</span>
                <span className="truncate">{describeEditorHistory(entry, 'undo')}</span>
              </DropdownItem>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--mg-dim)]">ไม่มีประวัติ</div>
          )}
        </DropdownMenu>
        <button
          className="mg-tool h-8 w-8"
          onClick={redo}
          disabled={!canRedo}
          aria-label="ทำซ้ำ"
          title="ทำซ้ำ (Ctrl+Shift+Z)"
        >
          <Redo2 size={15} />
        </button>
        <DropdownMenu
          trigger={
            <button
              className="mg-tool h-8 w-8 gap-0.5 px-1"
              disabled={redoEntries.length === 0}
              aria-label="ประวัติทำซ้ำ"
              title="ประวัติทำซ้ำ"
            >
              <span className="text-[10px] font-bold">{redoEntries.length}</span>
              <ChevronDown size={12} />
            </button>
          }
          className="w-64"
        >
          {redoEntries.length > 0 ? (
            redoEntries.slice().reverse().map((entry, index) => (
              <DropdownItem key={`redo-${index}`} onClick={() => store.redoEditorEdit(index + 1)}>
                <span className="min-w-6 text-[10px] font-bold text-[var(--mg-dim)]">{index + 1}</span>
                <span className="truncate">{describeEditorHistory(entry, 'redo')}</span>
              </DropdownItem>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--mg-dim)]">ไม่มีประวัติทำซ้ำ</div>
          )}
        </DropdownMenu>
      </div>
      <div className="mx-1 h-6 w-px bg-[var(--mg-border)]" />
      {TOOL_ICONS.map(({ id, icon: Icon, label, shortcut }) => (
        <ToolButton
          key={id}
          label={label}
          shortcut={shortcut}
          active={activeTool === id}
          onClick={() => setTool(id)}
        >
          <Icon size={16} />
        </ToolButton>
      ))}
      <div className="hidden min-w-20 border-l border-[var(--mg-border)] pl-2 text-xs font-bold text-[var(--mg-muted)] sm:block">
        {activeToolLabel}
      </div>
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

function describeEditorHistory(entry: EditorHistoryEntry, direction: 'undo' | 'redo'): string {
  if (entry.kind === 'text') return describeTextHistory(entry, direction)
  const stroke = direction === 'undo'
    ? entry.after[entry.after.length - 1]
    : entry.after[entry.after.length - 1]
  return stroke?.tool === 'eraser' ? 'ยางลบ' : 'วาดแปรง'
}

function describeTextHistory(entry: TextHistoryEntry, direction: 'undo' | 'redo'): string {
  const from = direction === 'undo' ? entry.after : entry.before
  const to = direction === 'undo' ? entry.before : entry.after
  if (from.length > to.length) return `ลบข้อความ ${historyText(from.find((region) => !to.some((item) => item.id === region.id)))}`
  if (from.length < to.length) return `คืนข้อความที่ลบ ${historyText(to.find((region) => !from.some((item) => item.id === region.id)))}`
  const changed = to.find((region) => {
    const previous = from.find((item) => item.id === region.id)
    return previous && JSON.stringify(previous) !== JSON.stringify(region)
  })
  const previous = changed ? from.find((item) => item.id === changed.id) : null
  if (!changed || !previous) return 'แก้ข้อความ'
  if (previous.translatedText !== changed.translatedText) return `แก้ข้อความ ${historyText(changed)}`
  if (previous.textLayoutMode !== changed.textLayoutMode) return `เปลี่ยนโหมด ${changed.textLayoutMode === 'artistic' ? 'Artistic' : 'Bubble'}`
  if (previous.textAlign !== changed.textAlign) return `จัดตำแหน่งข้อความ ${historyText(changed)}`
  if (previous.fontSize !== changed.fontSize || previous.fontId !== changed.fontId) return `ปรับฟอนต์ ${historyText(changed)}`
  if (JSON.stringify(previous.bbox) !== JSON.stringify(changed.bbox) || previous.rotation !== changed.rotation) return `ปรับกรอบ ${historyText(changed)}`
  return `แก้รูปแบบ ${historyText(changed)}`
}

function historyText(region?: TextRegion): string {
  const text = (region?.translatedText || region?.originalText || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 24 ? `${text.slice(0, 24)}...` : text
}
