import { useEffect, useRef, useState, useCallback } from 'react'
import { restoreCustomFont, FONT_ID_MAP } from '../../config/fonts'
import type { FontDefinition, MoodType } from '../../types'
import { getAllFonts } from '../../services/fontStorage'
import { MOOD_LABELS } from '../../config/fonts'
import { ChevronDown, Search } from 'lucide-react'

// ─── Mood emotion tags on bundled fonts ───────────────────────
// Each bundled font ID maps to which moods it best represents
const FONT_MOOD_TAGS: Record<string, MoodType[]> = {
  normal: ['normal'],
  normal_bold: ['normal'],
  normal_italic: ['narration'],
  shouting: ['shouting'],
  comedy: ['comedy'],
  comedy_bold: ['comedy'],
  whisper: ['whisper'],
  narration: ['narration'],
  sfx: ['sfx'],
  cute: ['comedy'],
}

// Readable label for each font ID
const FONT_DISPLAY_NAMES: Record<string, string> = {
  normal: 'Sarabun',
  normal_bold: 'Sarabun Bold',
  normal_italic: 'Sarabun Italic',
  shouting: 'Kanit Bold',
  comedy: 'K2D',
  comedy_bold: 'K2D Bold',
  whisper: 'Prompt Light',
  narration: 'Prompt',
  sfx: 'Bai Jamjuree Bold',
  cute: 'Mitr',
}

// Group bundled fonts by primary mood category for display
type MoodGroup = {
  mood: MoodType
  label: string
  fontIds: string[]
}

const MOOD_GROUPS: MoodGroup[] = [
  { mood: 'normal', label: 'สนทนาทั่วไป', fontIds: ['normal', 'normal_bold', 'normal_italic'] },
  { mood: 'shouting', label: 'ตะโกน / โกรธ', fontIds: ['shouting'] },
  { mood: 'whisper', label: 'กระซิบ / นุ่มนวล', fontIds: ['whisper'] },
  { mood: 'comedy', label: 'ตลก / สนุกสนาน', fontIds: ['comedy', 'comedy_bold', 'cute'] },
  { mood: 'narration', label: 'บรรยาย / เล่าเรื่อง', fontIds: ['narration'] },
  { mood: 'sfx', label: 'เสียงเอฟเฟกต์', fontIds: ['sfx'] },
]

interface FontSelectorProps {
  currentFont: string
  mood: MoodType
  onSelect: (fontId: string) => void
  compact?: boolean
}

function EmotionTag({ moods }: { moods: MoodType[] }) {
  const primary = moods[0]
  const colorMap: Record<MoodType, string> = {
    normal: 'bg-[rgba(255,255,255,0.06)] text-[var(--moxzk-muted)]',
    shouting: 'bg-[rgba(239,68,68,0.12)] text-[#fca5a5]',
    whisper: 'bg-[rgba(147,197,253,0.1)] text-[#93c5fd]',
    comedy: 'bg-[rgba(250,204,21,0.1)] text-[#fde047]',
    narration: 'bg-[rgba(167,139,250,0.1)] text-[#c4b5fd]',
    sfx: 'bg-[rgba(52,211,153,0.1)] text-[#6ee7b7]',
  }
  return (
    <span
      className={`shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${colorMap[primary] ?? colorMap.normal}`}
    >
      {MOOD_LABELS[primary]}
    </span>
  )
}

export default function FontSelector({
  currentFont,
  onSelect,
  compact = false,
}: FontSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [customFonts, setCustomFonts] = useState<FontDefinition[]>([])
  const [highlightIndex, setHighlightIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load persisted custom fonts
  useEffect(() => {
    getAllFonts()
      .then(async (storedFonts) => {
        const restored: FontDefinition[] = []
        for (const sf of storedFonts) {
          try {
            const fd = await restoreCustomFont(sf)
            restored.push(fd)
          } catch {
            // already registered or invalid
          }
        }
        setCustomFonts(restored)
      })
      .catch(() => {})
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 10)
      setHighlightIndex(0)
    } else {
      setSearch('')
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const trigger = triggerRef.current
      const list = listRef.current
      if (trigger && !trigger.contains(e.target as Node) && list && !list.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Resolve display name + font family for current selection
  const resolvedFamily = FONT_ID_MAP[currentFont]?.family ?? currentFont
  const currentLabel = FONT_DISPLAY_NAMES[currentFont] ?? currentFont

  // ─── Flat list of all selectable items for keyboard nav ────
  type FontItem = {
    id: string
    label: string
    family: string
    weight: number
    style: string
    moodTags?: MoodType[]
    isCustom?: boolean
    isMuted?: boolean
  }

  const allBundledItems: FontItem[] = Object.entries(FONT_DISPLAY_NAMES).map(([id, label]) => ({
    id,
    label,
    family: FONT_ID_MAP[id]?.family ?? id,
    weight: FONT_ID_MAP[id]?.weight ?? 400,
    style: FONT_ID_MAP[id]?.style ?? 'normal',
    moodTags: FONT_MOOD_TAGS[id],
  }))

  const customItems: FontItem[] = customFonts.map((f) => ({
    id: f.name,
    label: f.name,
    family: f.family,
    weight: f.weight,
    style: f.style,
    isCustom: true,
  }))

  const filterItems = useCallback(
    (items: FontItem[]) => {
      if (!search) return items
      const q = search.toLowerCase()
      return items.filter((item) => item.label.toLowerCase().includes(q) || item.family.toLowerCase().includes(q))
    },
    [search],
  )

  const filteredGroups = MOOD_GROUPS.map((g) => ({
    ...g,
    items: filterItems(allBundledItems.filter((f) => g.fontIds.includes(f.id))),
  })).filter((g) => g.items.length > 0)

  const filteredCustom = filterItems(customItems)

  // Flatten for keyboard nav
  const flatItems: FontItem[] = [
    ...filteredGroups.flatMap((g) => g.items),
    ...filteredCustom,
  ]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, flatItems.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && flatItems[highlightIndex]) {
      onSelect(flatItems[highlightIndex].id)
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const handleSelect = (id: string) => {
    onSelect(id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const renderItem = (item: FontItem) => {
    const isSelected = item.id === currentFont
    const isHighlighted = flatItems.indexOf(item) === highlightIndex
    return (
      <button
        key={item.id}
        role="option"
        aria-selected={isSelected}
        data-highlighted={isHighlighted}
        className={`flex w-full items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] transition-colors ${
          item.isMuted ? 'opacity-35' : ''
        } ${
          isSelected
            ? 'bg-[var(--moxzk-accent)] text-white'
            : isHighlighted
            ? 'bg-white/[0.07] text-[var(--moxzk-text)]'
            : 'text-[var(--moxzk-muted)] hover:bg-white/[0.05] hover:text-[var(--moxzk-text)]'
        }`}
        onClick={() => handleSelect(item.id)}
        onMouseEnter={() => setHighlightIndex(flatItems.indexOf(item))}
      >
        <span
          className="truncate font-medium"
          style={{ fontFamily: `"${item.family}", sans-serif`, fontWeight: item.weight, fontStyle: item.style }}
        >
          {item.label}
        </span>
        {item.moodTags && !isSelected && <EmotionTag moods={item.moodTags} />}
        {item.isCustom && !isSelected && (
          <span className="shrink-0 rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--moxzk-dim)]">
            custom
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="relative">
      {/* ─── Trigger button ──── */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="moxzk-control flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
      >
        <span
          className="truncate text-[13px] font-medium"
          style={{ fontFamily: `"${resolvedFamily}", sans-serif` }}
        >
          {currentLabel}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-[var(--moxzk-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* ─── Dropdown ──── */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-[300] mt-1 w-full min-w-[13rem] overflow-hidden rounded-[10px] border border-[var(--moxzk-border)] bg-[rgba(18,18,18,0.97)] shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-[var(--moxzk-border)] px-2.5 py-2">
            <Search size={12} className="shrink-0 text-[var(--moxzk-dim)]" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              placeholder="ค้นหาฟอนต์..."
              className="flex-1 bg-transparent text-[13px] text-[var(--moxzk-text)] placeholder-[var(--moxzk-dim)] outline-none"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlightIndex(0) }}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Font list */}
          <div className="max-h-[min(22rem,50vh)] overflow-y-auto p-1.5 space-y-0.5">
            {filteredGroups.length === 0 && filteredCustom.length === 0 && (
              <p className="py-4 text-center text-[12px] text-[var(--moxzk-dim)]">ไม่พบฟอนต์ที่ค้นหา</p>
            )}

            {/* Categorized bundled fonts */}
            {filteredGroups.map((group) => (
              <div key={group.mood}>
                <div className="px-2 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--moxzk-dim)]">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => renderItem(item))}
                </div>
              </div>
            ))}

            {/* Custom fonts section */}
            {filteredCustom.length > 0 && (
              <div>
                <div className="px-2 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--moxzk-dim)]">
                  ฟอนต์ที่เพิ่มเอง
                </div>
                <div className="space-y-0.5">
                  {filteredCustom.map((item) => renderItem(item))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Font preview */}
      {!open && (
        <div className={`mt-1.5 rounded-[6px] bg-black/30 ${compact ? 'px-2 py-1.5' : 'p-2'}`}>
          <span
            className={compact ? 'text-sm leading-none text-[var(--moxzk-muted)]' : 'text-base text-[var(--moxzk-muted)]'}
            style={{ fontFamily: `"${resolvedFamily}", sans-serif` }}
          >
            สวัสดีครับ — Hello World
          </span>
        </div>
      )}
    </div>
  )
}
