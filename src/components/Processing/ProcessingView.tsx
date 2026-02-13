import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessingState, TextRegion } from '../../types'
import { processImage } from '../../services/translator-api'
import { translateWithImage } from '../../services/gemini'
import type { StreamProgress } from '../../services/translator-api'

interface ProcessingViewProps {
  imageFile: File
  sourceLang: string
  onComplete: (regions: TextRegion[], cleanedImageUrl: string) => void
  onError: (error: string) => void
}

export default function ProcessingView({
  imageFile,
  sourceLang,
  onComplete,
  onError,
}: ProcessingViewProps) {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: 'เตรียมพร้อม...',
  })
  const [logs, setLogs] = useState<string[]>([])
  const hasStarted = useRef(false)

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const run = async () => {
      try {
        setState({ status: 'detecting', progress: 10, message: 'กำลังตรวจจับข้อความ...' })
        addLog('เริ่มส่งรูปไปยัง manga-image-translator')

        const onProgress = (p: StreamProgress) => {
          addLog(`[${p.status}] ${p.message}`)
          if (p.status === 'queue') {
            setState((s) => ({ ...s, message: `อยู่ในคิว: ${p.message}`, queuePosition: Number(p.message) || undefined }))
          } else if (p.status === 'progress') {
            setState((s) => ({ ...s, message: p.message }))
          }
        }

        setState({ status: 'detecting', progress: 20, message: 'กำลังตรวจจับ + OCR + Inpainting...' })
        const { regions: ocrRegions, cleanedImageBlob } = await processImage(imageFile, undefined, onProgress)
        addLog(`ตรวจจับเสร็จ: พบ ${ocrRegions.length} regions`)

        if (ocrRegions.length === 0) {
          setState({ status: 'done', progress: 100, message: 'ไม่พบข้อความในรูป' })
          if (cleanedImageBlob) {
            onComplete([], URL.createObjectURL(cleanedImageBlob))
          }
          return
        }

        setState({ status: 'translating', progress: 60, message: 'กำลังแปลด้วย Gemini AI...' })
        addLog('ส่งรูปต้นฉบับ + OCR text ไปยัง Gemini')

        const ocrTexts = ocrRegions.map((r) => r.text)
        const bboxes = ocrRegions.map((r) => r.bbox)
        const translatedRegions = await translateWithImage(imageFile, ocrTexts, bboxes, sourceLang)
        addLog(`แปลเสร็จ: ${translatedRegions.length} regions`)

        setState({ status: 'done', progress: 100, message: 'เสร็จสิ้น!' })
        const cleanedUrl = cleanedImageBlob ? URL.createObjectURL(cleanedImageBlob) : ''
        onComplete(translatedRegions, cleanedUrl)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setState({ status: 'error', progress: 0, message })
        addLog(`ERROR: ${message}`)
        onError(message)
      }
    }

    run()
  }, [imageFile, sourceLang, onComplete, onError, addLog])

  const statusLabels: Record<ProcessingState['status'], string> = {
    idle: '⏳ รอดำเนินการ',
    detecting: '🔍 ตรวจจับข้อความ',
    ocr: '📝 อ่านข้อความ (OCR)',
    inpainting: '🎨 ลบข้อความต้นฉบับ',
    translating: '🤖 แปลด้วย AI',
    done: '✅ เสร็จสิ้น',
    error: '❌ เกิดข้อผิดพลาด',
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Status */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">{statusLabels[state.status]}</p>
        <p className="text-base-content/60">{state.message}</p>
        {state.queuePosition !== undefined && (
          <div className="badge badge-warning">คิว: #{state.queuePosition}</div>
        )}
      </div>

      {/* Progress bar */}
      <progress
        className={`progress w-full ${state.status === 'error' ? 'progress-error' : 'progress-primary'}`}
        value={state.progress}
        max={100}
      />

      {/* Step indicators */}
      <ul className="steps steps-vertical text-sm w-full">
        <li className={`step ${state.progress >= 10 ? 'step-primary' : ''}`}>
          Detection (CTD)
        </li>
        <li className={`step ${state.progress >= 30 ? 'step-primary' : ''}`}>
          OCR (48px)
        </li>
        <li className={`step ${state.progress >= 45 ? 'step-primary' : ''}`}>
          Inpainting (LaMa)
        </li>
        <li className={`step ${state.progress >= 60 ? 'step-primary' : ''}`}>
          Translation (Gemini)
        </li>
        <li className={`step ${state.progress >= 100 ? 'step-primary' : ''}`}>
          Done
        </li>
      </ul>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="collapse collapse-arrow bg-base-200">
          <input type="checkbox" />
          <div className="collapse-title text-sm font-medium">
            Logs ({logs.length})
          </div>
          <div className="collapse-content">
            <div className="mockup-code text-xs max-h-48 overflow-y-auto">
              {logs.map((log, i) => (
                <pre key={i} data-prefix={i + 1}>
                  <code>{log}</code>
                </pre>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
