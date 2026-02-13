import { BUILT_IN_FONTS, getMoodFont } from '../../config/fonts'
import type { FontMoodMap, MoodType } from '../../types'

interface FontSelectorProps {
  currentFont: string
  moodMap: FontMoodMap
  mood: MoodType
  onSelect: (fontName: string) => void
}

export default function FontSelector({
  currentFont,
  moodMap,
  mood,
  onSelect,
}: FontSelectorProps) {
  const aiSuggested = getMoodFont(mood, moodMap)

  return (
    <div className="space-y-2">
      <select
        className="select select-bordered select-sm w-full"
        value={currentFont}
        onChange={(e) => onSelect(e.target.value)}
      >
        {BUILT_IN_FONTS.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
            {f.name === aiSuggested.name ? ' ★ AI' : ''}
          </option>
        ))}
      </select>

      {/* AI suggestion badge */}
      {currentFont !== aiSuggested.name && (
        <button
          className="btn btn-xs btn-outline btn-info w-full"
          onClick={() => onSelect(aiSuggested.name)}
        >
          🤖 ใช้ฟอนต์ที่ AI แนะนำ: {aiSuggested.name}
        </button>
      )}

      {/* Live preview */}
      <div className="bg-base-300 rounded-lg p-3 text-center">
        <span
          className="text-lg"
          style={{
            fontFamily: `"${currentFont}", sans-serif`,
          }}
        >
          ตัวอย่างฟอนต์ — สวัสดีครับ!
        </span>
      </div>
    </div>
  )
}
