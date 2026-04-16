import { useAppStore } from '../../store/appStore'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'
import {
  Paintbrush,
  Eraser,
  Pipette,
  Undo2,
  Redo2,
  Trash2,
  X,
  GripVertical,
} from 'lucide-react'
import type { ActiveTool } from '../../types'
import { IconButton, ToolButton } from '../ui/primitives'

const PRESET_COLORS = [
  '#ffffff', '#000000', '#f5f5f5', '#d4d4d4',
  '#a3a3a3', '#737373', '#e7c9a9', '#c4956a',
]

const BRUSH_TOOLS: { tool: ActiveTool; label: string; icon: typeof Paintbrush }[] = [
  { tool: 'brush', label: 'Brush', icon: Paintbrush },
  { tool: 'eraser', label: 'Eraser', icon: Eraser },
  { tool: 'eyedropper', label: 'Eyedropper', icon: Pipette },
]

interface BrushToolbarProps {
  onClose?: () => void
}

export default function BrushToolbar({ onClose }: BrushToolbarProps) {
  const store = useAppStore()
  const { panelStyle, dragHandleProps } = useFloatingPanel({
    id: 'brush-toolbar',
    defaultPosition: { x: 60, y: 200 },
    defaultVisible: true,
  })

  const isBrushTool = ['brush', 'eraser', 'eyedropper'].includes(store.activeTool)

  return (
    <div style={panelStyle} className="floating-panel panel-enter w-56 p-3">
      <div className="flex items-center justify-between mb-2">
        <div {...dragHandleProps} className="flex items-center gap-1 drag-handle flex-1">
          <GripVertical size={14} className="text-[var(--mg-dim)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--mg-muted)]">
            Brush Tools
          </span>
        </div>
        <IconButton
          label="Close brush tools"
          onClick={() => onClose?.()}
        >
          <X size={12} />
        </IconButton>
      </div>

      <div className="flex gap-1 mb-3">
        {BRUSH_TOOLS.map(({ tool, label, icon: Icon }) => (
          <ToolButton
            key={tool}
            label={label}
            active={store.activeTool === tool}
            onClick={() => store.setActiveTool(store.activeTool === tool ? 'select' : tool)}
          >
            <Icon size={16} />
          </ToolButton>
        ))}
      </div>

      {/* Current color swatch (always visible when eyedropper active) */}
      {store.activeTool === 'eyedropper' && (
        <div className="mb-3 flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-[6px] border border-[var(--mg-border-strong)]"
            style={{ backgroundColor: store.brushColor }}
          />
          <span className="font-mono text-xs text-[var(--mg-muted)]">{store.brushColor}</span>
        </div>
      )}

      {/* Color picker + presets */}
      {isBrushTool && store.activeTool !== 'eyedropper' && (
        <>
          <div className="mb-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--mg-muted)]">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-8 w-8 cursor-pointer rounded-[6px] border-0 bg-transparent"
                value={store.brushColor}
                onChange={(e) => store.setBrushColor(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
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

          {/* Brush size */}
          <div className="mb-2">
            <label className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--mg-muted)]">
              <span>Size</span>
              <span>{store.brushSize}px</span>
            </label>
            <input
              type="range"
              className="mg-slider"
              min={1}
              max={50}
              value={store.brushSize}
              onChange={(e) => store.setBrushSize(Number(e.target.value))}
            />
          </div>

          {/* Opacity */}
          <div className="mb-2">
            <label className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--mg-muted)]">
              <span>Opacity</span>
              <span>{Math.round(store.brushOpacity * 100)}%</span>
            </label>
            <input
              type="range"
              className="mg-slider"
              min={5}
              max={100}
              value={Math.round(store.brushOpacity * 100)}
              onChange={(e) => store.setBrushOpacity(Number(e.target.value) / 100)}
            />
          </div>

          {/* Feather (always available for brush) */}
          {store.activeTool === 'brush' && (
            <div className="mb-2">
              <label className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--mg-muted)]">
                <span>Feather</span>
                <span>{store.brushShadowBlur}px</span>
              </label>
              <input
                type="range"
                className="mg-slider"
                min={0}
                max={Math.floor(store.brushSize / 2)}
                value={Math.min(store.brushShadowBlur, Math.floor(store.brushSize / 2))}
                onChange={(e) => store.setBrushShadowBlur(Number(e.target.value))}
              />
            </div>
          )}
        </>
      )}

      {/* Undo / Redo / Clear */}
      <div className="flex items-center gap-1 border-t border-[var(--mg-border)] pt-2">
        <button
          className="mg-button mg-button-ghost mg-button-sm flex-1"
          onClick={store.undoBrushStroke}
          disabled={store.brushStrokes.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={12} /> Undo
        </button>
        <button
          className="mg-button mg-button-ghost mg-button-sm flex-1"
          onClick={store.redoBrushStroke}
          disabled={store._brushRedoStack.length === 0}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={12} /> Redo
        </button>
        <button
          className="mg-icon-button h-7 w-7 text-[var(--mg-danger)]"
          onClick={store.clearBrushStrokes}
          disabled={store.brushStrokes.length === 0}
          title="Clear all strokes"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
