import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { translateSingleRegion } from '../../services/ollama'
import { buildOcrReviewSummary, getRegionConfidence, sortRegionsForReview } from '../../services/translationReview'
import { Languages, Loader2, CheckCircle2, AlertTriangle, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Modal, TextInput, cn } from '../ui/primitives'

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function OcrCorrectionModal({ isOpen, onClose }: OcrCorrectionModalProps) {
  const regions = useAppStore((s) => s.regions)
  const updateRegion = useAppStore((s) => s.updateRegion)
  const settings = useAppStore((s) => s.settings)
  const originalImageUrl = useAppStore((s) => s.originalImageUrl)
  const reviewRegions = sortRegionsForReview(regions)
  const summary = buildOcrReviewSummary(regions)
  const [editTexts, setEditTexts] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [translating, setTranslating] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (isOpen) {
      const map: Record<string, string> = {}
      regions.forEach((region) => { map[region.id] = region.originalText })
      setEditTexts(map)
      setSelected(new Set())
      setFocusedId(null)
    }
  }, [isOpen, regions])

  const focusedRegion = useMemo(
    () => regions.find((region) => region.id === focusedId) ?? null,
    [regions, focusedId],
  )

  // Auto-zoom the image onto the focused line's bounding box.
  const imageTransform = useMemo(() => {
    if (!focusedRegion || !imageSize) return { transform: 'none' }
    const { x, y, width, height } = focusedRegion.bbox
    const wFrac = width / imageSize.width
    const hFrac = height / imageSize.height
    const cx = (x + width / 2) / imageSize.width
    const cy = (y + height / 2) / imageSize.height
    const zoom = clamp(Math.min(0.55 / Math.max(wFrac, 0.01), 0.55 / Math.max(hFrac, 0.01)), 1.6, 4)
    const tx = clamp((0.5 - cx * zoom) * 100, (1 - zoom) * 100, 0)
    const ty = clamp((0.5 - cy * zoom) * 100, (1 - zoom) * 100, 0)
    return { transform: `translate(${tx}%, ${ty}%) scale(${zoom})` }
  }, [focusedRegion, imageSize])

  const focusRegion = useCallback((id: string) => {
    setFocusedId(id)
    rowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

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
    if (count > 0) toast.success(`แก้ไขข้อความที่อ่านได้ ${count} กล่อง`)
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

  const reviewIndex = useMemo(() => {
    const map: Record<string, number> = {}
    reviewRegions.forEach((region, index) => { map[region.id] = index + 1 })
    return map
  }, [reviewRegions])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={(
        <span className="flex items-center gap-2">
          ตรวจสอบข้อความที่อ่านได้ ({regions.length} กล่อง)
          {summary.needsReview && (
            <Badge className="text-yellow-300"><AlertTriangle size={10} /> ต้องตรวจ {summary.lowConfidence + summary.emptyOriginalText + summary.emptyTranslatedText}</Badge>
          )}
        </span>
      )}
      className="max-w-6xl p-0"
    >
      <div className="grid max-h-[78vh] min-h-0 grid-cols-1 md:grid-cols-[1.15fr_1fr]">
        <div className="OcrSplitImage relative min-h-[20rem] overflow-hidden bg-black/40 md:min-h-0">
          {originalImageUrl ? (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div
                className="OcrSplitImageStage relative"
                style={{
                  aspectRatio: imageSize ? `${imageSize.width} / ${imageSize.height}` : undefined,
                  maxHeight: '100%',
                  maxWidth: '100%',
                  ...imageTransform,
                }}
              >
                <img
                  src={originalImageUrl}
                  alt="ภาพต้นฉบับสำหรับเทียบข้อความ OCR"
                  className="h-full w-full select-none object-contain"
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget
                    setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
                  }}
                />
                {imageSize && regions.map((region) => {
                  const isFocused = region.id === focusedId
                  return (
                    <button
                      type="button"
                      key={region.id}
                      onClick={() => focusRegion(region.id)}
                      aria-label={`เลือกกล่อง ${reviewIndex[region.id] ?? ''}`}
                      className={cn(
                        'absolute cursor-pointer rounded-[3px] border-2 transition-colors',
                        isFocused
                          ? 'border-[var(--moxzk-accent)] bg-[rgba(37,99,235,0.22)]'
                          : 'border-yellow-300/55 bg-yellow-300/5 hover:border-yellow-300',
                      )}
                      style={{
                        left: `${(region.bbox.x / imageSize.width) * 100}%`,
                        top: `${(region.bbox.y / imageSize.height) * 100}%`,
                        width: `${(region.bbox.width / imageSize.width) * 100}%`,
                        height: `${(region.bbox.height / imageSize.height) * 100}%`,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--moxzk-muted)]">
              <ImageIcon size={36} aria-hidden="true" />
              <p className="text-sm">ยังไม่มีภาพต้นฉบับให้เทียบ</p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col border-l border-[var(--moxzk-border)]">
          <div className="flex items-center justify-between border-b border-[var(--moxzk-border)] px-4 py-2.5 text-xs text-[var(--moxzk-muted)]">
            <span>มั่นใจต่ำ {summary.lowConfidence} · ไม่มีต้นฉบับ {summary.emptyOriginalText} · ยังไม่แปล {summary.emptyTranslatedText}</span>
            <label className="flex shrink-0 items-center gap-1.5">
              <input
                type="checkbox"
                checked={selected.size === regions.length && regions.length > 0}
                onChange={selectAll}
                aria-label="เลือกข้อความทั้งหมด"
              />
              เลือกหมด
            </label>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {reviewRegions.map((region) => {
              const confidence = getRegionConfidence(region) ?? undefined
              const isLow = confidence != null && confidence < 0.7
              const isFocused = region.id === focusedId
              return (
                <div
                  key={region.id}
                  ref={(el) => { rowRefs.current[region.id] = el }}
                  onClick={() => focusRegion(region.id)}
                  className={cn(
                    'cursor-pointer rounded-[12px] border p-2.5 transition',
                    isFocused
                      ? 'border-[var(--moxzk-accent)] bg-[rgba(37,99,235,0.1)]'
                      : isLow
                        ? 'border-red-400/40 bg-red-500/5 hover:border-red-400/70'
                        : 'border-[var(--moxzk-border)] hover:border-[var(--moxzk-muted)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(region.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(region.id)}
                        aria-label={`เลือกข้อความกล่อง ${reviewIndex[region.id]}`}
                      />
                      <span className="font-bold text-[var(--moxzk-dim)]">#{reviewIndex[region.id]}</span>
                      {confidenceBadge(confidence)}
                    </span>
                    {region.translatedText ? (
                      <span className="flex items-center gap-1 text-green-300">
                        <CheckCircle2 size={10} /> แปลแล้ว
                      </span>
                    ) : (
                      <span className="text-[var(--moxzk-dim)]">ยังไม่แปล</span>
                    )}
                  </div>
                  <TextInput
                    type="text"
                    className={cn('mt-2 font-mono text-xs', isLow && 'border-red-400/60')}
                    value={editTexts[region.id] ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => focusRegion(region.id)}
                    onChange={(e) => setEditTexts((prev) => ({ ...prev, [region.id]: e.target.value }))}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--moxzk-border)] px-4 py-3">
            <span className="text-xs text-[var(--moxzk-muted)]">
              เลือก {selected.size}/{regions.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleApplyEdits}>
                บันทึกข้อความที่แก้ไข
              </Button>
              <Button variant="primary" size="sm" disabled={translating} onClick={() => void handleBatchTranslate()}>
                {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                {selected.size > 0 ? `แปลที่เลือก (${selected.size})` : 'แปลทั้งหมด'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
