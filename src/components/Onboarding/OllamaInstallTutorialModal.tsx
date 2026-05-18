import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Download, HardDriveDownload, Loader2, Play, Settings } from 'lucide-react'
import { Button, Modal } from '../ui/primitives'
import { getOllamaStatus } from '../../services/ollama'
import { markOllamaTutorialSeen } from '../../services/onboardingStorage'
import {
  OLLAMA_DOWNLOAD_URL,
  OLLAMA_RECOMMENDED_MODEL,
  OLLAMA_TUTORIAL_STEPS,
  type OllamaTutorialStep,
} from './ollamaTutorial'

const OLLAMA_POLL_INTERVAL_MS = 2500
const OLLAMA_POLL_TIMEOUT_MS = 3 * 60 * 1000
const PULL_MODEL_STEP_INDEX = OLLAMA_TUTORIAL_STEPS.findIndex((step) => step.id === 'pull-model')

interface OllamaInstallTutorialModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  onCheckStatus?: () => void | Promise<void>
  onStartOllama?: () => void | Promise<void>
  onPullRecommendedModel?: (model: string) => void | Promise<void>
  onSaveSettings?: () => void | Promise<void>
  onOpenSettings?: () => void
}

export default function OllamaInstallTutorialModal({
  isOpen,
  onClose,
  onComplete,
  onCheckStatus,
  onStartOllama,
  onPullRecommendedModel,
  onSaveSettings,
  onOpenSettings,
}: OllamaInstallTutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [detected, setDetected] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const stepIndexRef = useRef(stepIndex)
  stepIndexRef.current = stepIndex
  const step = OLLAMA_TUTORIAL_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === OLLAMA_TUTORIAL_STEPS.length - 1

  // Ghost polling: detect Ollama in the background instead of asking the user to press Detect.
  useEffect(() => {
    if (!isOpen || detected) return
    let cancelled = false

    const poll = async () => {
      const status = await getOllamaStatus().catch(() => null)
      if (cancelled || !status?.ok) return
      setDetected(true)
      // Skip ahead to the model step, but never yank the user backwards.
      if (PULL_MODEL_STEP_INDEX >= 0 && stepIndexRef.current < PULL_MODEL_STEP_INDEX) {
        setTimeout(() => {
          if (!cancelled) setStepIndex((current) => Math.max(current, PULL_MODEL_STEP_INDEX))
        }, 1200)
      }
    }

    void poll()
    const intervalId = window.setInterval(() => void poll(), OLLAMA_POLL_INTERVAL_MS)
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setPollTimedOut(true)
    }, OLLAMA_POLL_TIMEOUT_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, detected])

  useEffect(() => {
    if (!isOpen) {
      setDetected(false)
      setPollTimedOut(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setStepIndex(0)
    onClose()
  }

  const handleComplete = () => {
    markOllamaTutorialSeen()
    setStepIndex(0)
    onComplete?.()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="วิธีติดตั้ง Ollama"
      className="OllamaTutorialModal overflow-hidden p-0"
      layerClassName="relative z-[240]"
      hideHeader
    >
      <div className="OllamaTutorialShell">
        <aside className="OllamaTutorialSidebar">
          <div>
            <p className="text-[11px] font-bold tracking-[0.06em] text-[var(--moxzk-dim)]">Ollama setup</p>
            <h2 className="mt-2 text-xl font-bold text-[var(--moxzk-text)]">ตั้งค่า AI แปลภาษา</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--moxzk-muted)]">
              ทำตามทีละขั้นตอน แล้วกลับมาเช็คสถานะใน Moxzk ได้ทันที
            </p>
          </div>
          <ol className="OllamaTutorialSteps">
            {OLLAMA_TUTORIAL_STEPS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`OllamaTutorialStep ${index === stepIndex ? 'OllamaTutorialStepActive' : ''}`}
                  onClick={() => setStepIndex(index)}
                  aria-current={index === stepIndex ? 'step' : undefined}
                >
                  <span>{index + 1}</span>
                  <span className="min-w-0 truncate">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="OllamaTutorialMain">
          <header className="OllamaTutorialHeader">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--moxzk-accent)]">{step.eyebrow} / {OLLAMA_TUTORIAL_STEPS.length}</p>
              <h3 className="mt-1 text-2xl font-bold text-[var(--moxzk-text)]">{step.title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--moxzk-muted)]">{step.body}</p>
            </div>
            <button type="button" className="OllamaTutorialClose" onClick={handleClose}>
              ปิด
            </button>
          </header>

          <figure key={step.id} className="OllamaTutorialImageFrame">
            <img src={`${import.meta.env.BASE_URL}${step.imageSrc}`} alt={step.imageAlt} loading="lazy" decoding="async" />
          </figure>

          <OllamaDetectBanner detected={detected} timedOut={pollTimedOut} onOpenSettings={onOpenSettings} />

          <div className="OllamaTutorialActions">
            <StepAction
              step={step}
              onCheckStatus={onCheckStatus}
              onStartOllama={onStartOllama}
              onPullRecommendedModel={onPullRecommendedModel}
              onSaveSettings={onSaveSettings}
              onOpenSettings={onOpenSettings}
            />
          </div>

          <footer className="OllamaTutorialFooter">
            <Button variant="ghost" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={isFirst}>
              <ArrowLeft size={14} /> ย้อนกลับ
            </Button>
            <div className="OllamaTutorialProgress" aria-label={`ขั้นตอน ${stepIndex + 1} จาก ${OLLAMA_TUTORIAL_STEPS.length}`}>
              {OLLAMA_TUTORIAL_STEPS.map((item, index) => (
                <span key={item.id} className={index <= stepIndex ? 'OllamaTutorialProgressDone' : ''} />
              ))}
            </div>
            {isLast ? (
              <Button variant="primary" onClick={handleComplete}>
                <CheckCircle2 size={14} /> เสร็จแล้ว
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setStepIndex((current) => Math.min(OLLAMA_TUTORIAL_STEPS.length - 1, current + 1))}>
                ถัดไป <ArrowRight size={14} />
              </Button>
            )}
          </footer>
        </main>
      </div>
    </Modal>
  )
}

function OllamaDetectBanner({
  detected,
  timedOut,
  onOpenSettings,
}: {
  detected: boolean
  timedOut: boolean
  onOpenSettings?: () => void
}) {
  if (detected) {
    return (
      <div className="OllamaDetectBanner OllamaDetectBannerOk">
        <CheckCircle2 size={16} />
        <span>Moxzk เชื่อมต่อ Ollama แล้ว — ไปขั้นโหลดโมเดลได้เลย</span>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="OllamaDetectBanner OllamaDetectBannerWarn">
        <span>ยังไม่เจอ Ollama ลองเปิดโปรแกรม Ollama ในเครื่อง แล้วรอสักครู่</span>
        {onOpenSettings ? (
          <Button variant="ghost" onClick={onOpenSettings}>
            <Settings size={14} /> เปิดหน้าตั้งค่า
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="OllamaDetectBanner">
      <Loader2 size={16} className="animate-spin" />
      <span>กำลังค้นหา Ollama ในเครื่องอัตโนมัติ…</span>
    </div>
  )
}

function StepAction({
  step,
  onCheckStatus,
  onStartOllama,
  onPullRecommendedModel,
  onSaveSettings,
  onOpenSettings,
}: {
  step: OllamaTutorialStep
  onCheckStatus?: () => void | Promise<void>
  onStartOllama?: () => void | Promise<void>
  onPullRecommendedModel?: (model: string) => void | Promise<void>
  onSaveSettings?: () => void | Promise<void>
  onOpenSettings?: () => void
}) {
  if (step.action === 'download') {
    return (
      <Button variant="primary" onClick={() => window.open(OLLAMA_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')}>
        <Download size={14} /> เปิดหน้าโหลด Ollama
      </Button>
    )
  }

  if (step.action === 'start-ollama') {
    return onStartOllama ? (
      <Button variant="soft" onClick={() => void onStartOllama()}>
        <Play size={14} /> เริ่ม Ollama
      </Button>
    ) : (
      <OpenSettingsButton onOpenSettings={onOpenSettings} />
    )
  }

  if (step.action === 'check-status') {
    return onCheckStatus ? (
      <Button variant="soft" onClick={() => void onCheckStatus()}>
        <CheckCircle2 size={14} /> ตรวจสถานะ
      </Button>
    ) : (
      <OpenSettingsButton onOpenSettings={onOpenSettings} />
    )
  }

  if (step.action === 'pull-model') {
    return onPullRecommendedModel ? (
      <Button variant="soft" onClick={() => void onPullRecommendedModel(OLLAMA_RECOMMENDED_MODEL)}>
        <HardDriveDownload size={14} /> โหลด {OLLAMA_RECOMMENDED_MODEL} เข้า Ollama
      </Button>
    ) : (
      <OpenSettingsButton onOpenSettings={onOpenSettings} />
    )
  }

  if (step.action === 'save-settings') {
    return onSaveSettings ? (
      <Button variant="soft" onClick={() => void onSaveSettings()}>
        <Settings size={14} /> บันทึกการตั้งค่า
      </Button>
    ) : (
      <OpenSettingsButton onOpenSettings={onOpenSettings} />
    )
  }

  return null
}

function OpenSettingsButton({ onOpenSettings }: { onOpenSettings?: () => void }) {
  if (!onOpenSettings) return null
  return (
    <Button variant="soft" onClick={onOpenSettings}>
      <Settings size={14} /> เปิดหน้าตั้งค่า
    </Button>
  )
}
