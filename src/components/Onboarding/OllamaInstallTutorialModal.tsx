import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Download, HardDriveDownload, Play, Settings } from 'lucide-react'
import { Button, Modal } from '../ui/primitives'
import { markOllamaTutorialSeen } from '../../services/onboardingStorage'
import {
  OLLAMA_DOWNLOAD_URL,
  OLLAMA_RECOMMENDED_MODEL,
  OLLAMA_TUTORIAL_STEPS,
  type OllamaTutorialStep,
} from './ollamaTutorial'

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
  const step = OLLAMA_TUTORIAL_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === OLLAMA_TUTORIAL_STEPS.length - 1

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
