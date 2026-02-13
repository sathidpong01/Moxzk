import { useEffect, useState } from 'react'
import { restoreCustomFont, FONT_ID_MAP } from '../../config/fonts'
import type { FontDefinition, MoodType } from '../../types'
import { getAllFonts } from '../../services/fontStorage'

interface FontSelectorProps {
  currentFont: string
  mood: MoodType
  onSelect: (fontId: string) => void
}

export default function FontSelector({
  currentFont,
  mood,
  onSelect,
}: FontSelectorProps) {
  const [customFonts, setCustomFonts] = useState<FontDefinition[]>([])

  useEffect(() => {
    getAllFonts().then(async (storedFonts) => {
      const restored: FontDefinition[] = []
      for (const sf of storedFonts) {
        try {
          const fd = await restoreCustomFont(sf)
          restored.push(fd)
        } catch {
          // font already registered or invalid — skip
        }
      }
      setCustomFonts(restored)
    }).catch(() => {})
  }, [])

  const fontOptions = Object.entries(FONT_ID_MAP).map(([id, font]) => ({
    id,
    name: font.name,
    family: font.family,
  }))

  // The mood-based default font ID
  const moodFontId = mood
  const moodFont = FONT_ID_MAP[moodFontId]
  const resolvedFamily = FONT_ID_MAP[currentFont]?.family ?? currentFont

  return (
    <div className="space-y-2">
      <select
        className="select select-bordered select-sm w-full"
        value={currentFont}
        onChange={(e) => onSelect(e.target.value)}
      >
        {fontOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
        {customFonts.length > 0 && (
          <optgroup label="Custom">
            {customFonts.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Mood-based font suggestion */}
      {currentFont !== moodFontId && moodFont && (
        <button
          className="btn btn-xs btn-outline btn-info w-full"
          onClick={() => onSelect(moodFontId)}
        >
          🤖 ใช้ฟอนต์ตาม mood: {moodFont.name}
        </button>
      )}

      {/* Live preview */}
      <div className="bg-base-300 rounded-lg p-2 text-center">
        <span
          className="text-base"
          style={{ fontFamily: `"${resolvedFamily}", sans-serif` }}
        >
          ตัวอย่างฟอนต์ — สวัสดีครับ!
        </span>
      </div>
    </div>
  )
}
