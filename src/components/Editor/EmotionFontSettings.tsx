import { useState, useRef, useEffect, useCallback } from 'react'
import type { FontMoodMap, MoodType } from '../../types'
import { MOOD_LABELS, FONT_ID_MAP } from '../../config/fonts'
import { getAllFonts, type StoredFont } from '../../services/fontStorage'
import { Search, ChevronDown } from 'lucide-react'

// ─── All font IDs with labels ──────────────────────────────────
const BUNDLED_FONT_OPTIONS: Array<{ id: string; label: string; family: string; weight: number; style: string }> =
  Object.entries(FONT_ID_MAP).map(([id, def]) => ({
    id,
    label: def.name,
    family: def.family,
    weight: def.weight,
    style: def.style,
  }))

const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']

// ─── Inline font picker for each mood row ─────────────────────
interface InlineFontPickerProps {
  value: string
  onChange: (fontId: string) => void
  customFonts: StoredFont[]
}

function InlineFontPicker({ value, onChange, customFonts }: InlineFontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentDef = FONT_ID_MAP[value]
  const currentLabel = currentDef?.name ?? value
  const currentFamily = currentDef?.family ?? value

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10)
    else setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = triggerRef.current
      const l = listRef.current
      if (t && !t.contains(e.target as Node) && l && !l.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const allOptions = [
    ...BUNDLED_FONT_OPTIONS,
    ...customFonts.map((f) => ({ id: f.name, label: f.name, family: f.family, weight: f.weight, style: f.style })),
  ]

  const filtered = search
    ? allOptions.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()) || o.family.toLowerCase().includes(search.toLowerCase()))
    : allOptions

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[10rem] max-w-[13rem] cursor-pointer items-center justify-between gap-2 rounded-[7px] border border-[var(--moxzk-border)] bg-white/[0.04] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.07]"
      >
        <span
          className="truncate text-[13px] font-medium text-[var(--moxzk-text)]"
          style={{ fontFamily: `"${currentFamily}", sans-serif` }}
        >
          {currentLabel}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-[var(--moxzk-dim)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute right-0 top-full z-[400] mt-1 w-56 overflow-hidden rounded-[10px] border border-[var(--moxzk-border)] bg-[rgba(18,18,18,0.98)] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-[var(--moxzk-border)] px-2.5 py-2">
            <Search size={11} className="shrink-0 text-[var(--moxzk-dim)]" />
            <input
              ref={searchRef}
              type="text"
              placeholder="ค้นหา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-[var(--moxzk-text)] placeholder-[var(--moxzk-dim)] outline-none"
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            />
          </div>

          {/* List */}
          <div className="max-h-[16rem] overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 && (
              <p className="py-3 text-center text-[12px] text-[var(--moxzk-dim)]">ไม่พบ</p>
            )}
            {filtered.map((opt) => {
              const isSelected = opt.id === value
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] transition-colors ${
                    isSelected
                      ? 'bg-[var(--moxzk-accent)] text-white'
                      : 'text-[var(--moxzk-muted)] hover:bg-white/[0.06] hover:text-[var(--moxzk-text)]'
                  }`}
                  onClick={() => { onChange(opt.id); setOpen(false) }}
                >
                  <span
                    className="truncate font-medium"
                    style={{ fontFamily: `"${opt.family}", sans-serif`, fontWeight: opt.weight }}
                  >
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main EmotionFontSettings component ───────────────────────
interface EmotionFontSettingsProps {
  fontMoodMap: FontMoodMap
  onChange: (map: FontMoodMap) => void
}

export default function EmotionFontSettings({ fontMoodMap, onChange }: EmotionFontSettingsProps) {
  const [customFonts, setCustomFonts] = useState<StoredFont[]>([])

  useEffect(() => {
    getAllFonts().then(setCustomFonts).catch(() => {})
  }, [])

  const handleMoodFontChange = useCallback(
    (mood: MoodType, fontId: string) => {
      const fontDef = FONT_ID_MAP[fontId] ?? {
        name: fontId,
        family: fontId,
        weight: 400,
        style: 'normal' as const,
        isCustom: true,
      }
      onChange({ ...fontMoodMap, [mood]: fontDef })
    },
    [fontMoodMap, onChange],
  )

  return (
    <div className="space-y-1.5">
      {MOODS.map((mood) => {
        const currentFont = fontMoodMap[mood]
        // Find the font ID that matches the current font definition
        const currentFontId =
          Object.entries(FONT_ID_MAP).find(([, def]) => def.name === currentFont.name)?.[0] ?? currentFont.name

        return (
          <div
            key={mood}
            className="flex items-center justify-between gap-4 rounded-[8px] bg-white/[0.025] px-3 py-2.5"
          >
            {/* Left: mood info */}
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--moxzk-text)]">{MOOD_LABELS[mood]}</div>
              <div className="text-[11px] text-[var(--moxzk-dim)]">{mood}</div>
            </div>

            {/* Right: font picker */}
            <InlineFontPicker
              value={currentFontId}
              onChange={(id) => handleMoodFontChange(mood, id)}
              customFonts={customFonts}
            />
          </div>
        )
      })}
    </div>
  )
}
