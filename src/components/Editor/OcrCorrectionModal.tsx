/**
 * OCR Correction Modal — review/edit OCR text, see confidence scores,
 * batch translate selected regions.
 */

import { useCallback, useEffect, useState } from 'react'
import type { TextRegion } from '../../types'
import { useAppStore } from '../../store/appStore'
import { translateSingleRegion } from '../../services/localLLM'
import { X, Languages, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface OcrCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
}

function confidenceBadge(c?: number) {
  if (c == null) return <span className="badge badge-xs badge-ghost">?</span>
  if (c >= 0.9) return <span className="badge badge-xs badge-success">{(c * 100).toFixed(0)}%</span>
  if (c >= 0.7) return <span className="badge badge-xs badge-warning">{(c * 100).toFixed(0)}%</span>
  return <span className="badge badge-xs badge-error">{(c * 100).toFixed(0)}%</span>
}

export default function OcrCorrectionModal({ isOpen, onClose }: OcrCorrectionModalProps) {
  const regions = useAppStore((s) => s.regions)
  const updateRegion = useAppStore((s) => s.updateRegion)
  const settings = useAppStore((s) => s.settings)

  const [editTexts, setEditTexts] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [translating, setTranslating] = useState(false)

  // Sync editTexts from regions on open
  useEffect(() => {
    if (isOpen) {
      const map: Record<string, string> = {}
      regions.forEach((r) => { map[r.id] = r.originalText })
      setEditTexts(map)
      setSelected(new Set())
    }
  }, [isOpen, regions])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selected.size === regions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(regions.map((r) => r.id)))
    }
  }, [selected.size, regions])

  const handleApplyEdits = useCallback(() => {
    let count = 0
    for (const [id, text] of Object.entries(editTexts)) {
      const region = regions.find((r) => r.id === id)
      if (region && region.originalText !== text) {
        updateRegion(id, { originalText: text })
        count++
      }
    }
    if (count > 0) toast.success(`แก้ไข OCR ${count} regions`)
    onClose()
  }, [editTexts, regions, updateRegion, onClose])

  const handleBatchTranslate = useCallback(async () => {
    const ids = selected.size > 0 ? [...selected] : regions.map((r) => r.id)
    if (ids.length === 0) return

    setTranslating(true)
    let done = 0
    for (const id of ids) {
      const text = editTexts[id] ?? ''
      if (!text) continue
      try {
        const result = await translateSingleRegion(
          text,
          settings.sourceLang,
          settings.translationEngine,
          {
            apiKey: settings.geminiApiKey,
            modelId: settings.geminiModel,
            libreTranslateUrl: settings.libreTranslateUrl,
            ollamaUrl: settings.ollamaUrl,
            ollamaModel: settings.ollamaModel,
          },
        )
        updateRegion(id, { translatedText: result, originalText: text })
        done++
      } catch (err) {
        console.warn(`[OcrCorrection] Failed to translate ${id}:`, err)
      }
    }
    setTranslating(false)
    toast.success(`แปลเสร็จ ${done}/${ids.length} regions`)
  }, [selected, regions, editTexts, settings, updateRegion])

  if (!isOpen) return null

  const lowConfCount = regions.filter((r) => (r as TextRegion & { confidence?: number }).confidence != null && ((r as TextRegion & { confidence?: number }).confidence ?? 1) < 0.7).length

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl max-h-[80vh] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <div className="flex items-center gap-2">
            <h3 className="font-bold">ตรวจสอบ OCR ({regions.length} regions)</h3>
            {lowConfCount > 0 && (
              <span className="badge badge-warning badge-sm gap-1">
                <AlertTriangle size={10} /> {lowConfCount} confidence ต่ำ
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-xs btn-square" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 min-h-0">
          <table className="table table-xs w-full">
            <thead className="sticky top-0 bg-base-200 z-10">
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={selected.size === regions.length && regions.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th className="w-8">#</th>
                <th>OCR Text (แก้ไขได้)</th>
                <th className="w-16">Conf.</th>
                <th className="w-24">แปลแล้ว</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r, i) => {
                const conf = (r as TextRegion & { confidence?: number }).confidence
                const isLow = conf != null && conf < 0.7
                return (
                  <tr key={r.id} className={isLow ? 'bg-error/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    <td className="text-base-content/50">{i + 1}</td>
                    <td>
                      <input
                        type="text"
                        className={`input input-xs input-bordered w-full font-mono ${isLow ? 'input-error' : ''}`}
                        value={editTexts[r.id] ?? ''}
                        onChange={(e) => setEditTexts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                    </td>
                    <td>{confidenceBadge(conf)}</td>
                    <td>
                      {r.translatedText ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 size={10} /> แล้ว
                        </span>
                      ) : (
                        <span className="text-base-content/30">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
          <span className="text-xs text-base-content/50">
            เลือก {selected.size}/{regions.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleApplyEdits}
            >
              บันทึกแก้ไข OCR
            </button>
            <button
              className="btn btn-primary btn-sm gap-1"
              disabled={translating}
              onClick={handleBatchTranslate}
            >
              {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
              {selected.size > 0 ? `แปลที่เลือก (${selected.size})` : 'แปลทั้งหมด'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
