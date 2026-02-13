import type { TextRegion, MoodType, FontMoodMap } from '../../types'
import { MOOD_LABELS } from '../../config/fonts'
import FontSelector from './FontSelector'

interface PropertiesPanelProps {
  region: TextRegion | null
  moodMap: FontMoodMap
  onUpdate: (id: string, updates: Partial<TextRegion>) => void
}

const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']

export default function PropertiesPanel({
  region,
  moodMap,
  onUpdate,
}: PropertiesPanelProps) {
  if (!region) {
    return (
      <div className="card bg-base-200 card-compact">
        <div className="card-body items-center text-center">
          <p className="text-sm text-base-content/40">
            เลือก text region บน canvas เพื่อแก้ไข
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Original text */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Original
          </h3>
          <p className="text-sm bg-base-300 rounded-lg p-2 font-mono">
            {region.originalText}
          </p>
        </div>
      </div>

      {/* Translation */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Translation
          </h3>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full"
            rows={3}
            value={region.translatedText}
            onChange={(e) => onUpdate(region.id, { translatedText: e.target.value })}
          />
        </div>
      </div>

      {/* Mood */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Mood
          </h3>
          <select
            className="select select-bordered select-sm w-full"
            value={region.mood}
            onChange={(e) => onUpdate(region.id, { mood: e.target.value as MoodType })}
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m} — {MOOD_LABELS[m]}
              </option>
            ))}
          </select>
          {region.suggestedFont && (
            <div className="badge badge-sm badge-info mt-1">
              🤖 AI: {region.suggestedFont}
            </div>
          )}
        </div>
      </div>

      {/* Font */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Font
          </h3>
          <FontSelector
            currentFont={region.suggestedFont}
            moodMap={moodMap}
            mood={region.mood}
            onSelect={(fontName) => onUpdate(region.id, { suggestedFont: fontName })}
          />
        </div>
      </div>

      {/* Font size */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Size: {region.fontSize}px
          </h3>
          <input
            type="range"
            className="range range-primary range-xs"
            min={8}
            max={72}
            value={region.fontSize}
            onChange={(e) => onUpdate(region.id, { fontSize: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Color */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Color
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="w-8 h-8 rounded cursor-pointer"
              value={region.fontColor}
              onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
            />
            <input
              type="text"
              className="input input-bordered input-xs flex-1 font-mono"
              value={region.fontColor}
              onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
