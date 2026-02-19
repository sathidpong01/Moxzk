import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProcessingState, TextRegion, ProcessingMode, GeminiModelId, TranslationEngine } from '../../types'
import { processImage } from '../../services/translator-api'
import { translateWithImage } from '../../services/gemini'
import { translateRegionsWithLocalLLM } from '../../services/localLLM'
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
  apiKey?: string
  modelId?: GeminiModelId
  mode?: ProcessingMode
  translationEngine?: TranslationEngine
  llmOptions?: {
    libreTranslateUrl?: string
    ollamaUrl?: string
    ollamaModel?: string
  }
  onComplete: (regions: TextRegion[], cleanedImageUrl: string) => void
  onError: (error: string) => void
  onLog?: (msg: string) => void
  retryCount?: number
}

type PipelineStep = 'detection' | 'ocr' | 'inpainting' | 'translating' | 'done' | 'error'

const STEPS: { id: PipelineStep; label: string; icon: typeof Search }[] = [
  { id: 'detection', label: 'Detection (CTD)', icon: Search },
  { id: 'ocr', label: 'OCR (48px)', icon: FileText },
  { id: 'inpainting', label: 'Inpainting (LaMa)', icon: Paintbrush },
  { id: 'translating', label: 'Translation (Gemini)', icon: Languages },
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
let _cachedOcrRegions: { text: string; bbox: { x: number; y: number; width: number; height: number } }[] | null = null
let _cachedCleanedBlob: Blob | null = null
let _cachedFailedStep: PipelineStep | null = null

export function clearProcessingCache() {
  _cachedOcrRegions = null
  _cachedCleanedBlob = null
  _cachedFailedStep = null
}

export default function ProcessingView({
  imageFile,
  sourceLang,
  apiKey,
  modelId,
  mode = 'full',
  translationEngine = 'gemini',
  llmOptions,
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

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const run = async () => {
      try {
        // Smart retry: skip Docker pipeline if we already have OCR results
        let ocrRegions = _cachedOcrRegions
        let cleanedImageBlob = _cachedCleanedBlob
        const resumeFromTranslation = _cachedFailedStep === 'translating' && ocrRegions && ocrRegions.length > 0

        if (!resumeFromTranslation) {
          // Step 1: Docker pipeline (detection + OCR + inpainting)
          setCurrentStep('detection')
          setState({ status: 'detecting', progress: 10, message: 'กำลังตรวจจับข้อความ...' })
          addLog('เริ่มส่งรูปไปยัง manga-image-translator')

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
                setState((s) => ({ ...s, progress: 55, message: 'Docker pipeline เสร็จ' }))
              } else {
                setState((s) => ({ ...s, message: p.message }))
              }
            }
          }

          const result = await processImage(imageFile, undefined, onProgress)
          ocrRegions = result.regions
          cleanedImageBlob = result.cleanedImageBlob
          // Cache results for potential retry
          _cachedOcrRegions = ocrRegions
          _cachedCleanedBlob = cleanedImageBlob
          addLog(`ตรวจจับเสร็จ: พบ ${ocrRegions.length} regions`)

          if (ocrRegions.length === 0) {
            setCurrentStep('done')
            setState({ status: 'done', progress: 100, message: 'ไม่พบข้อความในรูป' })
            clearProcessingCache()
            if (cleanedImageBlob) {
              onComplete([], URL.createObjectURL(cleanedImageBlob))
            }
            return
          }
        } else {
          addLog('⚡ Smart Retry: ข้าม Docker pipeline, เริ่มต่อที่ขั้นตอนแปลภาษา')
        }

        // ── Mode: clean_only → stop here, return OCR regions without translation ──
        if (mode === 'clean_only') {
          setCurrentStep('done')
          setState({ status: 'done', progress: 100, message: `คลีนเสร็จ! พบ ${ocrRegions!.length} text regions` })
          addLog(`Mode: clean_only — หยุดที่ขั้นตอนคลีน, พบ ${ocrRegions!.length} regions`)
          clearProcessingCache()
          const cleanedUrl = cleanedImageBlob ? URL.createObjectURL(cleanedImageBlob) : ''
          // Return regions with originalText only, no translation
          const regionsWithOcr: TextRegion[] = ocrRegions!.map((r, i) => ({
            id: `region-${i}`,
            bbox: r.bbox,
            originalText: r.text,
            translatedText: '',
            mood: 'normal' as const,
            suggestedFont: 'normal',
            fontSize: 14,
            fontColor: '#000000',
            rotation: 0,
            strokeWidth: 0,
            strokeColor: '#ffffff',
          }))
          onComplete(regionsWithOcr, cleanedUrl)
          return
        }

        // ── Mode: ocr_only → return OCR regions, no cleaned image ──
        if (mode === 'ocr_only') {
          setCurrentStep('done')
          setState({ status: 'done', progress: 100, message: `OCR เสร็จ! พบ ${ocrRegions!.length} text regions` })
          addLog(`Mode: ocr_only — หยุดที่ขั้นตอน OCR, พบ ${ocrRegions!.length} regions`)
          clearProcessingCache()
          const regionsWithOcr: TextRegion[] = ocrRegions!.map((r, i) => ({
            id: `region-${i}`,
            bbox: r.bbox,
            originalText: r.text,
            translatedText: '',
            mood: 'normal' as const,
            suggestedFont: 'normal',
            fontSize: 14,
            fontColor: '#000000',
            rotation: 0,
            strokeWidth: 0,
            strokeColor: '#ffffff',
          }))
          onComplete(regionsWithOcr, '')
          return
        }

        // ── Mode: full → Translation ──
        _cachedFailedStep = 'translating'
        setCurrentStep('translating')
        const engineLabel = translationEngine === 'gemini' ? 'Gemini AI' : translationEngine === 'ollama' ? 'Ollama' : 'LibreTranslate'
        setState({ status: 'translating', progress: 75, message: `กำลังแปลด้วย ${engineLabel}...` })
        addLog(`เริ่มแปลภาษาด้วย ${engineLabel}`)

        const ocrTexts = ocrRegions!.map((r) => r.text)
        const bboxes = ocrRegions!.map((r) => r.bbox)
        addLog(`OCR texts: ${ocrTexts.map((t, i) => `[${i}] "${t}"`).join(', ')}`)

        let translatedRegions: TextRegion[]
        if (translationEngine === 'gemini') {
          addLog('กำลังเรียก Gemini API เพื่อแปลภาษา...')
          translatedRegions = await translateWithImage(imageFile, ocrTexts, bboxes, sourceLang, apiKey, modelId)
        } else {
          addLog(`กำลังเรียก ${engineLabel} เพื่อแปล ${ocrTexts.length} regions...`)
          translatedRegions = await translateRegionsWithLocalLLM(
            ocrTexts, bboxes, sourceLang,
            translationEngine as 'libretranslate' | 'ollama',
            llmOptions,
          )
        }
        addLog(`แปลเสร็จ: ${translatedRegions.length} regions`)

        setCurrentStep('done')
        setState({ status: 'done', progress: 100, message: 'เสร็จสิ้น!' })
        clearProcessingCache()
        const cleanedUrl = cleanedImageBlob ? URL.createObjectURL(cleanedImageBlob) : ''
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
  }, [imageFile, sourceLang, apiKey, modelId, mode, onComplete, onError, addLog, retryCount])

  // Filter steps based on processing mode
  const visibleSteps = useMemo(() => {
    if (mode === 'ocr_only') return STEPS.filter((s) => ['detection', 'ocr', 'done'].includes(s.id))
    if (mode === 'clean_only') return STEPS.filter((s) => ['detection', 'ocr', 'inpainting', 'done'].includes(s.id))
    return STEPS
  }, [mode])

  const stepIndex = visibleSteps.findIndex((s) => s.id === currentStep)

  return (
    <div className="w-full space-y-4 flex flex-col items-center">
      {/* Image preview with blur overlay + spinner */}
      <div className="relative w-fit">
        <img
          src={imagePreviewUrl}
          alt="Processing"
          className={`max-w-full max-h-[50vh] rounded-xl object-contain transition-all duration-500 ${
            state.status === 'done' ? '' : 'blur-sm brightness-75'
          }`}
        />

        {state.status !== 'done' && state.status !== 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="bg-base-100/80 backdrop-blur-sm rounded-lg px-4 py-2 text-center max-w-xs">
              <p className="text-sm font-medium text-base-content">
                {visibleSteps[stepIndex]?.label ?? 'Processing...'}
              </p>
              <p className="text-xs text-base-content/60 mt-0.5">{state.message}</p>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-100/60">
            <AlertCircle className="w-12 h-12 text-error" />
            <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-2 text-center max-w-sm">
              <p className="text-sm font-medium text-error">เกิดข้อผิดพลาด</p>
              <p className="text-xs text-error/80 mt-1">{state.message}</p>
            </div>
          </div>
        )}

        {state.status === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-success/20 backdrop-blur-sm rounded-full p-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-base-content/50">
          <span>{visibleSteps[stepIndex]?.label ?? 'Waiting...'}</span>
          <span>{state.progress}%</span>
        </div>
        <progress
          className={`progress w-full ${state.status === 'error' ? 'progress-error' : 'progress-primary'}`}
          value={state.progress}
          max={100}
        />
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
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isError && isActive
                    ? 'bg-error text-error-content'
                    : isDone
                      ? 'bg-primary text-primary-content'
                      : isActive
                        ? 'bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-base-100'
                        : 'bg-base-300 text-base-content/30'
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
                  isDone || isActive ? 'text-base-content' : 'text-base-content/30'
                }`}
              >
                {step.label.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Queue badge */}
      {state.queuePosition !== undefined && (
        <div className="text-center">
          <div className="badge badge-warning badge-sm">คิว: #{state.queuePosition}</div>
        </div>
      )}
    </div>
  )
}
