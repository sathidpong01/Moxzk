import type { RefObject } from 'react'
import { ChevronDown, Eraser, Hand, MousePointer2, Paintbrush, Pipette, Redo2, Search, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { EditorHistoryEntry, TextHistoryEntry } from '../../store/appStore'
import type { ActiveTool, TextRegion } from '../../types'
import type { CanvasEditorHandle } from '../Editor/CanvasEditor'
import { DropdownItem, DropdownMenu, TooltipSurface, cn } from '../ui/primitives'

const TOOL_ICONS: { id: ActiveTool; icon: typeof MousePointer2; label: string; shortcut?: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'เลือก', shortcut: 'V' },
  { id: 'brush', icon: Paintbrush, label: 'แปรง', shortcut: 'B' },
  { id: 'eraser', icon: Eraser, label: 'ยางลบ', shortcut: 'E' },
  { id: 'eyedropper', icon: Pipette, label: 'ดูดสี', shortcut: 'I' },
  { id: 'pan', icon: Hand, label: 'เลื่อน', shortcut: 'Space' },
]

interface PanelToggleBarProps {
  editorRef: RefObject<CanvasEditorHandle | null>
  viewportZoom: number
}

export default function PanelToggleBar({ editorRef, viewportZoom }: PanelToggleBarProps) {
  const store = useAppStore()
  const activeTool = store.activeTool
  const step = store.currentStep
  if (step !== 'edit') return null

  const undoEntries = store._editorUndoStack.filter((entry) => entry.activeImageId === store.activeImageId)
  const redoEntries = store._editorRedoStack.filter((entry) => entry.activeImageId === store.activeImageId)
  const canUndo = undoEntries.length > 0
  const canRedo = redoEntries.length > 0
  const brushToolActive = activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'eyedropper'

  const setTool = (id: ActiveTool) => {
    store.setActiveTool(id)
    if (id !== 'select') {
      store.selectRegion(null)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {brushToolActive && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-[16px] border border-white/8 bg-[rgba(11,11,12,0.96)] px-3 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur">
          {activeTool === 'eyedropper' ? (
            <div className="flex items-center gap-2 rounded-[12px] bg-white/[0.04] px-3 py-2">
              <div
                className="h-7 w-7 rounded-[8px] border border-white/10"
                style={{ backgroundColor: store.brushColor }}
              />
              <span className="text-sm font-bold text-[var(--mg-text)]">{store.brushColor}</span>
            </div>
          ) : (
            <>
              <TooltipSurface label="สีแปรง">
                <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[12px] bg-white/[0.04] transition hover:bg-white/[0.08]">
                  <input
                    type="color"
                    value={store.brushColor}
                    onChange={(event) => store.setBrushColor(event.target.value)}
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
                    aria-label="สีแปรง"
                  />
                </label>
              </TooltipSurface>
              <DockNumericField
                label="ขนาด"
                value={store.brushSize}
                step={1}
                min={1}
                max={50}
                onChange={(value) => store.setBrushSize(value)}
              />
              <DockNumericField
                label="ทึบ"
                value={Math.round(store.brushOpacity * 100)}
                step={5}
                min={5}
                max={100}
                suffix="%"
                onChange={(value) => store.setBrushOpacity(value / 100)}
              />
              {activeTool === 'brush' && (
                <DockNumericField
                  label="ฟุ้ง"
                  value={store.brushShadowBlur}
                  step={1}
                  min={0}
                  max={32}
                  onChange={(value) => store.setBrushShadowBlur(value)}
                />
              )}
            </>
          )}
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2 rounded-[18px] border border-white/8 bg-[rgba(11,11,12,0.96)] px-3 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur">
        <div className="flex items-center gap-1 rounded-[12px] bg-white/[0.03] px-1 py-1">
          <TooltipSurface label="ย้อนกลับ" shortcut="Ctrl+Z">
            <button
              className={dockButtonClass(canUndo)}
              onClick={() => store.undoEditorEdit()}
              disabled={!canUndo}
              aria-label="ย้อนกลับ"
            >
              <Undo2 size={15} />
            </button>
          </TooltipSurface>
          <DropdownMenu
            trigger={(
              <TooltipSurface label="ประวัติย้อนกลับ">
                <button className={dockCountButtonClass(canUndo)} disabled={!canUndo} aria-label="ประวัติย้อนกลับ">
                  <span>{undoEntries.length}</span>
                  <ChevronDown size={12} />
                </button>
              </TooltipSurface>
            )}
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
          <TooltipSurface label="ทำซ้ำ" shortcut="Ctrl+Shift+Z">
            <button
              className={dockButtonClass(canRedo)}
              onClick={() => store.redoEditorEdit()}
              disabled={!canRedo}
              aria-label="ทำซ้ำ"
            >
              <Redo2 size={15} />
            </button>
          </TooltipSurface>
          <DropdownMenu
            trigger={(
              <TooltipSurface label="ประวัติทำซ้ำ">
                <button className={dockCountButtonClass(canRedo)} disabled={!canRedo} aria-label="ประวัติทำซ้ำ">
                  <span>{redoEntries.length}</span>
                  <ChevronDown size={12} />
                </button>
              </TooltipSurface>
            )}
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

        <div className="flex items-center gap-1 rounded-[12px] bg-white/[0.03] px-1 py-1">
          {TOOL_ICONS.map(({ id, icon: Icon, label, shortcut }) => (
            <TooltipSurface key={id} label={label} shortcut={shortcut}>
              <button
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-[12px] text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)]',
                  activeTool === id && 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)] hover:text-white',
                )}
                onClick={() => setTool(id)}
                aria-label={label}
              >
                <Icon size={16} />
              </button>
            </TooltipSurface>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-[12px] bg-white/[0.03] px-1 py-1">
          <TooltipSurface label="ซูมออก">
            <button className={dockButtonClass(true)} onClick={() => editorRef.current?.zoomOut()} aria-label="ซูมออก">
              <ZoomOut size={15} />
            </button>
          </TooltipSurface>
          <div className="min-w-[3.5rem] px-2 text-center text-xs font-bold text-[var(--mg-text)]">
            {Math.round(viewportZoom * 100)}%
          </div>
          <TooltipSurface label="ซูมเข้า">
            <button className={dockButtonClass(true)} onClick={() => editorRef.current?.zoomIn()} aria-label="ซูมเข้า">
              <ZoomIn size={15} />
            </button>
          </TooltipSurface>
          <TooltipSurface label="พอดีหน้าทำงาน">
            <button className={dockFitButtonClass()} onClick={() => editorRef.current?.fitView()} aria-label="พอดีหน้าทำงาน">
              <Search size={14} />
              <span>พอดี</span>
            </button>
          </TooltipSurface>
        </div>
      </div>
    </div>
  )
}

function DockNumericField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  suffix?: string
}) {
  return (
    <TooltipSurface label={label}>
      <label className="flex h-9 items-center gap-2 rounded-[12px] bg-white/[0.04] px-3 text-sm text-[var(--mg-text)]">
        <span className="text-xs font-bold text-[var(--mg-muted)]">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value)
            if (Number.isFinite(nextValue)) {
              onChange(Math.max(min, Math.min(max, nextValue)))
            }
          }}
          className="w-12 bg-transparent text-right outline-none"
        />
        {suffix ? <span className="text-xs text-[var(--mg-muted)]">{suffix}</span> : null}
      </label>
    </TooltipSurface>
  )
}

function dockButtonClass(enabled: boolean): string {
  return cn(
    'flex h-9 w-9 items-center justify-center rounded-[12px] text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)]',
    !enabled && 'cursor-not-allowed opacity-40',
  )
}

function dockCountButtonClass(enabled: boolean): string {
  return cn(
    'flex h-9 items-center gap-1 rounded-[12px] px-2 text-xs font-bold text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)]',
    !enabled && 'cursor-not-allowed opacity-40',
  )
}

function dockFitButtonClass(): string {
  return 'flex h-9 items-center gap-1 rounded-[12px] px-3 text-xs font-bold text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)]'
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
  if (from.length > to.length) return `ลบข้อความ ${historyText(from.find((region) => !to.some((item) => item.id === region.id)))}`.trim()
  if (from.length < to.length) return `คืนข้อความที่ลบ ${historyText(to.find((region) => !from.some((item) => item.id === region.id)))}`.trim()
  const changed = to.find((region) => {
    const previous = from.find((item) => item.id === region.id)
    return previous && JSON.stringify(previous) !== JSON.stringify(region)
  })
  const previous = changed ? from.find((item) => item.id === changed.id) : null
  if (!changed || !previous) return 'แก้ข้อความ'
  if (previous.translatedText !== changed.translatedText) return `แก้ข้อความ ${historyText(changed)}`.trim()
  if (previous.textLayoutMode !== changed.textLayoutMode) return `เปลี่ยนโหมด ${changed.textLayoutMode === 'artistic' ? 'อิสระ' : 'พอดีกล่อง'}`
  if (previous.textAlign !== changed.textAlign) return `จัดข้อความ ${historyText(changed)}`.trim()
  if (previous.fontSize !== changed.fontSize || previous.fontId !== changed.fontId) return `ปรับฟอนต์ ${historyText(changed)}`.trim()
  if (JSON.stringify(previous.bbox) !== JSON.stringify(changed.bbox) || previous.rotation !== changed.rotation) return `ย้ายกล่อง ${historyText(changed)}`.trim()
  return `แก้รูปแบบ ${historyText(changed)}`.trim()
}

function historyText(region?: TextRegion): string {
  const text = (region?.translatedText || region?.originalText || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 24 ? `${text.slice(0, 24)}...` : text
}
