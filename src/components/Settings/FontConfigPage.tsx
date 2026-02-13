import { useCallback, useEffect, useState } from 'react'
import type { FontDefinition, FontMoodMap, MoodType } from '../../types'
import { BUILT_IN_FONTS, MOOD_LABELS, registerCustomFont, restoreCustomFont, fontToCss } from '../../config/fonts'
import { getAllFonts, deleteFont as deleteFontFromDB } from '../../services/fontStorage'

interface FontConfigPageProps {
  moodMap: FontMoodMap
  onSave: (moodMap: FontMoodMap) => void
  isOpen: boolean
  onClose: () => void
}

const MOODS: MoodType[] = ['normal', 'shouting', 'whisper', 'comedy', 'narration', 'sfx']

export default function FontConfigPage({
  moodMap,
  onSave,
  isOpen,
  onClose,
}: FontConfigPageProps) {
  const [draft, setDraft] = useState<FontMoodMap>({ ...moodMap })
  const [customFonts, setCustomFonts] = useState<FontDefinition[]>([])
  const [uploading, setUploading] = useState(false)

  // Load cached custom fonts from IndexedDB on mount
  useEffect(() => {
    getAllFonts().then(async (storedFonts) => {
      const restored: FontDefinition[] = []
      for (const sf of storedFonts) {
        try {
          const fd = await restoreCustomFont(sf)
          restored.push(fd)
        } catch (err) {
          console.warn(`Failed to restore font "${sf.name}":`, err)
        }
      }
      if (restored.length > 0) {
        setCustomFonts(restored)
      }
    }).catch((err) => {
      console.error('Failed to load cached fonts:', err)
    })
  }, [])

  const allFonts = [...BUILT_IN_FONTS, ...customFonts]

  const handleFontChange = useCallback(
    (mood: MoodType, fontName: string) => {
      const font = allFonts.find((f) => f.name === fontName)
      if (font) {
        setDraft((prev) => ({ ...prev, [mood]: font }))
      }
    },
    [allFonts],
  )

  const handleUploadFont = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '')
      const font = await registerCustomFont(name, file)
      setCustomFonts((prev) => [...prev, font])
    } catch (err) {
      console.error('Failed to register custom font:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [])

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="text-lg font-bold mb-4">🔤 Font Configuration</h3>

        {/* Mood → Font mapping table */}
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Mood</th>
                <th>Description</th>
                <th>Font</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {MOODS.map((mood) => (
                <tr key={mood}>
                  <td>
                    <span className="badge badge-outline badge-sm">{mood}</span>
                  </td>
                  <td className="text-xs text-base-content/60">
                    {MOOD_LABELS[mood]}
                  </td>
                  <td>
                    <select
                      className="select select-bordered select-xs w-full max-w-xs"
                      value={draft[mood].name}
                      onChange={(e) => handleFontChange(mood, e.target.value)}
                    >
                      {BUILT_IN_FONTS.length > 0 && (
                        <optgroup label="Built-in">
                          {BUILT_IN_FONTS.map((f) => (
                            <option key={f.name} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
                  </td>
                  <td>
                    <span
                      className="text-sm"
                      style={{ font: fontToCss(draft[mood]) }}
                    >
                      สวัสดีครับ
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upload custom font */}
        <div className="divider">Custom Font</div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Upload custom font (.ttf / .otf / .woff2)</span>
          </label>
          <input
            type="file"
            className="file-input file-input-bordered file-input-sm w-full max-w-xs"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={handleUploadFont}
            disabled={uploading}
          />
          {uploading && (
            <span className="loading loading-spinner loading-xs mt-2"></span>
          )}
        </div>

        {customFonts.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-base-content/60 mb-1">Custom fonts loaded:</p>
            <div className="flex flex-wrap gap-1">
              {customFonts.map((f) => (
                <span key={f.name} className="badge badge-sm badge-accent gap-1">
                  {f.name}
                  <button
                    className="btn btn-ghost btn-xs px-0 min-h-0 h-auto"
                    onClick={async () => {
                      await deleteFontFromDB(f.name)
                      setCustomFonts((prev) => prev.filter((cf) => cf.name !== f.name))
                    }}
                    title={`ลบฟอนต์ ${f.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={() => setDraft({ ...moodMap })}>
            Reset
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
