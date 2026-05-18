import { useCallback, useEffect, useRef, useState } from 'react'
import type { FontDefinition, FontMoodMap, MoodType } from '../../types'
import { BUILT_IN_FONTS, MOOD_LABELS, registerCustomFont, restoreCustomFont, fontToCss } from '../../config/fonts'
import { getAllFonts, deleteFont as deleteFontFromDB } from '../../services/fontStorage'
import { Type, RotateCcw, X as XIcon, Save, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Field, Modal, SelectField, cn } from '../ui/primitives'

const FONT_FILE_PATTERN = /\.(ttf|otf|woff2?)$/i

function describeFontWeight(weight: number): string {
  if (weight >= 700) return 'หนา'
  if (weight >= 600) return 'กึ่งหนา'
  if (weight <= 300) return 'บาง'
  return 'ปกติ'
}

interface FontConfigPageProps {
  moodMap: FontMoodMap
  onSave: (moodMap: FontMoodMap) => void | Promise<void>
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
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const processFontFiles = useCallback(async (files: File[]) => {
    const fontFiles = files.filter((file) => FONT_FILE_PATTERN.test(file.name))
    if (fontFiles.length === 0) {
      if (files.length > 0) toast.error('รองรับเฉพาะไฟล์ฟอนต์ .ttf / .otf / .woff2')
      return
    }
    setUploading(true)
    let added = 0
    try {
      for (const file of fontFiles) {
        const name = file.name.replace(FONT_FILE_PATTERN, '')
        try {
          const font = await registerCustomFont(name, file)
          setCustomFonts((prev) => {
            const next = prev.filter((current) => current.name !== font.name)
            return [...next, font]
          })
          added += 1
        } catch (err) {
          console.error(`Failed to register custom font "${name}":`, err)
          toast.error(`เพิ่มฟอนต์ "${name}" ไม่สำเร็จ`)
        }
      }
      if (added > 0) toast.success(`เพิ่มฟอนต์ ${added} ไฟล์ ระบบอ่านน้ำหนัก/สไตล์ให้อัตโนมัติ`)
    } finally {
      setUploading(false)
    }
  }, [])

  const handleUploadFont = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processFontFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }, [processFontFiles])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    await processFontFiles(Array.from(e.dataTransfer.files))
  }, [processFontFiles])

  const handleSave = async () => {
    await onSave(draft)
    onClose()
    toast.success('บันทึกการตั้งค่าฟอนต์เรียบร้อย')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={<span className="flex items-center gap-2"><Type size={18} /> ตั้งค่าฟอนต์</span>} className="max-w-3xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--moxzk-muted)]">
            <tr>
              <th className="px-2 py-2">อารมณ์</th>
              <th className="px-2 py-2">คำอธิบาย</th>
              <th className="px-2 py-2">ฟอนต์</th>
              <th className="px-2 py-2">ตัวอย่าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--moxzk-border)]">
            {MOODS.map((mood) => (
              <tr key={mood}>
                <td className="px-2 py-2"><Badge>{mood}</Badge></td>
                <td className="px-2 py-2 text-xs text-[var(--moxzk-muted)]">{MOOD_LABELS[mood]}</td>
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

      <div className="my-4 h-px bg-[var(--moxzk-border)]" />
      <Field label="เพิ่มฟอนต์เอง">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => void handleDrop(e)}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-2 border-dashed px-4 py-6 text-center transition',
            dragActive
              ? 'border-[var(--moxzk-accent)] bg-[rgba(37,99,235,0.1)]'
              : 'border-[var(--moxzk-border)] hover:border-[var(--moxzk-muted)]',
          )}
        >
          <UploadCloud size={26} className="text-[var(--moxzk-muted)]" aria-hidden="true" />
          <span className="text-sm font-bold text-[var(--moxzk-text)]">
            {uploading ? 'กำลังเพิ่มฟอนต์…' : 'ลากไฟล์ฟอนต์มาวาง หรือคลิกเพื่อเลือก'}
          </span>
          <span className="text-xs text-[var(--moxzk-muted)]">
            รองรับ .ttf / .otf / .woff2 — ระบบอ่านน้ำหนักและสไตล์ให้อัตโนมัติ
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".ttf,.otf,.woff,.woff2"
          multiple
          onChange={handleUploadFont}
          disabled={uploading}
        />
      </Field>

      {customFonts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-[var(--moxzk-muted)]">ฟอนต์ที่โหลดไว้:</p>
          <div className="flex flex-wrap gap-1.5">
            {customFonts.map((font) => (
              <Badge key={font.name}>
                <span>{font.name}</span>
                <span className="ml-1 text-[10px] text-[var(--moxzk-dim)]">
                  {describeFontWeight(font.weight)}{font.style === 'italic' ? ' · เอียง' : ''}
                </span>
                <button
                  className="ml-1.5 text-[var(--moxzk-danger)]"
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
