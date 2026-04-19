import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, ProcessingState, TextRegion, ProcessingMode } from '../../types'
import { processImageWithCleanupProvider } from '../../services/cleanup-provider'
import {
  translateWithOllamaBoxedVision,
  translateWithOllamaVision,
  type OllamaOptions,
} from '../../services/ollama'
import {
  deriveTextBoxesFromCleanupDiff,
} from '../../services/cleanup-diff-bboxes'
import type { BoundingBox } from '../../types'
import type { StreamProgress } from '../../services/translator-api'
import {
  Search,
  FileText,
  Paintbrush,
  Languages,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ProcessingViewProps {
  imageFile: File
  sourceLang: string
  mode?: ProcessingMode
  settings: AppSettings
  ollamaOptions?: OllamaOptions
  abortSignal?: AbortSignal
  onComplete: (regions: TextRegion[], cleanedImageUrl: string) => void
  onError: (error: string) => void
  onLog?: (msg: string) => void
  retryCount?: number
}

type PipelineStep = 'detection' | 'ocr' | 'inpainting' | 'translating' | 'done' | 'error'

const STEPS: { id: PipelineStep; label: string; icon: typeof Search }[] = [
  { id: 'detection', label: 'Cleanup Backend', icon: Search },
  { id: 'ocr', label: 'OCR', icon: FileText },
  { id: 'inpainting', label: 'Cleaned Image', icon: Paintbrush },
  { id: 'translating', label: 'Gemma Vision', icon: Languages },
  { id: 'done', label: 'Done', icon: CheckCircle2 },
]

function mapProgressToStep(message: string): PipelineStep | null {
  const lower = message.toLowerCase()
  if (lower.includes('detection') || lower.includes('pre_translation_hooks')) return 'detection'
  if (lower.includes('ocr') || lower.includes('textline_merge')) return 'ocr'
  if (lower.includes('mask') || lower.includes('inpaint') || lower.includes('after-translat') || lower.includes('mask-generation')) return 'inpainting'
  if (lower.includes('translat') && !lower.includes('after-translat') && !lower.includes('pre_translat')) return 'translating'
  if (lower.includes('render')) return 'inpainting'
  if (lower.includes('finished')) return 'done'
  return null
}

function stepToProgress(step: PipelineStep): number {
  switch (step) {
    case 'detection': return 15
    case 'ocr': return 35
    case 'inpainting': return 55
    case 'translating': return 75
    case 'done': return 100
    case 'error': return 0
  }
}

// Cached intermediate results for smart retry
let _cachedCleanedBlob: Blob | null = null
let _cachedCleanupBoxes: BoundingBox[] | null = null
let _cachedFailedStep: PipelineStep | null = null

export function clearProcessingCache() {
  _cachedCleanedBlob = null
  _cachedCleanupBoxes = null
  _cachedFailedStep = null
}

function hasUsableRegions(regions: TextRegion[]): boolean {
  return regions.some((region) => (
    region.originalText.trim().length > 0 &&
    region.bbox.width > 1 &&
    region.bbox.height > 1
  ))
}

export default function ProcessingView({
  imageFile,
  sourceLang,
  mode = 'gemma_vision_full',
  settings,
  ollamaOptions,
  abortSignal,
  onComplete,
  onError,
  onLog,
  retryCount = 0,
}: ProcessingViewProps) {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: 'เตรียมพร้อม...',
  })
  const [currentStep, setCurrentStep] = useState<PipelineStep>('detection')
  const hasStarted = useRef(false)

  const imagePreviewUrl = useMemo(
    () => URL.createObjectURL(imageFile),
    [imageFile],
  )

  const addLog = useCallback((msg: string) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`
    onLog?.(entry)
  }, [onLog])
  const ollamaRunOptions = useMemo(
    () => ({
      ...ollamaOptions,
      signal: abortSignal,
      storyContext: {
        enabled: settings.translationContextEnabled,
        styleGuide: settings.translationStyleGuide,
      },
    }),
    [ollamaOptions, abortSignal, settings.translationContextEnabled, settings.translationStyleGuide],
  )

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const run = async () => {
      try {
        const cleanupLabel = 'PanelCleaner'

        // Smart retry: skip cleanup backend if we already have OCR/cleaned results
        let cleanedImageBlob = _cachedCleanedBlob
        let cleanupBoxes = _cachedCleanupBoxes
        const resumeFromTranslation = _cachedFailedStep === 'translating' && cleanedImageBlob

        if (!resumeFromTranslation) {
          // Step 1: cleanup backend
          setCurrentStep('detection')
          setState({ status: 'detecting', progress: 10, message: `กำลังส่งรูปไปยัง ${cleanupLabel}...` })
          addLog(`เริ่ม cleanup ด้วย ${cleanupLabel}`)

          const onProgress = (p: StreamProgress) => {
            addLog(`[${p.status}] ${p.message}`)
            if (p.status === 'queue') {
              setState((s) => ({ ...s, message: `อยู่ในคิว: ${p.message}`, queuePosition: Number(p.message) || undefined }))
            } else if (p.status === 'progress') {
              const mapped = mapProgressToStep(p.message)
              if (mapped && mapped !== 'done') {
                setCurrentStep(mapped)
                setState((s) => ({
                  ...s,
                  status: mapped === 'detection' ? 'detecting' : mapped === 'ocr' ? 'ocr' : mapped === 'inpainting' ? 'inpainting' : 'detecting',
                  progress: stepToProgress(mapped),
                  message: p.message,
                }))
              } else if (p.message.toLowerCase().includes('finished')) {
                setState((s) => ({ ...s, progress: 55, message: `${cleanupLabel} เสร็จ` }))
              } else {
                setState((s) => ({ ...s, message: p.message }))
              }
            }
          }

          const result = await processImageWithCleanupProvider({
            file: imageFile,
            mode,
            settings,
            signal: abortSignal,
            runOcr: false,
            onProgress,
          })
          cleanedImageBlob = result.cleanedImageBlob
          _cachedCleanedBlob = cleanedImageBlob
          addLog(`${cleanupLabel} เสร็จ`)

          if (cleanedImageBlob) {
            try {
              cleanupBoxes = await deriveTextBoxesFromCleanupDiff(imageFile, cleanedImageBlob)
              _cachedCleanupBoxes = cleanupBoxes
              addLog(`ตำแหน่งจาก cleanup diff: พบ ${cleanupBoxes.length} boxes`)
            } catch (err) {
              addLog(`ตำแหน่งจาก cleanup diff ใช้ไม่ได้: ${err instanceof Error ? err.message : String(err)}`)
              cleanupBoxes = null
            }
          }
        } else {
          addLog(`ลองใหม่แบบฉลาด: ข้าม ${cleanupLabel}, เริ่มต่อที่ขั้นตอนแปลภาษา`)
        }

        const cleanedUrl = cleanedImageBlob ? URL.createObjectURL(cleanedImageBlob) : ''

        if (mode === 'clean_only') {
          setCurrentStep('done')
          setState({ status: 'done', progress: 100, message: 'คลีนเสร็จ' })
          addLog('โหมดคลีนอย่างเดียว: หยุดที่ขั้นตอนคลีน')
          clearProcessingCache()
          onComplete([], cleanedUrl)
          return
        }

        _cachedFailedStep = 'translating'
        setCurrentStep('translating')
        addLog(`กำลังเรียก Ollama model "${ollamaOptions?.ollamaModel || 'gemma4'}"...`)

        let translatedRegions: TextRegion[] = []
        setState({ status: 'translating', progress: 75, message: 'กำลังให้ Gemma อ่านและแปลในรอบเดียว...' })
        if (cleanupBoxes && cleanupBoxes.length > 0) {
          addLog(`เริ่ม Gemma boxed vision flow: อ่านและแปลตาม cleanup diff ${cleanupBoxes.length} boxes`)
          translatedRegions = await translateWithOllamaBoxedVision(
            imageFile,
            cleanupBoxes,
            sourceLang,
            ollamaRunOptions,
          )
        } else {
          addLog('ไม่มี cleanup diff boxes, ใช้ Gemma vision full flow แทน')
          translatedRegions = await translateWithOllamaVision(imageFile, sourceLang, ollamaRunOptions)
        }

        if (!hasUsableRegions(translatedRegions)) {
          addLog('Gemma vision ไม่คืน bbox ที่ใช้ได้ใน flow ใหม่')
        }

        addLog(`แปลเสร็จ: ${translatedRegions.length} กล่อง`)

        setCurrentStep('done')
        setState({ status: 'done', progress: 100, message: 'เสร็จสิ้น!' })
        clearProcessingCache()
        onComplete(translatedRegions, cleanedUrl)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setCurrentStep('error')
        setState({ status: 'error', progress: 0, message })
        addLog(`ERROR: ${message}`)
        onError(message)
      }
    }

    run()
  }, [imageFile, sourceLang, mode, settings, abortSignal, ollamaRunOptions, onComplete, onError, addLog, retryCount])

  // Filter steps based on processing mode
  const visibleSteps = useMemo(() => {
    if (mode === 'clean_only') return STEPS.filter((s) => ['detection', 'inpainting', 'done'].includes(s.id))
    return STEPS
  }, [mode])

  const stepIndex = visibleSteps.findIndex((s) => s.id === currentStep)

  return (
    <div className="w-full space-y-4 flex flex-col items-center">
      {/* Image preview with blur overlay + spinner */}
      <div className="relative w-fit">
        <img
          src={imagePreviewUrl}
          alt="กำลังประมวลผล"
          className="max-w-full max-h-[56vh] rounded-lg object-contain opacity-20"
        />

        {state.status !== 'done' && state.status !== 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-12 w-12 animate-spin text-[var(--mg-accent)]" />
            <div className="max-w-xs rounded-[8px] bg-black/70 px-4 py-2 text-center backdrop-blur">
              <p className="text-sm font-medium text-[var(--mg-text)]">
                {visibleSteps[stepIndex]?.label ?? 'กำลังประมวลผล...'}
              </p>
              <p className="mt-0.5 text-xs text-[var(--mg-muted)]">{state.message}</p>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            <AlertCircle className="h-12 w-12 text-[var(--mg-danger)]" />
            <div className="max-w-sm rounded-[8px] border border-red-400/30 bg-red-500/10 px-4 py-2 text-center">
              <p className="text-sm font-medium text-red-300">เกิดข้อผิดพลาด</p>
              <p className="mt-1 text-xs text-red-200/80">{state.message}</p>
            </div>
          </div>
        )}

        {state.status === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-bounce rounded-full bg-green-500/20 p-4 backdrop-blur">
              <CheckCircle2 className="h-10 w-10 text-[var(--mg-success)]" />
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[var(--mg-muted)]">
          <span>{visibleSteps[stepIndex]?.label ?? 'Waiting...'}</span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full ${state.status === 'error' ? 'bg-[var(--mg-danger)]' : 'bg-[var(--mg-accent)]'}`}
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators — horizontal */}
      <div className="flex items-center justify-between gap-1 px-2">
        {visibleSteps.map((step, i) => {
          const Icon = step.icon
          const isActive = i === stepIndex
          const isDone = i < stepIndex || currentStep === 'done'
          const isError = currentStep === 'error'

          return (
            <div key={step.id} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isError && isActive
                    ? 'bg-[var(--mg-danger)] text-white'
                    : isDone
                      ? 'bg-[var(--mg-accent)] text-white'
                      : isActive
                        ? 'bg-blue-500/20 text-blue-200 ring-2 ring-blue-400'
                        : 'bg-white/8 text-[var(--mg-dim)]'
                }`}
              >
                {isActive && !isDone && !isError ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Icon size={14} />
                )}
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${
                  isDone || isActive ? 'text-[var(--mg-text)]' : 'text-[var(--mg-dim)]'
                }`}
              >
                {step.label.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Queue label */}
      {state.queuePosition !== undefined && (
        <div className="text-center">
          <div className="mg-pill text-yellow-300">คิว: #{state.queuePosition}</div>
        </div>
      )}
    </div>
  )
}
