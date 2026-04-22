import { useEffect, useState } from 'react'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'
import { useAppStore } from '../../store/appStore'
import type { ProcessingMode, TextRegion } from '../../types'
import { Cpu, Eye, EyeOff, FileSearch, GripVertical, LayoutGrid, List, Loader2, ScrollText, Trash2, X } from 'lucide-react'
import PropertiesPanel from './PropertiesPanel'
import { Badge, Button, DisclosureSection, IconButton, TabPanel, Tabs } from '../ui/primitives'
import type { ActiveTool } from '../../types'

type InspectorTab = 'text' | 'brush' | 'page'

const BRUSH_TOOLS: { tool: ActiveTool; label: string }[] = [
  { tool: 'brush', label: 'แปรง' },
  { tool: 'eraser', label: 'ยางลบ' },
  { tool: 'eyedropper', label: 'ดูดสี' },
]

const PRESET_COLORS = [
  '#ffffff', '#000000', '#f5f5f5', '#d4d4d4',
  '#a3a3a3', '#737373', '#e7c9a9', '#c4956a',
]

interface FloatingInspectorProps {
  region: TextRegion | null
  onUpdate: (id: string, updates: Partial<TextRegion>) => void
  onDelete: (id: string) => void
  onOpenOcr: () => void
  onRetryFailedBatchAI: (mode: ProcessingMode) => void
  processingMode: ProcessingMode
  isBatchProcessing: boolean
  hasFailedPages: boolean
  viewport: { zoom: number; imageWidth: number; imageHeight: number }
  pageCount: number
  activePageIndex: number
  showFilmstrip: boolean
  onToggleFilmstrip: () => void
}

export default function FloatingInspector({
  region,
  onUpdate,
  onDelete,
  onOpenOcr,
  onRetryFailedBatchAI,
  processingMode,
  isBatchProcessing,
  hasFailedPages,
  viewport,
  pageCount,
  activePageIndex,
  showFilmstrip,
  onToggleFilmstrip,
}: FloatingInspectorProps) {
  const { panelStyle, dragHandleProps } = useFloatingPanel({
    id: 'contextual-inspector',
    defaultPosition: { x: Math.max(24, window.innerWidth - 382), y: 92 },
    defaultVisible: true,
  })
  const store = useAppStore()
  const { activeTool, workspaceMode, panels } = store
  const brushToolActive = activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'eyedropper'
  const preferredTab: InspectorTab = region ? 'text' : brushToolActive ? 'brush' : 'page'
  const [activeTab, setActiveTab] = useState<InspectorTab>(preferredTab)

  useEffect(() => {
    setActiveTab((current) => {
      if (region && current !== 'text') return 'text'
      if (!region && brushToolActive && current !== 'brush') return 'brush'
      if (!region && !brushToolActive && current !== 'page') return 'page'
      return current
    })
  }, [brushToolActive, region])

  return (
    <div style={panelStyle} className="floating-panel panel-enter flex max-h-[84vh] w-[21.25rem] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--mg-border)] px-3 py-2">
        <div {...dragHandleProps} className="flex min-w-0 items-center gap-2 drag-handle">
          <GripVertical size={14} className="text-[var(--mg-dim)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--mg-muted)]">
            แผงแก้ไข
          </span>
          <Badge className="truncate">หน้า {Math.max(1, activePageIndex + 1)}/{Math.max(pageCount, 1)}</Badge>
        </div>
        <IconButton label="ปิดแผงแก้ไข" onClick={() => store.togglePanel('inspector', false)}>
          <X size={12} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
        <Tabs<InspectorTab>
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'text', label: 'ข้อความ' },
            { value: 'brush', label: 'แปรง' },
            { value: 'page', label: 'หน้า' },
          ]}
        >
          <TabPanel className="pt-2.5">
            <PropertiesPanel region={region} onUpdate={onUpdate} onDelete={onDelete} />
          </TabPanel>

          <TabPanel className="space-y-4 pt-3">
            <div className="flex gap-1">
              {BRUSH_TOOLS.map(({ tool, label }) => (
                <Button
                  key={tool}
                  variant={store.activeTool === tool ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    store.selectRegion(null)
                    store.setActiveTool(tool)
                  }}
                >
                  <span className="text-xs font-bold">{label}</span>
                </Button>
              ))}
            </div>

            {store.activeTool === 'eyedropper' && (
              <div className="flex items-center gap-2 rounded-[8px] border border-[var(--mg-border)] bg-black/20 px-3 py-2">
                <div
                  className="h-8 w-8 rounded-[6px] border border-[var(--mg-border-strong)]"
                  style={{ backgroundColor: store.brushColor }}
                />
                <div>
                  <div className="text-xs font-bold text-[var(--mg-text)]">สีที่เลือกอยู่</div>
                  <div className="font-mono text-xs text-[var(--mg-muted)]">{store.brushColor}</div>
                </div>
              </div>
            )}

            {store.activeTool !== 'eyedropper' && (
              <DisclosureSection title="สีและหัวแปรง">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--mg-muted)]">
                    สี
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-8 w-8 cursor-pointer rounded-[6px] border-0 bg-transparent"
                      value={store.brushColor}
                      onChange={(event) => store.setBrushColor(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`h-5 w-5 rounded-full border-2 transition-all ${
                            store.brushColor === color
                              ? 'scale-110 border-[var(--mg-accent)]'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => store.setBrushColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <label className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--mg-muted)]">ขนาด</span>
                    <span className="font-mono text-[var(--mg-dim)]">{store.brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    className="mg-slider"
                    min={1}
                    max={50}
                    value={store.brushSize}
                    onChange={(event) => store.setBrushSize(Number(event.target.value))}
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--mg-muted)]">ความทึบ</span>
                    <span className="font-mono text-[var(--mg-dim)]">{Math.round(store.brushOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="mg-slider"
                    min={5}
                    max={100}
                    value={Math.round(store.brushOpacity * 100)}
                    onChange={(event) => store.setBrushOpacity(Number(event.target.value) / 100)}
                  />
                </label>

                {store.activeTool === 'brush' && (
                  <label className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--mg-muted)]">ขอบฟุ้ง</span>
                      <span className="font-mono text-[var(--mg-dim)]">{store.brushShadowBlur}px</span>
                    </div>
                    <input
                      type="range"
                      className="mg-slider"
                      min={0}
                      max={32}
                      value={Math.min(store.brushShadowBlur, 32)}
                      onChange={(event) => store.setBrushShadowBlur(Number(event.target.value))}
                    />
                  </label>
                )}
              </DisclosureSection>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={store.brushStrokes.length === 0}
                onClick={store.clearBrushStrokes}
              >
                <Trash2 size={12} />
                ล้างสโตรก
              </Button>
            </div>
          </TabPanel>

          <TabPanel className="space-y-4 pt-3">
            <DisclosureSection title="การแสดงผล">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={workspaceMode === 'focus' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => store.setWorkspaceMode('focus')}
                >
                  <List size={12} />
                  หน้าเดียว
                </Button>
                <Button
                  variant={workspaceMode === 'board' ? 'primary' : 'ghost'}
                  size="sm"
                  disabled={pageCount <= 1}
                  onClick={() => store.setWorkspaceMode('board')}
                >
                  <LayoutGrid size={12} />
                  รวมหน้า
                </Button>
              </div>

              {pageCount > 1 && workspaceMode === 'board' && (
                <Button variant="ghost" size="sm" onClick={onToggleFilmstrip}>
                  {showFilmstrip ? 'ซ่อนแถบหน้า' : 'แสดงแถบหน้า'}
                </Button>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs text-[var(--mg-muted)]">
                <div className="rounded-[8px] border border-[var(--mg-border)] bg-black/20 px-3 py-2">
                  <div className="font-bold text-[var(--mg-text)]">{viewport.imageWidth || 0} × {viewport.imageHeight || 0}</div>
                  <div>ขนาดหน้า</div>
                </div>
                <div className="rounded-[8px] border border-[var(--mg-border)] bg-black/20 px-3 py-2">
                  <div className="font-bold text-[var(--mg-text)]">{store.regions.length}</div>
                  <div>ข้อความ</div>
                </div>
                <div className="rounded-[8px] border border-[var(--mg-border)] bg-black/20 px-3 py-2">
                  <div className="font-bold text-[var(--mg-text)]">{store.brushStrokes.length}</div>
                  <div>รอยแปรง</div>
                </div>
              </div>
            </DisclosureSection>

            <DisclosureSection title="งานหน้า">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={store.regions.length === 0}
                  onClick={onOpenOcr}
                >
                  <FileSearch size={12} />
                  ตรวจ OCR
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => store.toggleTextOverlay()}
                >
                  {store.showTextOverlay ? <EyeOff size={12} /> : <Eye size={12} />}
                  {store.showTextOverlay ? 'ซ่อนข้อความ' : 'แสดงข้อความ'}
                </Button>
                {hasFailedPages && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBatchProcessing}
                    onClick={() => onRetryFailedBatchAI(processingMode)}
                  >
                    {isBatchProcessing ? <Loader2 size={12} className="animate-spin" /> : null}
                    ลองหน้าที่พลาด
                  </Button>
                )}
              </div>
            </DisclosureSection>

            <DisclosureSection title="เพิ่มเติม" defaultOpen={false}>
              <div className="flex flex-wrap gap-2">
                <Button variant={panels.logs ? 'primary' : 'ghost'} size="sm" onClick={() => store.togglePanel('logs')}>
                  <ScrollText size={12} />
                  บันทึกระบบ
                </Button>
                <Button variant={panels.resource ? 'primary' : 'ghost'} size="sm" onClick={() => store.togglePanel('resource')}>
                  <Cpu size={12} />
                  ทรัพยากรเครื่อง
                </Button>
              </div>
            </DisclosureSection>
          </TabPanel>
        </Tabs>
      </div>
    </div>
  )
}
