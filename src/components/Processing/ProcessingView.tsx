import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, ProcessingState, TextRegion, ProcessingMode } from '../../types'
import { processImageWithCleanupProvider } from '../../services/cleanup-provider'
import {
  detectSourceLanguageFromImage,
  translateWithOllamaBoxedVision,
  translateWithOllamaVision,
  type OllamaOptions,
} from '../../services/ollama'
import {
  deriveTextBoxesFromCleanupDiff,
} from '../../services/cleanup-diff-bboxes'
import type { BoundingBox } from '../../types'
import type { StreamProgress } from '../../services/translator-api'
import { getAppRuntime } from '../../runtime'
import { autoStartRequiredLocalServices } from '../../services/localServiceAutoStart'
import {
  Search,
  FileText,
  Paintbrush,
  Languages,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

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
  presentation?: 'compact' | 'runner'
  onStatusChange?: (status: ProcessingViewStatus) => void
}

type PipelineStep = 'detection' | 'ocr' | 'inpainting' | 'translating' | 'done' | 'error'

export interface ProcessingViewStatus {
  state: ProcessingState
  step: PipelineStep
  label: string
}

const STEPS: { id: PipelineStep; label: string; icon: typeof Search }[] = [
  { id: 'detection', label: 'คลีน', icon: Search },
  { id: 'ocr', label: 'อ่านข้อความ', icon: FileText },
  { id: 'inpainting', label: 'ภาพคลีน', icon: Paintbrush },
  { id: 'translating', label: 'แปล', icon: Languages },
  { id: 'done', label: 'เสร็จ', icon: CheckCircle2 },
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
  presentation = 'compact',
  onStatusChange,
}: ProcessingViewProps) {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: 'เตรียมพร้อม...',
  })
  const [currentStep, setCurrentStep] = useState<PipelineStep>('detection')
  const hasStarted = useRef(false)

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
        translationMode: settings.translationMode,
        styleGuide: settings.translationStyleGuide,
      },
    }),
    [ollamaOptions, abortSignal, settings.translationContextEnabled, settings.translationMode, settings.translationStyleGuide],
  )

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const run = async () => {
      try {
        const cleanupLabel = 'PanelCleaner'
        const startupResult = await autoStartRequiredLocalServices({
          runtime: getAppRuntime(),
          settings,
          mode,
          reporter: {
            onLoading: (service, message) => toast.loading(message, { id: `${service}-start` }),
            onSuccess: (service, message) => toast.success(message, { id: `${service}-start` }),
            onError: (service, message) => toast.error(message, { id: `${service}-start` }),
            onLog: addLog,
          },
        })
        if (!startupResult.ok) {
          throw new Error(startupResult.error ?? 'ไม่สามารถเริ่มโปรแกรมช่วยทำงานในเครื่องได้')
        }

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
              addLog(`พบตำแหน่งข้อความจากการลบฉากหลัง ${cleanupBoxes.length} จุด`)
            } catch (err) {
              addLog(`อ่านตำแหน่งข้อความจากการลบฉากหลังไม่ได้: ${err instanceof Error ? err.message : String(err)}`)
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
        addLog(`กำลังเรียกโมเดล Ollama "${ollamaOptions?.ollamaModel || 'gemma4'}"...`)

        let translatedRegions: TextRegion[] = []
        let resolvedSourceLang = sourceLang
        if (sourceLang === 'auto') {
          setState({ status: 'translating', progress: 68, message: 'กำลังตรวจภาษาต้นฉบับ...' })
          resolvedSourceLang = await detectSourceLanguageFromImage(imageFile, ollamaRunOptions)
          addLog(`ตรวจภาษาต้นฉบับ: ${resolvedSourceLang === 'auto' ? 'ระบุไม่ชัด ปล่อยให้โมเดลตรวจต่อ' : resolvedSourceLang}`)
        } else {
          addLog(`ใช้ภาษาต้นฉบับที่ผู้ใช้กำหนด: ${sourceLang}`)
        }
        setState({ status: 'translating', progress: 75, message: 'กำลังให้ Gemma อ่านและแปลในรอบเดียว...' })
        if (cleanupBoxes && cleanupBoxes.length > 0) {
          addLog(`เริ่มอ่านและแปลข้อความตามตำแหน่งที่พบ ${cleanupBoxes.length} จุด`)
          translatedRegions = await translateWithOllamaBoxedVision(
            imageFile,
            cleanupBoxes,
            resolvedSourceLang,
            ollamaRunOptions,
          )
        } else {
          addLog('ไม่พบตำแหน่งข้อความจากการลบฉากหลัง ใช้ AI อ่านทั้งภาพแทน')
          translatedRegions = await translateWithOllamaVision(imageFile, resolvedSourceLang, ollamaRunOptions)
        }

        if (!hasUsableRegions(translatedRegions)) {
          addLog('AI อ่านตำแหน่งข้อความจากภาพไม่ได้')
        }

        addLog(`แปลเสร็จ: ${translatedRegions.length} กล่อง`)

        setCurrentStep('done')
        setState({ status: 'done', progress: 100, message: 'เสร็จสิ้น!' })
        clearProcessingCache()
        onComplete(translatedRegions, cleanedUrl)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
        setCurrentStep('error')
        setState({ status: 'error', progress: 0, message })
        addLog(`ผิดพลาด: ${message}`)
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
  const currentLabel = visibleSteps[stepIndex]?.label ?? 'กำลังทำงาน'

  useEffect(() => {
    onStatusChange?.({
      state,
      step: currentStep,
      label: currentLabel,
    })
  }, [currentLabel, currentStep, onStatusChange, state])

  if (presentation === 'runner') return null

  return (
    <div className="floating-panel flex w-full flex-col items-center space-y-3 px-4 py-4">
      <div className="flex min-h-24 w-full flex-col items-center justify-center gap-3">
        {state.status !== 'done' && state.status !== 'error' && (
          <>
            <Loader2 className="h-9 w-9 animate-spin text-[var(--moxzk-accent)]" />
            <div className="max-w-xs text-center">
              <p className="text-sm font-bold text-[var(--moxzk-text)]">
                {currentLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--moxzk-muted)]">{state.message}</p>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-12 w-12 text-[var(--moxzk-danger)]" />
            <div className="max-w-sm rounded-[8px] border border-red-400/30 bg-red-500/10 px-4 py-2 text-center">
              <p className="text-sm font-medium text-red-300">เกิดข้อผิดพลาด</p>
              <p className="mt-1 text-xs text-red-200/80">{state.message}</p>
            </div>
          </div>
        )}

        {state.status === 'done' && (
          <div className="flex items-center justify-center pointer-events-none">
            <div className="animate-pulse rounded-full bg-green-500/20 p-4 backdrop-blur">
              <CheckCircle2 className="h-10 w-10 text-[var(--moxzk-success)]" />
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm space-y-1">
        <div className="flex justify-between text-xs text-[var(--moxzk-muted)]">
          <span>{visibleSteps[stepIndex]?.label ?? 'กำลังทำงาน'}</span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full ${state.status === 'error' ? 'bg-[var(--moxzk-danger)]' : 'bg-[var(--moxzk-accent)]'}`}
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>

      {state.queuePosition !== undefined && (
        <div className="text-center">
          <div className="moxzk-pill text-yellow-300">คิว: #{state.queuePosition}</div>
        </div>
      )}
    </div>
  )
}
