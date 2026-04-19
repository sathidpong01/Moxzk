import { useCallback, useEffect, useState } from 'react'
import type { FontDefinition, FontMoodMap, MoodType } from '../../types'
import { BUILT_IN_FONTS, MOOD_LABELS, registerCustomFont, restoreCustomFont, fontToCss } from '../../config/fonts'
import { getAllFonts, deleteFont as deleteFontFromDB } from '../../services/fontStorage'
import { Type, RotateCcw, X as XIcon, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Field, Modal, SelectField } from '../ui/primitives'

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

  useEffect(() => {
    getAllFonts().then(async (storedFonts) => {
      const restored: FontDefinition[] = []
      for (const sf of storedFonts) {
        try {
          restored.push(await restoreCustomFont(sf))
        } catch (err) {
          console.warn(`Failed to restore font "${sf.name}":`, err)
        }
      }
      setCustomFonts(restored)
    }).catch((err) => {
      console.error('Failed to load cached fonts:', err)
    })
  }, [])

  const allFonts = [...BUILT_IN_FONTS, ...customFonts]

  const handleFontChange = useCallback(
    (mood: MoodType, fontName: string) => {
      const font = allFonts.find((f) => f.name === fontName)
      if (font) setDraft((prev) => ({ ...prev, [mood]: font }))
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
    toast.success('บันทึกการตั้งค่าฟอนต์เรียบร้อย')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={<span className="flex items-center gap-2"><Type size={18} /> ตั้งค่าฟอนต์</span>} className="max-w-3xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--mg-muted)]">
            <tr>
              <th className="px-2 py-2">อารมณ์</th>
              <th className="px-2 py-2">คำอธิบาย</th>
              <th className="px-2 py-2">ฟอนต์</th>
              <th className="px-2 py-2">ตัวอย่าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mg-border)]">
            {MOODS.map((mood) => (
              <tr key={mood}>
                <td className="px-2 py-2"><Badge>{mood}</Badge></td>
                <td className="px-2 py-2 text-xs text-[var(--mg-muted)]">{MOOD_LABELS[mood]}</td>
                <td className="px-2 py-2">
                  <SelectField
                    value={draft[mood].name}
                    onChange={(fontName) => handleFontChange(mood, fontName)}
                    options={allFonts.map((font) => ({ value: font.name, label: font.name }))}
                  />
                </td>
                <td className="px-2 py-2">
                  <span className="text-sm" style={{ font: fontToCss(draft[mood]) }}>
                    สวัสดีครับ
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="my-4 h-px bg-[var(--mg-border)]" />
      <Field label="อัปโหลดฟอนต์เอง (.ttf / .otf / .woff2)">
        <input
          type="file"
          className="mg-control"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleUploadFont}
          disabled={uploading}
        />
        {uploading && <span className="mt-2 text-xs text-[var(--mg-muted)]">กำลังอัปโหลด...</span>}
      </Field>

      {customFonts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-[var(--mg-muted)]">ฟอนต์ที่โหลดไว้:</p>
          <div className="flex flex-wrap gap-1">
            {customFonts.map((font) => (
              <Badge key={font.name}>
                {font.name}
                <button
                  className="ml-1 text-[var(--mg-danger)]"
                  onClick={async () => {
                    await deleteFontFromDB(font.name)
                    setCustomFonts((prev) => prev.filter((current) => current.name !== font.name))
                  }}
                  title={`ลบฟอนต์ ${font.name}`}
                >
                  x
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setDraft({ ...moodMap })}>
          <RotateCcw size={14} /> รีเซ็ต
        </Button>
        <Button variant="ghost" onClick={onClose}>
          <XIcon size={14} /> ยกเลิก
        </Button>
        <Button variant="primary" onClick={handleSave}>
          <Save size={14} /> บันทึก
        </Button>
      </div>
    </Modal>
  )
}
