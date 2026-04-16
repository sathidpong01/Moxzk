import { useEffect, useMemo, useState } from 'react'
import type { ExportFormat } from '../../types'
import type { ImageEntry } from '../../types'
import SplitView from '../Comparison/SplitView'
import { ArrowLeft, Download } from 'lucide-react'
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
  const sortedEntries = useMemo(
    () => [...imageEntries].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0)),
    [imageEntries],
  )

  useEffect(() => {
    setSelectedIds(sortedEntries.map((entry) => entry.id))
  }, [sortedEntries])

  const allSelected = sortedEntries.length > 0 && selectedIds.length === sortedEntries.length
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : sortedEntries.map((entry) => entry.id))
  }
  const toggleEntry = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <div className="studio-canvas flex h-full gap-3 p-3">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {originalImageUrl && translatedImageUrl && (
          <SplitView
            originalImageUrl={originalImageUrl}
            translatedImageUrl={translatedImageUrl}
          />
        )}
      </div>
      <div className="flex w-72 shrink-0 flex-col gap-3">
        <Panel className="p-4">
            <h2 className="mb-3 text-lg font-bold">Export</h2>
            <Field label="Format">
              <SelectField
                value={exportFormat}
                onChange={onExportFormatChange}
                options={[
                  { value: 'png', label: 'PNG (lossless)' },
                  { value: 'jpg', label: 'JPG (smaller file)' },
                  { value: 'webp', label: 'WebP (best balance)' },
                ]}
              />
            </Field>
            {exportFormat !== 'png' && (
              <Field label={`Quality: ${exportQuality}%`} className="mt-3">
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
              <Field label="Pages" className="mt-3">
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
              <Download size={16} /> Download
            </Button>
        </Panel>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> Back to Editor
        </Button>
      </div>
    </div>
  )
}
