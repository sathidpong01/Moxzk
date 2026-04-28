import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { translateSingleRegion } from '../../services/ollama'
import { buildOcrReviewSummary, getRegionConfidence, sortRegionsForReview } from '../../services/translationReview'
import { Languages, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Modal, TextInput } from '../ui/primitives'

interface OcrCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
}

function confidenceBadge(confidence?: number) {
  if (confidence == null) return <Badge>?</Badge>
  const className = confidence >= 0.9
    ? 'text-green-300'
    : confidence >= 0.7
      ? 'text-yellow-300'
      : 'text-red-300'
  return <Badge className={className}>{(confidence * 100).toFixed(0)}%</Badge>
}

export default function OcrCorrectionModal({ isOpen, onClose }: OcrCorrectionModalProps) {
  const regions = useAppStore((s) => s.regions)
  const updateRegion = useAppStore((s) => s.updateRegion)
  const settings = useAppStore((s) => s.settings)
  const reviewRegions = sortRegionsForReview(regions)
  const summary = buildOcrReviewSummary(regions)
  const [editTexts, setEditTexts] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const map: Record<string, string> = {}
      regions.forEach((region) => { map[region.id] = region.originalText })
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
    setSelected((current) => current.size === regions.length ? new Set() : new Set(regions.map((region) => region.id)))
  }, [regions])

  const handleApplyEdits = useCallback(() => {
    let count = 0
    for (const [id, text] of Object.entries(editTexts)) {
      const region = regions.find((item) => item.id === id)
      if (region && region.originalText !== text) {
        updateRegion(id, { originalText: text })
        count++
      }
    }
    if (count > 0) toast.success(`แก้ไข OCR ${count} กล่อง`)
    onClose()
  }, [editTexts, regions, updateRegion, onClose])

  const handleBatchTranslate = useCallback(async () => {
    const ids = selected.size > 0 ? [...selected] : regions.map((region) => region.id)
    if (ids.length === 0) return
    setTranslating(true)
    let done = 0
    for (const id of ids) {
      const text = editTexts[id] ?? ''
      if (!text) continue
      try {
        const result = await translateSingleRegion(text, settings.sourceLang, {
          ollamaUrl: settings.ollamaUrl,
          ollamaModel: settings.ollamaModel,
          ollamaApiKey: settings.ollamaApiKey,
          storyContext: {
            enabled: settings.translationContextEnabled,
            translationMode: settings.translationMode,
            styleGuide: settings.translationStyleGuide,
          },
        })
        updateRegion(id, { translatedText: result, originalText: text })
        done++
      } catch (err) {
        console.warn(`[OcrCorrection] Failed to translate ${id}:`, err)
      }
    }
    setTranslating(false)
    toast.success(`แปลเสร็จ ${done}/${ids.length} กล่อง`)
  }, [selected, regions, editTexts, settings, updateRegion])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={(
        <span className="flex items-center gap-2">
          ตรวจสอบ OCR ({regions.length} กล่อง)
          {summary.needsReview && (
            <Badge className="text-yellow-300"><AlertTriangle size={10} /> ต้องตรวจ {summary.lowConfidence + summary.emptyOriginalText + summary.emptyTranslatedText}</Badge>
          )}
        </span>
      )}
      className="max-w-4xl p-0"
    >
      <div className="flex max-h-[72vh] min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[var(--moxzk-border)] px-4 py-3 text-xs text-[var(--moxzk-muted)]">
            ความมั่นใจต่ำ {summary.lowConfidence} · ไม่มี OCR {summary.emptyOriginalText} · ยังไม่แปล {summary.emptyTranslatedText} · ไม่ทราบคะแนน {summary.unknownConfidence}
          </div>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--moxzk-surface-2)] text-[var(--moxzk-muted)]">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === regions.length && regions.length > 0}
                    onChange={selectAll}
                    aria-label="เลือก OCR ทั้งหมด"
                  />
                </th>
                <th className="w-8 px-2 py-2">#</th>
                <th className="px-2 py-2">ข้อความ OCR</th>
                <th className="w-20 px-2 py-2">มั่นใจ</th>
                <th className="w-24 px-2 py-2">แปลแล้ว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--moxzk-border)]">
              {reviewRegions.map((region, index) => {
                const confidence = getRegionConfidence(region) ?? undefined
                const isLow = confidence != null && confidence < 0.7
                return (
                  <tr key={region.id} className={isLow ? 'bg-red-500/10' : ''}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(region.id)}
                        onChange={() => toggleSelect(region.id)}
                        aria-label={`เลือก OCR กล่อง ${index + 1}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-[var(--moxzk-dim)]">{index + 1}</td>
                    <td className="px-2 py-2">
                      <TextInput
                        type="text"
                        className={isLow ? 'border-red-400/60 font-mono' : 'font-mono'}
                        value={editTexts[region.id] ?? ''}
                        onChange={(e) => setEditTexts((prev) => ({ ...prev, [region.id]: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-2">{confidenceBadge(confidence)}</td>
                    <td className="px-2 py-2">
                      {region.translatedText ? (
                        <span className="flex items-center gap-1 text-green-300">
                          <CheckCircle2 size={10} /> แล้ว
                        </span>
                      ) : (
                        <span className="text-[var(--moxzk-dim)]">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--moxzk-border)] px-4 py-3">
          <span className="text-xs text-[var(--moxzk-muted)]">
            เลือก {selected.size}/{regions.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleApplyEdits}>
              บันทึกแก้ไข OCR
            </Button>
            <Button variant="primary" size="sm" disabled={translating} onClick={handleBatchTranslate}>
              {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
              {selected.size > 0 ? `แปลที่เลือก (${selected.size})` : 'แปลทั้งหมด'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
