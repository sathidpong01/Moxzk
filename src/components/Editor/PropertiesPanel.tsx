import { useState } from 'react'
import type { TextRegion, MoodType, TextLayoutMode, TextStrokeJoin } from '../../types'
import { MOOD_LABELS } from '../../config/fonts'
import { useAppStore } from '../../store/appStore'
import { normalizeTextLayoutMode } from '../../utils/textLayout'
import { translateSingleRegion } from '../../services/ollama'
import FontSelector from './FontSelector'
import { Trash2, RotateCcw, Languages, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, SelectField, TextareaField, TextInput } from '../ui/primitives'

interface PropertiesPanelProps {
  region: TextRegion | null
  onUpdate: (id: string, updates: Partial<TextRegion>) => void
  onDelete?: (id: string) => void
}

const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']
const STROKE_JOINS: Array<{ value: TextStrokeJoin; label: string }> = [
  { value: 'round', label: 'Round corners' },
  { value: 'bevel', label: 'Bevel corners' },
  { value: 'miter', label: 'Sharp corners' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-muted)]">
      {children}
    </h3>
  )
}

function SliderRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-[var(--mg-muted)]">{label}</span>
        <span className="font-mono text-[var(--mg-dim)]">{value}</span>
      </div>
      {children}
    </div>
  )
}

export default function PropertiesPanel({
  region,
  onUpdate,
  onDelete,
}: PropertiesPanelProps) {
  const [translating, setTranslating] = useState(false)

  if (!region) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[var(--mg-muted)]">
          เลือก text region บน canvas เพื่อแก้ไข
        </p>
      </div>
    )
  }

  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
  const modeHint = layoutMode === 'balloon_fit'
    ? 'ปรับขนาดกล่องเพื่อให้ข้อความจัดบรรทัดใหม่'
    : 'ย้าย หมุน และยืดข้อความแบบอิสระ'

  const translateRegion = async () => {
    if (!region.originalText || translating) return
    const settings = useAppStore.getState().settings
    setTranslating(true)
    try {
      const result = await translateSingleRegion(
        region.originalText,
        settings.sourceLang,
        {
          ollamaUrl: settings.ollamaUrl,
          ollamaModel: settings.ollamaModel,
          ollamaApiKey: settings.ollamaApiKey,
        },
      )
      onUpdate(region.id, { translatedText: result })
      toast.success('แปลเสร็จ!')
    } catch (err) {
      toast.error('แปลไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionTitle>Type</SectionTitle>
            <p className="mt-1 text-[11px] leading-snug text-[var(--mg-dim)]">{modeHint}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={layoutMode === 'balloon_fit'}
            onClick={() => onUpdate(region.id, { textLayoutMode: 'balloon_fit', textScaleX: 1, textScaleY: 1 })}
          >
            Auto fit
          </Button>
        </div>

        <Field label="Layout">
          <SelectField
            value={layoutMode}
            onChange={(nextMode: TextLayoutMode) => {
              onUpdate(region.id, {
                textLayoutMode: nextMode,
                ...(nextMode === 'balloon_fit' ? { textScaleX: 1, textScaleY: 1 } : {}),
              })
            }}
            options={[
              { value: 'balloon_fit', label: 'Balloon fit' },
              { value: 'artistic', label: 'Artistic transform' },
            ]}
          />
        </Field>

        <Field label="Font">
          <FontSelector
            currentFont={region.suggestedFont}
            mood={region.mood}
            onSelect={(fontId) => onUpdate(region.id, { suggestedFont: fontId })}
          />
        </Field>

        <Field label="Mood">
          <SelectField
            value={region.mood}
            onChange={(mood) => onUpdate(region.id, { mood })}
            options={MOODS.map((m) => ({ value: m, label: `${MOOD_LABELS[m]} (${m})` }))}
          />
        </Field>
      </section>

      <div className="mg-divider" />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Text</SectionTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={translating || !region.originalText}
            onClick={translateRegion}
          >
            {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
            แปลใหม่
          </Button>
        </div>

        <Field label="Translation">
          <TextareaField
            rows={4}
            className="resize-none"
            value={region.translatedText}
            onChange={(e) => onUpdate(region.id, { translatedText: e.target.value })}
          />
        </Field>

        <details className="group rounded-[7px] border border-[var(--mg-border)] bg-black/20">
          <summary className="cursor-pointer px-2.5 py-2 text-xs font-bold text-[var(--mg-muted)]">
            Original text
          </summary>
          <p className="border-t border-[var(--mg-border)] p-2.5 font-mono text-xs leading-relaxed text-[var(--mg-muted)]">
            {region.originalText || 'ไม่มีข้อความต้นฉบับ'}
          </p>
        </details>
      </section>

      <div className="mg-divider" />

      <section className="space-y-3">
        <SectionTitle>Appearance</SectionTitle>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <SliderRow
            label={layoutMode === 'balloon_fit' ? 'Max size' : 'Size'}
            value={`${Math.round(region.fontSize)}px`}
          >
            <input
              type="range"
              className="mg-slider"
              min={8}
              max={72}
              value={region.fontSize}
              onChange={(e) => onUpdate(region.id, { fontSize: Number(e.target.value) })}
            />
          </SliderRow>
          <div className="space-y-1">
            <span className="block text-xs font-bold text-[var(--mg-muted)]">Color</span>
            <input
              type="color"
              className="h-8 w-9 cursor-pointer rounded-[6px] border border-[var(--mg-border)] bg-transparent"
              value={region.fontColor}
              onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
              aria-label="Text color"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <SliderRow label="Stroke" value={`${region.strokeWidth}px`}>
            <input
              type="range"
              className="mg-slider"
              min={0}
              max={8}
              step={0.5}
              value={region.strokeWidth}
              onChange={(e) => onUpdate(region.id, { strokeWidth: Number(e.target.value) })}
            />
          </SliderRow>
          <div className="space-y-1">
            <span className="block text-xs font-bold text-[var(--mg-muted)]">Stroke</span>
            <input
              type="color"
              className="h-8 w-9 cursor-pointer rounded-[6px] border border-[var(--mg-border)] bg-transparent"
              value={region.strokeColor}
              onChange={(e) => onUpdate(region.id, { strokeColor: e.target.value })}
              aria-label="Stroke color"
            />
          </div>
        </div>

        <Field label="Stroke corner">
          <SelectField
            value={region.strokeJoin ?? 'round'}
            onChange={(strokeJoin: TextStrokeJoin) => onUpdate(region.id, { strokeJoin })}
            options={STROKE_JOINS}
          />
        </Field>

        <SliderRow label="Rotation" value={`${Math.round(region.rotation)}°`}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              className="mg-slider"
              min={-180}
              max={180}
              value={region.rotation}
              onChange={(e) => onUpdate(region.id, { rotation: Number(e.target.value) })}
            />
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 px-2"
              disabled={region.rotation === 0}
              onClick={() => onUpdate(region.id, { rotation: 0 })}
              title="Reset rotation"
            >
              <RotateCcw size={11} />
            </Button>
          </div>
        </SliderRow>

        <Field label="Hex">
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              type="text"
              className="font-mono"
              value={region.fontColor}
              onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
              aria-label="Text color hex"
            />
            <TextInput
              type="text"
              className="font-mono"
              value={region.strokeColor}
              onChange={(e) => onUpdate(region.id, { strokeColor: e.target.value })}
              aria-label="Stroke color hex"
            />
          </div>
        </Field>
      </section>

      {onDelete && (
        <>
          <div className="mg-divider" />
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => onDelete(region.id)}
          >
            <Trash2 size={14} />
            Delete region
          </Button>
        </>
      )}
    </div>
  )
}
