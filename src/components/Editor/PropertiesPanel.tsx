import { useState } from 'react'
import type { TextRegion, MoodType, TextAlign, TextLayoutMode, TextStrokeJoin } from '../../types'
import { MOOD_LABELS } from '../../config/fonts'
import { useAppStore } from '../../store/appStore'
import { normalizeTextLayoutMode } from '../../utils/textLayout'
import { translateSingleRegion } from '../../services/ollama'
import { convertBalloonRegionToArtistic, convertArtisticRegionToBalloon } from '../../services/textRegionMode'
import FontSelector from './FontSelector'
import { AlignCenter, AlignLeft, AlignRight, Trash2, RotateCcw, Languages, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, DisclosureSection, Field, SelectField, TextInput, TextareaField } from '../ui/primitives'

interface PropertiesPanelProps {
  region: TextRegion | null
  onUpdate: (id: string, updates: Partial<TextRegion>) => void
  onDelete?: (id: string) => void
}

const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']
const STROKE_JOINS: Array<{ value: TextStrokeJoin; label: string }> = [
  { value: 'round', label: 'มน' },
  { value: 'bevel', label: 'ปาดมุม' },
  { value: 'miter', label: 'คม' },
]
const TEXT_ALIGNS: Array<{ value: TextAlign; label: string; icon: typeof AlignLeft }> = [
  { value: 'left', label: 'ชิดซ้าย', icon: AlignLeft },
  { value: 'center', label: 'กึ่งกลาง', icon: AlignCenter },
  { value: 'right', label: 'ชิดขวา', icon: AlignRight },
]

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function PropertiesPanel({
  region,
  onUpdate,
  onDelete,
}: PropertiesPanelProps) {
  const [translating, setTranslating] = useState(false)
  const [showOriginalText, setShowOriginalText] = useState(false)
  const editorHistoryShortcutProps = { 'data-editor-history-shortcuts': 'true' }

  if (!region) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[var(--mg-muted)]">
          คลิกข้อความบนหน้าเพื่อแก้ไข
        </p>
      </div>
    )
  }

  const layoutMode = normalizeTextLayoutMode(region.textLayoutMode)
  const textAlign = region.textAlign ?? 'center'

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
    <div className="space-y-3 text-sm">
      <DisclosureSection title="รูปแบบข้อความ">
        <Field label="การวางข้อความ" className="gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <SelectField
              value={layoutMode}
              onChange={(nextMode: TextLayoutMode) => {
                onUpdate(region.id, {
                  textLayoutMode: nextMode,
                  ...(layoutMode === 'balloon_fit' && nextMode === 'artistic'
                    ? convertBalloonRegionToArtistic(region)
                    : {}),
                  ...(layoutMode === 'artistic' && nextMode === 'balloon_fit'
                    ? convertArtisticRegionToBalloon(region)
                    : {}),
                })
              }}
              options={[
                { value: 'balloon_fit', label: 'พอดีกล่อง' },
                { value: 'artistic', label: 'อิสระ' },
              ]}
            />
            <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-[var(--mg-border)] bg-black/20 p-1">
              {TEXT_ALIGNS.map((option) => {
                const Icon = option.icon
                const active = textAlign === option.value
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={active ? 'primary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 justify-center p-0"
                    aria-label={option.label}
                    aria-pressed={active}
                    onClick={() => onUpdate(region.id, { textAlign: option.value })}
                  >
                    <Icon size={14} aria-hidden="true" />
                  </Button>
                )
              })}
            </div>
          </div>
        </Field>

        <Field label="ฟอนต์">
          <FontSelector
            currentFont={region.fontId ?? region.suggestedFont ?? region.mood}
            mood={region.mood}
            onSelect={(fontId) => onUpdate(region.id, { fontId })}
            compact
          />
        </Field>

        <Field label="อารมณ์ข้อความ">
          <SelectField
            value={region.mood}
            onChange={(mood) => onUpdate(region.id, { mood })}
            options={MOODS.map((m) => ({ value: m, label: `${MOOD_LABELS[m]} (${m})` }))}
          />
        </Field>

      </DisclosureSection>

      <DisclosureSection title="ข้อความ">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={translating || !region.originalText}
            onClick={translateRegion}
          >
            {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
            แปลใหม่
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginalText((value) => !value)}
          >
            {showOriginalText ? 'ซ่อนต้นฉบับ' : 'ดูต้นฉบับ'}
          </Button>
        </div>

        <Field label="ข้อความแปล" className="gap-2">
          <TextareaField
            {...editorHistoryShortcutProps}
            rows={3}
            className="min-h-[96px] resize-none"
            value={region.translatedText}
            onChange={(e) => onUpdate(region.id, { translatedText: e.target.value })}
          />
        </Field>

        {showOriginalText && (
          <div className="rounded-[8px] border border-[var(--mg-border)] bg-black/20 px-3 py-2">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-muted)]">
              ข้อความต้นฉบับ
            </div>
            <p className="font-mono text-xs leading-relaxed text-[var(--mg-muted)]">
              {region.originalText || 'ไม่มีข้อความต้นฉบับ'}
            </p>
          </div>
        )}
      </DisclosureSection>

      <DisclosureSection title="ตัวอักษรและขอบ">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[10px] border border-[var(--mg-border)] bg-black/20 p-2.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-muted)]">ตัวอักษร</div>
            <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-2">
              <label className="text-xs font-bold text-[var(--mg-muted)]">ขนาด</label>
              <TextInput
                {...editorHistoryShortcutProps}
                type="number"
                min={8}
                max={72}
                step={1}
                value={Math.round(region.fontSize)}
                className="h-8 text-right text-xs"
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  if (Number.isFinite(nextValue)) {
                    onUpdate(region.id, { fontSize: clampNumber(nextValue, 8, 72) })
                  }
                }}
              />
              <label className="text-xs font-bold text-[var(--mg-muted)]">สี</label>
              <input
                {...editorHistoryShortcutProps}
                type="color"
                className="h-8 w-full cursor-pointer rounded-[8px] border border-[var(--mg-border)] bg-transparent"
                value={region.fontColor}
                onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
                aria-label="สีตัวอักษร"
              />
            </div>
          </div>

          <div className="rounded-[10px] border border-[var(--mg-border)] bg-black/20 p-2.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-muted)]">ขอบ</div>
            <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-2">
              <label className="text-xs font-bold text-[var(--mg-muted)]">หนา</label>
              <TextInput
                {...editorHistoryShortcutProps}
                type="number"
                min={0}
                max={8}
                step={0.5}
                value={region.strokeWidth}
                className="h-8 text-right text-xs"
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  if (Number.isFinite(nextValue)) {
                    onUpdate(region.id, { strokeWidth: clampNumber(nextValue, 0, 8) })
                  }
                }}
              />
              <label className="text-xs font-bold text-[var(--mg-muted)]">สี</label>
              <input
                {...editorHistoryShortcutProps}
                type="color"
                className="h-8 w-full cursor-pointer rounded-[8px] border border-[var(--mg-border)] bg-transparent"
                value={region.strokeColor}
                onChange={(e) => onUpdate(region.id, { strokeColor: e.target.value })}
                aria-label="สีขอบ"
              />
            </div>
            <Field label="ทรงขอบ" className="mt-2 gap-1.5">
              <SelectField
                value={region.strokeJoin ?? 'round'}
                onChange={(strokeJoin: TextStrokeJoin) => onUpdate(region.id, { strokeJoin })}
                options={STROKE_JOINS}
              />
            </Field>
          </div>

          <div className="col-span-2 rounded-[10px] border border-[var(--mg-border)] bg-black/20 p-2.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-muted)]">องศา</div>
            <div className="grid grid-cols-[minmax(0,1fr)_68px_auto] items-center gap-2">
              <label className="text-xs font-bold text-[var(--mg-muted)]">เอียง</label>
              <TextInput
                {...editorHistoryShortcutProps}
                type="number"
                min={-180}
                max={180}
                step={1}
                value={Math.round(region.rotation)}
                className="h-8 text-right text-xs"
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  if (Number.isFinite(nextValue)) {
                    onUpdate(region.id, { rotation: clampNumber(nextValue, -180, 180) })
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2"
                disabled={region.rotation === 0}
                onClick={() => onUpdate(region.id, { rotation: 0 })}
                title="รีเซ็ตการหมุน"
              >
                <RotateCcw size={11} />
              </Button>
            </div>
          </div>
        </div>
      </DisclosureSection>

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
            ลบข้อความนี้
          </Button>
        </>
      )}
    </div>
  )
}
