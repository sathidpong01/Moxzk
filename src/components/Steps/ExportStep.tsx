import { useEffect, useMemo, useState } from 'react'
import type { ExportFormat } from '../../types'
import type { ImageEntry } from '../../types'
import {
  getExportCompareOriginalUrl,
  getExportThumbnailUrl,
  getNextExportPreviewId,
} from '../../services/exportPreview'
import { renderImageEntryToBlob } from '../../services/exporter'
import SplitView from '../Comparison/SplitView'
import { ArrowLeft, Download, ImageIcon } from 'lucide-react'
import { Button, Field, Panel, SelectField } from '../ui/primitives'

interface ExportStepProps {
  originalImageUrl: string | null
  translatedImageUrl: string | null
  exportFormat: ExportFormat
  exportQuality: number
  imageEntries: ImageEntry[]
  onExportFormatChange: (format: ExportFormat) => void
  onExportQualityChange: (quality: number) => void
  onExport: (selectedIds?: string[]) => void
  onBack: () => void
}

export default function ExportStep({
  originalImageUrl,
  translatedImageUrl,
  exportFormat,
  exportQuality,
  imageEntries,
  onExportFormatChange,
  onExportQualityChange,
  onExport,
  onBack,
}: ExportStepProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const [renderedPreviewUrls, setRenderedPreviewUrls] = useState<Record<string, string>>({})
  const [renderedPreviewErrors, setRenderedPreviewErrors] = useState<Record<string, string>>({})
  const [isRenderingPreview, setIsRenderingPreview] = useState(false)
  const sortedEntries = useMemo(
    () => [...imageEntries].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0)),
    [imageEntries],
  )
  const selectedEntries = useMemo(
    () => sortedEntries.filter((entry) => selectedIds.includes(entry.id)),
    [selectedIds, sortedEntries],
  )

  useEffect(() => {
    setSelectedIds(sortedEntries.map((entry) => entry.id))
  }, [sortedEntries])

  useEffect(() => {
    const nextId = getNextExportPreviewId(selectedEntries, activePreviewId)
    if (nextId !== activePreviewId) setActivePreviewId(nextId)
  }, [activePreviewId, selectedEntries])

  useEffect(() => {
    if (sortedEntries.length <= 1 || selectedEntries.length === 0) {
      setRenderedPreviewUrls({})
      setRenderedPreviewErrors({})
      setIsRenderingPreview(false)
      return
    }

    let cancelled = false
    const objectUrls: string[] = []
    setIsRenderingPreview(true)
    setRenderedPreviewUrls({})
    setRenderedPreviewErrors({})

    void Promise.all(
      selectedEntries.map(async (entry) => {
        try {
          const blob = await renderImageEntryToBlob(entry, exportFormat, exportQuality / 100)
          const url = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return { id: entry.id, url: null, error: null }
          }
          objectUrls.push(url)
          return { id: entry.id, url, error: null }
        } catch (error) {
          return {
            id: entry.id,
            url: null,
            error: error instanceof Error ? error.message : 'สร้างตัวอย่างล้มเหลว',
          }
        }
      }),
    ).then((results) => {
      if (cancelled) return
      const urls: Record<string, string> = {}
      const errors: Record<string, string> = {}
      for (const result of results) {
        if (result.url) urls[result.id] = result.url
        if (result.error) errors[result.id] = result.error
      }
      setRenderedPreviewUrls(urls)
      setRenderedPreviewErrors(errors)
    }).finally(() => {
      if (!cancelled) setIsRenderingPreview(false)
    })

    return () => {
      cancelled = true
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [exportFormat, exportQuality, selectedEntries, sortedEntries.length])

  const allSelected = sortedEntries.length > 0 && selectedIds.length === sortedEntries.length
  const activeEntry = selectedEntries.find((entry) => entry.id === activePreviewId) ?? null
  const activeOriginalUrl = activeEntry ? getExportCompareOriginalUrl(activeEntry) : null
  const activeTranslatedUrl = activeEntry ? renderedPreviewUrls[activeEntry.id] : null
  const activeRenderError = activeEntry ? renderedPreviewErrors[activeEntry.id] : null
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : sortedEntries.map((entry) => entry.id))
  }
  const toggleEntry = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <div className="studio-canvas flex h-full gap-3 p-3 pt-20">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {sortedEntries.length > 1 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[var(--mg-text)]">หน้าที่จะส่งออก</h2>
                  <p className="text-sm text-[var(--mg-muted)]">
                    {activeEntry
                      ? `กำลังดูหน้า ${activeEntry.pageNumber ?? '?'} จาก ${selectedEntries.length} หน้า`
                      : 'เลือกหน้าอย่างน้อย 1 หน้าเพื่อดูตัวอย่าง'}
                  </p>
                </div>
                <span className="rounded-[6px] border border-[var(--mg-border)] px-2 py-1 text-xs font-bold text-[var(--mg-muted)]">
                  {exportFormat.toUpperCase()}
                </span>
              </div>

              <div className="min-h-0 flex-1">
                {activeEntry && activeOriginalUrl && activeTranslatedUrl ? (
                  <SplitView
                    originalImageUrl={activeOriginalUrl}
                    translatedImageUrl={activeTranslatedUrl}
                  />
                ) : (
                  <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--mg-border)] bg-black/20 text-center text-[var(--mg-muted)]">
                    <ImageIcon size={36} aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold">
                      {isRenderingPreview
                        ? 'กำลังสร้างตัวอย่างที่มีตัวหนังสือ'
                        : activeRenderError || 'ยังไม่มีหน้าที่พร้อมเปรียบเทียบ'}
                    </p>
                    <p className="mt-1 text-xs">
                      {selectedEntries.length > 0
                        ? 'ระบบจะใช้ภาพเดียวกับไฟล์ส่งออกจริง'
                        : 'เลือกหน้าจากแผงส่งออกด้านขวา'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 overflow-x-auto rounded-[8px] border border-[var(--mg-border)] bg-black/20 p-2">
              {selectedEntries.length > 0 ? (
                <div className="flex min-w-max gap-2">
                  {selectedEntries.map((entry) => {
                    const previewUrl = getExportThumbnailUrl(entry, renderedPreviewUrls)
                    const isActive = entry.id === activePreviewId
                    return (
                      <button
                        type="button"
                        key={entry.id}
                        aria-pressed={isActive}
                        onClick={() => setActivePreviewId(entry.id)}
                        className={`w-28 overflow-hidden rounded-[8px] border bg-white/[0.03] text-left transition hover:border-white/30 ${
                          isActive ? 'border-[var(--mg-accent)]' : 'border-[var(--mg-border)]'
                        }`}
                      >
                        <div className="flex aspect-[2/3] items-center justify-center bg-black/35">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={`หน้า ${entry.pageNumber ?? '?'}`}
                              className="h-full w-full object-contain"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--mg-muted)]">
                              <ImageIcon size={28} aria-hidden="true" />
                              <span className="text-xs font-bold">ไม่มีตัวอย่าง</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-[var(--mg-border)] px-2 py-1.5 text-xs">
                          <span className="font-bold text-[var(--mg-text)]">หน้า {entry.pageNumber ?? '?'}</span>
                          <span className="truncate text-[var(--mg-muted)]">
                            {renderedPreviewUrls[entry.id] ? 'พร้อม' : entry.status}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex min-h-32 flex-col items-center justify-center text-center text-[var(--mg-muted)]">
                  <ImageIcon size={36} aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold">ยังไม่มีหน้าที่เลือก</p>
                  <p className="mt-1 text-xs">เลือกหน้าจากแผงส่งออกด้านขวา</p>
                </div>
              )}
            </div>
          </div>
        ) : originalImageUrl && translatedImageUrl ? (
          <SplitView
            originalImageUrl={originalImageUrl}
            translatedImageUrl={translatedImageUrl}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--mg-border)] bg-black/20 text-center text-[var(--mg-muted)]">
            <ImageIcon size={36} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">ยังไม่มีตัวอย่างสำหรับส่งออก</p>
            <p className="mt-1 text-xs">กลับไปหน้าแก้ไข แล้วลองบันทึกหรือเลือกหน้าอีกครั้ง</p>
          </div>
        )}
      </div>
      <div className="flex w-72 shrink-0 flex-col gap-3">
        <Panel className="p-4">
            <h2 className="mb-3 text-lg font-bold">ตั้งค่าส่งออก</h2>
            <Field label="รูปแบบไฟล์">
              <SelectField
                value={exportFormat}
                onChange={onExportFormatChange}
                options={[
                  { value: 'png', label: 'PNG (คมชัด ไม่บีบอัด)' },
                  { value: 'jpg', label: 'JPG (ไฟล์เล็ก)' },
                  { value: 'webp', label: 'WebP (สมดุลที่สุด)' },
                ]}
              />
            </Field>
            {exportFormat !== 'png' && (
              <Field label={`คุณภาพ: ${exportQuality}%`} className="mt-3">
                <input
                  type="range"
                  className="mg-slider"
                  min={10}
                  max={100}
                  value={exportQuality}
                  onChange={(e) => onExportQualityChange(Number(e.target.value))}
                />
              </Field>
            )}
            {sortedEntries.length > 1 && (
              <Field label="หน้า" className="mt-3">
                <div className="max-h-64 overflow-auto rounded-[8px] border border-[var(--mg-border)] bg-black/20 p-2">
                  <label className="mb-2 flex items-center gap-2 border-b border-[var(--mg-border)] pb-2 text-xs font-bold text-[var(--mg-text)]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-[var(--mg-accent)]"
                    />
                    เลือกทุกหน้า
                  </label>
                  <div className="space-y-1">
                    {sortedEntries.map((entry) => (
                      <label
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-xs hover:bg-white/5"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(entry.id)}
                            onChange={() => toggleEntry(entry.id)}
                            className="h-4 w-4 accent-[var(--mg-accent)]"
                          />
                          <span className="font-bold text-[var(--mg-text)]">หน้า {entry.pageNumber ?? '?'}</span>
                        </span>
                        <span className="truncate text-[var(--mg-muted)]">{entry.status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </Field>
            )}
            <Button
              variant="primary"
              className="mt-4 w-full"
              onClick={() => onExport(sortedEntries.length > 1 ? selectedIds : undefined)}
              disabled={sortedEntries.length > 1 && selectedIds.length === 0}
            >
              <Download size={16} /> ดาวน์โหลด
            </Button>
        </Panel>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> กลับไปแก้ไข
        </Button>
      </div>
    </div>
  )
}
