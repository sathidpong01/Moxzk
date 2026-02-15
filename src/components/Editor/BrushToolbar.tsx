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
    <div style={panelStyle} className="floating-panel p-3 w-56 panel-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div {...dragHandleProps} className="flex items-center gap-1 drag-handle flex-1">
          <GripVertical size={14} className="text-base-content/30" />
          <span className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Brush Tools
          </span>
        </div>
        <button
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => onClose?.()}
        >
          <X size={12} />
        </button>
      </div>

      {/* Tool buttons */}
      <div className="flex gap-1 mb-3">
        {BRUSH_TOOLS.map(({ tool, label, icon: Icon }) => (
          <button
            key={tool}
            className={`btn btn-sm btn-square ${store.activeTool === tool ? 'btn-primary' : 'btn-ghost'}`}
            title={label}
            onClick={() => store.setActiveTool(store.activeTool === tool ? 'select' : tool)}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      {/* Current color swatch (always visible when eyedropper active) */}
      {store.activeTool === 'eyedropper' && (
        <div className="mb-3 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border-2 border-base-content/20"
            style={{ backgroundColor: store.brushColor }}
          />
          <span className="text-xs font-mono text-base-content/60">{store.brushColor}</span>
        </div>
      )}

      {/* Color picker + presets */}
      {isBrushTool && store.activeTool !== 'eyedropper' && (
        <>
          <div className="mb-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1 block">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-8 rounded cursor-pointer border-0"
                value={store.brushColor}
                onChange={(e) => store.setBrushColor(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      store.brushColor === color
                        ? 'border-primary scale-110'
                        : 'border-base-content/20 hover:border-base-content/40'
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1 flex justify-between">
              <span>Size</span>
              <span className="text-base-content/60">{store.brushSize}px</span>
            </label>
            <input
              type="range"
              className="range range-primary range-xs w-full"
              min={1}
              max={50}
              value={store.brushSize}
              onChange={(e) => store.setBrushSize(Number(e.target.value))}
            />
          </div>

          {/* Opacity */}
          <div className="mb-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1 flex justify-between">
              <span>Opacity</span>
              <span className="text-base-content/60">{Math.round(store.brushOpacity * 100)}%</span>
            </label>
            <input
              type="range"
              className="range range-primary range-xs w-full"
              min={5}
              max={100}
              value={Math.round(store.brushOpacity * 100)}
              onChange={(e) => store.setBrushOpacity(Number(e.target.value) / 100)}
            />
          </div>

          {/* Feather (always available for brush) */}
          {store.activeTool === 'brush' && (
            <div className="mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1 flex justify-between">
                <span>Feather</span>
                <span className="text-base-content/60">{store.brushShadowBlur}px</span>
              </label>
              <input
                type="range"
                className="range range-secondary range-xs w-full"
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
      <div className="flex items-center gap-1 pt-2 border-t border-base-content/10">
        <button
          className="btn btn-ghost btn-xs gap-1 flex-1"
          onClick={store.undoBrushStroke}
          disabled={store.brushStrokes.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={12} /> Undo
        </button>
        <button
          className="btn btn-ghost btn-xs gap-1 flex-1"
          onClick={store.redoBrushStroke}
          disabled={store._brushRedoStack.length === 0}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={12} /> Redo
        </button>
        <button
          className="btn btn-ghost btn-xs btn-square text-error"
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
