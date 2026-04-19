import { useEffect, useState } from 'react'
import { restoreCustomFont, FONT_ID_MAP } from '../../config/fonts'
import type { FontDefinition, MoodType } from '../../types'
import { getAllFonts } from '../../services/fontStorage'
import { Button, SelectField } from '../ui/primitives'

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
      <SelectField
        value={currentFont}
        onChange={onSelect}
        options={[
          ...fontOptions.map((opt) => ({ value: opt.id, label: opt.name })),
          ...customFonts.map((f) => ({ value: f.name, label: f.name })),
        ]}
      />

      {/* Mood-based font suggestion */}
      {currentFont !== moodFontId && moodFont && (
        <Button
          variant="soft"
          size="sm"
          className="w-full"
          onClick={() => onSelect(moodFontId)}
        >
          ใช้ฟอนต์ตามอารมณ์ข้อความ: {moodFont.name}
        </Button>
      )}

      {/* Live preview */}
      <div className="rounded-[8px] bg-black/30 p-2 text-center">
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
