import type { TextRegion, MoodType } from '../../types'
import { MOOD_LABELS } from '../../config/fonts'
import FontSelector from './FontSelector'

interface PropertiesPanelProps {
  region: TextRegion | null
  onUpdate: (id: string, updates: Partial<TextRegion>) => void
}

const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']

export default function PropertiesPanel({
  region,
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
    <div className="space-y-2">
      {/* Font — top priority */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body py-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Font
          </h3>
          <FontSelector
            currentFont={region.suggestedFont}
            mood={region.mood}
            onSelect={(fontId) => onUpdate(region.id, { suggestedFont: fontId })}
          />
        </div>
      </div>

      {/* Size + Color — compact row */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body py-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-1">
                Size: {region.fontSize}px
              </h3>
              <input
                type="range"
                className="range range-primary range-xs w-full"
                min={8}
                max={72}
                value={region.fontSize}
                onChange={(e) => onUpdate(region.id, { fontSize: Number(e.target.value) })}
              />
            </div>
            <div className="shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-1">
                Color
              </h3>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="w-7 h-7 rounded cursor-pointer"
                  value={region.fontColor}
                  onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input input-bordered input-xs w-20 font-mono"
                  value={region.fontColor}
                  onChange={(e) => onUpdate(region.id, { fontColor: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mood */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body py-2">
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
        </div>
      </div>

      {/* Translation */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body py-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Translation
          </h3>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full"
            rows={2}
            value={region.translatedText}
            onChange={(e) => onUpdate(region.id, { translatedText: e.target.value })}
          />
        </div>
      </div>

      {/* Original text — read only, compact */}
      <div className="card bg-base-200 card-compact">
        <div className="card-body py-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Original
          </h3>
          <p className="text-xs bg-base-300 rounded p-1.5 font-mono text-base-content/60">
            {region.originalText}
          </p>
        </div>
      </div>
    </div>
  )
}
