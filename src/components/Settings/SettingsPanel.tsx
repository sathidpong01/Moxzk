import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppSettings, TranslationMode } from '../../types'
import type { OllamaPullProgress, OllamaStatus } from '../../services/ollama'
import type { PanelCleanerStatus } from '../../services/panelcleaner-api'
import { getAppRuntime } from '../../runtime'
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  HardDriveDownload,
  Key,
  Languages,
  Loader2,
  Save,
  Server,
  Settings,
  Terminal,
  Workflow,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, Modal, SelectField, TextareaField, TextInput } from '../ui/primitives'
import { parseApiError } from '../../utils/parseApiError'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'general' | 'models' | 'translation' | 'cleanup'

const TABS: { id: SettingsTab; label: string; description: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'ทั่วไป', description: 'ภาษาและสถานะรวม', icon: Settings },
  { id: 'models', label: 'AI / Models', description: 'Ollama และติดตั้งโมเดล', icon: Cpu },
  { id: 'translation', label: 'แปลภาษา', description: 'บริบทและโทนคำแปล', icon: Languages },
  { id: 'cleanup', label: 'Cleanup', description: 'PanelCleaner bridge', icon: Server },
]

const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download/windows'
const OLLAMA_API_DOC_URL = 'https://docs.ollama.com/api/introduction'
const OLLAMA_PULL_DOC_URL = 'https://docs.ollama.com/api/pull'
const GEMMA3_DOC_URL = 'https://ollama.com/library/gemma3'
const OLLAMA_STATUS_TIMEOUT_MS = 8000
const OLLAMA_MODELS_TIMEOUT_MS = 15000
const PANELCLEANER_STATUS_TIMEOUT_MS = 15000

const MODEL_PRESETS = [
  {
    name: 'gemma3:4b',
    title: 'Gemma 3 4B',
    badge: 'แนะนำเริ่มต้น',
    description: 'ขนาดพอดีสำหรับเริ่มใช้งานบนเครื่องทั่วไป รองรับ vision และหลายภาษา',
  },
  {
    name: 'gemma3:12b',
    title: 'Gemma 3 12B',
    badge: 'คุณภาพสูงขึ้น',
    description: 'เหมาะกับเครื่องที่มี RAM/VRAM มากกว่า และต้องการความแม่นยำของภาพกับภาษา',
  },
]

const TRANSLATION_MODES: Array<{ value: TranslationMode; label: string; description: string }> = [
  {
    value: 'concise',
    label: 'สั้นเข้าใจได้',
    description: 'กระชับให้เหมาะกับบับเบิล แต่ยังเก็บสาระสำคัญและน้ำเสียง',
  },
  {
    value: 'faithful',
    label: 'ตรงตามต้นฉบับ',
    description: 'รักษารายละเอียด ลำดับความคิด และโทนใกล้ต้นฉบับมากขึ้น',
  },
]

function modelCommand(model: string): string {
  return `ollama pull ${model}`
}

function formatBytes(value?: number): string {
  if (!value || value <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`
}

function getPullPercent(progress: OllamaPullProgress | null): number | null {
  if (!progress?.total || !progress.completed) return null
  return Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 100)))
}

function toFriendlyServiceError(service: 'ollama' | 'panelcleaner', raw?: string): string {
  const prefix = service === 'ollama' ? 'Ollama' : 'PanelCleaner'
  const fallback = service === 'ollama' ? 'เชื่อมต่อ Ollama ไม่สำเร็จ' : 'เช็ค PanelCleaner ไม่สำเร็จ'
  return parseApiError(`${prefix} ${raw ?? fallback}`).shortMessage
}

function isLocalServiceUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

export default function SettingsPanel({
  settings,
  onSave,
  isOpen,
  onClose,
}: SettingsPanelProps) {
  const appRuntime = getAppRuntime()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [tab, setTab] = useState<SettingsTab>('general')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [checkingOllama, setCheckingOllama] = useState(false)
  const [modelNames, setModelNames] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<OllamaPullProgress | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)
  const [panelCleanerStatus, setPanelCleanerStatus] = useState<PanelCleanerStatus | null>(null)
  const [checkingPanelCleaner, setCheckingPanelCleaner] = useState(false)
  const [startingOllama, setStartingOllama] = useState(false)
  const [startingPanelCleaner, setStartingPanelCleaner] = useState(false)

  const installedModels = useMemo(() => new Set(modelNames), [modelNames])
  const pullPercent = getPullPercent(pullProgress)
  const currentTab = TABS.find((item) => item.id === tab) ?? TABS[0]
  const canStartLocalServices = appRuntime.capabilities.canStartLocalServices
  const canStartOllama = canStartLocalServices && isLocalServiceUrl(draft.ollamaUrl)
  const canStartPanelCleaner = canStartLocalServices && isLocalServiceUrl(draft.panelCleanerBridgeUrl)

  useEffect(() => {
    if (isOpen) {
      setDraft(settings)
      setOllamaStatus(null)
      setPanelCleanerStatus(null)
      setPullProgress(null)
      setPullError(null)
      setPullingModel(null)
      setStartingOllama(false)
      setStartingPanelCleaner(false)
    }
  }, [isOpen, settings])

  const handleSave = () => {
    onSave({ ...draft, theme: 'studio-dark' })
    onClose()
    toast.success('บันทึกการตั้งค่าเรียบร้อย')
  }

  const handleCheckOllama = async () => {
    setCheckingOllama(true)
    try {
      const status = await appRuntime.ollama.getServerStatus({
        ollamaUrl: draft.ollamaUrl,
        ollamaApiKey: draft.ollamaApiKey,
        timeoutMs: OLLAMA_STATUS_TIMEOUT_MS,
      })
      setOllamaStatus(status)
      if (status.ok) {
        toast.success(status.version === 'cloud' ? 'Ollama Cloud พร้อมใช้งาน' : `Ollama ${status.version ?? ''} พร้อมใช้งาน`)
      } else {
        toast.error(toFriendlyServiceError('ollama', status.error))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setOllamaStatus({
        ok: false,
        url: draft.ollamaUrl,
        error: message,
      })
      toast.error(toFriendlyServiceError('ollama', message))
    } finally {
      setCheckingOllama(false)
    }
  }

  const handleLoadModels = async () => {
    setLoadingModels(true)
    try {
      const models = await appRuntime.ollama.listModels({
        ollamaUrl: draft.ollamaUrl,
        ollamaApiKey: draft.ollamaApiKey,
        timeoutMs: OLLAMA_MODELS_TIMEOUT_MS,
      })
      setModelNames(models.map((model) => model.name || model.model || '').filter(Boolean))
      toast.success(`พบ ${models.length} โมเดล`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`โหลดรายการโมเดลไม่สำเร็จ: ${toFriendlyServiceError('ollama', message)}`)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleStartOllama = async () => {
    setStartingOllama(true)
    try {
      const result = await appRuntime.localServices.startOllama()
      if (result.ok) {
        toast.success('เริ่ม Ollama แล้ว')
        await handleCheckOllama()
      } else {
        toast.error(toFriendlyServiceError('ollama', result.error))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(toFriendlyServiceError('ollama', message))
    } finally {
      setStartingOllama(false)
    }
  }

  const handlePullModel = async (model: string) => {
    setPullingModel(model)
    setPullProgress({ status: 'เตรียมดาวน์โหลด' })
    setPullError(null)
    try {
      const result = await appRuntime.ollama.pullModel({
        ollamaUrl: draft.ollamaUrl,
        ollamaApiKey: draft.ollamaApiKey,
        model,
        onProgress: setPullProgress,
      })
      setPullProgress(result)
      setModelNames((current) => current.includes(model) ? current : [...current, model])
      toast.success(`ติดตั้ง ${model} เสร็จแล้ว`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setPullError(message)
      toast.error(`ติดตั้งโมเดลไม่สำเร็จ: ${message}`)
    } finally {
      setPullingModel(null)
    }
  }

  const handleCopyCommand = async (model: string) => {
    const command = modelCommand(model)
    try {
      await navigator.clipboard.writeText(command)
      toast.success('คัดลอกคำสั่งแล้ว')
    } catch {
      toast.error(`คัดลอกไม่ได้ ให้พิมพ์คำสั่งนี้เอง: ${command}`)
    }
  }

  const handleUseModel = (model: string) => {
    setDraft((current) => ({ ...current, ollamaModel: model }))
    toast.success(`เลือก ${model} เป็นโมเดลใช้งานแล้ว กดบันทึกเพื่อเก็บค่า`)
  }

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCheckPanelCleaner = async () => {
    setCheckingPanelCleaner(true)
    try {
      const status = await appRuntime.panelCleaner.getStatus({
        bridgeUrl: draft.panelCleanerBridgeUrl,
        executablePath: draft.panelCleanerExecutablePath,
        timeoutMs: PANELCLEANER_STATUS_TIMEOUT_MS,
      })
      setPanelCleanerStatus(status)
      if (status.ok && !draft.panelCleanerExecutablePath && status.command && /[\\/]/.test(status.command)) {
        setDraft((current) => ({ ...current, panelCleanerExecutablePath: status.command! }))
      }
      if (status.ok) {
        toast.success(`PanelCleaner พร้อมใช้งาน${status.version ? ` (${status.version})` : ''}`)
      } else {
        toast.error(toFriendlyServiceError('panelcleaner', status.error))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setPanelCleanerStatus({ ok: false, error: message })
      toast.error(toFriendlyServiceError('panelcleaner', message))
    } finally {
      setCheckingPanelCleaner(false)
    }
  }

  const handleStartPanelCleaner = async () => {
    setStartingPanelCleaner(true)
    try {
      const result = await appRuntime.localServices.startPanelCleanerBridge()
      if (result.ok) {
        toast.success('เริ่ม PanelCleaner bridge แล้ว')
        await handleCheckPanelCleaner()
      } else {
        toast.error(toFriendlyServiceError('panelcleaner', result.error))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(toFriendlyServiceError('panelcleaner', message))
    } finally {
      setStartingPanelCleaner(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ตั้งค่า"
      className="SettingsWorkspace max-w-6xl overflow-hidden p-0"
      hideHeader
    >
      <div className="SettingsFrame flex h-[min(84vh,820px)] min-h-[620px] min-w-0">
        <aside className="SettingsSidebar flex w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--settings-divider)]">
          <div className="border-b border-[var(--settings-divider)] p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-white/10 bg-white/[0.055] text-[var(--mg-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Cpu size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--mg-dim)]">MG Translater</p>
                <p className="mt-1 truncate text-xs font-bold text-[var(--mg-muted)]">Local manga studio</p>
              </div>
            </div>
          </div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`settings-nav-item group flex w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left transition ${
                  tab === id ? 'settings-nav-active' : 'settings-nav-idle'
                }`}
                onClick={() => setTab(id)}
              >
                <Icon
                  size={15}
                  className={`shrink-0 ${tab === id ? 'text-[var(--mg-text)]' : 'text-[var(--mg-dim)] group-hover:text-[var(--mg-muted)]'}`}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-5">{label}</span>
                </span>
              </button>
            ))}
          </nav>
          <div className="border-t border-[var(--settings-divider)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--mg-muted)]">
              <Workflow size={14} />
              <span>{appRuntime.kind === 'web' ? 'Web phase' : 'Electron'}</span>
            </div>
          </div>
        </aside>

        <main className="SettingsMain flex min-w-0 flex-1 flex-col">
          <header className="SettingsHeader flex shrink-0 items-center justify-between gap-4 border-b border-[var(--settings-divider)] px-8 py-6">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-[var(--mg-text)]">{currentTab.label}</h2>
              <p className="mt-1 text-sm text-[var(--mg-muted)]">{currentTab.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={13} /> ยกเลิก
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                <Save size={13} /> บันทึก
              </Button>
            </div>
          </header>

          <section className="min-h-0 flex-1 overflow-y-auto px-8">
            {tab === 'general' && (
              <SettingsSheet>
                <SettingsRow
                  title="ภาษาต้นฉบับ"
                  description="ใช้กับ OCR/AI ตอนแปล ถ้าไม่มั่นใจให้ปล่อยเป็นตรวจอัตโนมัติ"
                >
                  <SelectField
                    value={draft.sourceLang}
                    onChange={(sourceLang) => setDraft({ ...draft, sourceLang })}
                    options={[
                      { value: 'auto', label: 'ตรวจอัตโนมัติ' },
                      { value: 'ja', label: 'ญี่ปุ่น' },
                      { value: 'zh', label: 'จีน' },
                      { value: 'en', label: 'อังกฤษ' },
                    ]}
                  />
                </SettingsRow>
                <SettingsRow title="สถานะระบบ" description="เช็คบริการสำคัญก่อนเริ่มงาน">
                  <div className="grid gap-3 md:grid-cols-3">
                    <StatusTile
                      icon={<Cpu size={16} />}
                      label="Ollama"
                      value={ollamaStatus?.ok ? 'พร้อมใช้งาน' : 'ยังไม่ได้ตรวจ'}
                      tone={ollamaStatus?.ok ? 'good' : 'muted'}
                    />
                    <StatusTile
                      icon={<Server size={16} />}
                      label="PanelCleaner"
                      value={panelCleanerStatus?.ok ? 'พร้อมใช้งาน' : 'ยังไม่ได้ตรวจ'}
                      tone={panelCleanerStatus?.ok ? 'good' : 'muted'}
                    />
                    <StatusTile
                      icon={<Workflow size={16} />}
                      label="Runtime"
                      value={appRuntime.kind === 'web' ? 'Web phase' : 'Electron'}
                      tone="muted"
                    />
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'models' && (
              <SettingsSheet>
                <SettingsRow
                  title="Ollama endpoint"
                  description="Local endpoint ปกติคือ localhost ส่วน Cloud ใช้ ollama.com พร้อม API key"
                >
                  <div className="space-y-4">
                    <Field label="Endpoint" hint="Local: http://localhost:11434, Cloud: https://ollama.com">
                      <TextInput
                        type="url"
                        placeholder="http://localhost:11434"
                        value={draft.ollamaUrl}
                        onChange={(e) => setDraft({ ...draft, ollamaUrl: e.target.value })}
                      />
                    </Field>
                    <Field label={<span className="flex items-center gap-1"><Key size={12} /> Ollama Cloud API Key</span>}>
                      <TextInput
                        type="password"
                        placeholder="ใส่เฉพาะเมื่อใช้ https://ollama.com"
                        value={draft.ollamaApiKey}
                        onChange={(e) => setDraft({ ...draft, ollamaApiKey: e.target.value })}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {canStartOllama && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleStartOllama}
                          disabled={startingOllama || checkingOllama}
                        >
                          {startingOllama ? <Loader2 size={12} className="animate-spin" /> : <Terminal size={12} />}
                          เริ่ม Ollama
                        </Button>
                      )}
                      <Button variant="soft" size="sm" onClick={handleCheckOllama} disabled={checkingOllama}>
                        {checkingOllama ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        ตรวจสถานะ
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleLoadModels} disabled={loadingModels}>
                        {loadingModels ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
                        โหลดโมเดล
                      </Button>
                    </div>
                    {ollamaStatus && (
                      <div className="mg-notice">
                        {ollamaStatus.ok ? <CheckCircle2 size={14} className="text-[var(--mg-success)]" /> : <AlertCircle size={14} className="text-[var(--mg-warning)]" />}
                        <span>
                          {ollamaStatus.ok
                            ? `เชื่อมต่อ ${ollamaStatus.url} สำเร็จ${ollamaStatus.version ? ` (${ollamaStatus.version})` : ''}`
                            : `${ollamaStatus.url}: ${toFriendlyServiceError('ollama', ollamaStatus.error)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </SettingsRow>

                <SettingsRow title="โมเดลที่ใช้แปล" description="เลือกจากรายการที่โหลดได้ หรือพิมพ์ชื่อโมเดลเอง">
                  <Field label="โมเดล Ollama" hint="ค่าเดิมจะไม่ถูกเปลี่ยนจนกว่าจะกดบันทึก">
                    <TextInput
                      type="text"
                      placeholder="gemma3:4b"
                      value={draft.ollamaModel}
                      onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
                      list={modelNames.length > 0 ? 'ollama-models' : undefined}
                    />
                    {modelNames.length > 0 && (
                      <datalist id="ollama-models">
                        {modelNames.map((name) => <option key={name} value={name} />)}
                      </datalist>
                    )}
                  </Field>
                  {modelNames.length > 0 && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {modelNames.slice(0, 6).map((name) => (
                        <button
                          key={name}
                          className="settings-choice-row"
                          onClick={() => handleUseModel(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </SettingsRow>

                <SettingsRow title="คู่มือเริ่มต้น" description="สำหรับคนที่ยังไม่เคยติดตั้ง Ollama หรือโมเดลมาก่อน">
                  <div className="space-y-4">
                    <div className="mg-notice">
                      <Globe size={14} />
                      <span>{canStartLocalServices ? 'Electron เริ่ม local Ollama ได้เมื่อ endpoint เป็น localhost; installer และ cloud key ยังต้องจัดการเอง' : 'Web runtime เปิด installer, start service หรือสั่ง CLI แทนผู้ใช้ไม่ได้'}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <StepCard
                        step="1"
                        icon={<Download size={16} />}
                        title="ดาวน์โหลด Ollama"
                        description="เปิดหน้า official แล้วติดตั้งบน Windows"
                        action={(
                          <Button variant="soft" size="sm" onClick={() => handleOpenLink(OLLAMA_DOWNLOAD_URL)}>
                            <ExternalLink size={12} /> เปิดลิงก์
                          </Button>
                        )}
                      />
                      <StepCard
                        step="2"
                        icon={<Terminal size={16} />}
                        title="เปิด Ollama"
                        description="เปิดแอป Ollama หรือรัน ollama serve"
                        action={(
                          <Button variant="ghost" size="sm" onClick={() => handleOpenLink(OLLAMA_API_DOC_URL)}>
                            <BookOpenText size={12} /> อ่าน API
                          </Button>
                        )}
                      />
                      <StepCard
                        step="3"
                        icon={<Cpu size={16} />}
                        title="เลือกโมเดล"
                        description="เริ่มจาก 4B ก่อน ถ้าเครื่องแรงค่อยไป 12B"
                        action={(
                          <Button variant="ghost" size="sm" onClick={() => handleOpenLink(GEMMA3_DOC_URL)}>
                            <ExternalLink size={12} /> ดูโมเดล
                          </Button>
                        )}
                      />
                      <StepCard
                        step="4"
                        icon={<HardDriveDownload size={16} />}
                        title="ติดตั้งในเครื่อง"
                        description="กดติดตั้งหรือคัดลอกคำสั่งไป PowerShell"
                        action={(
                          <Button variant="ghost" size="sm" onClick={() => handleOpenLink(OLLAMA_PULL_DOC_URL)}>
                            <BookOpenText size={12} /> Pull API
                          </Button>
                        )}
                      />
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {MODEL_PRESETS.map((preset) => {
                        const isPulling = pullingModel === preset.name
                        const isInstalled = installedModels.has(preset.name)
                        return (
                          <div key={preset.name} className="settings-model-preset">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-[var(--mg-text)]">{preset.title}</h4>
                                <span className="settings-pill">{preset.badge}</span>
                                {isInstalled && <span className="settings-pill-success">ติดตั้งแล้ว</span>}
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-[var(--mg-muted)]">{preset.description}</p>
                              <code className="settings-command">{modelCommand(preset.name)}</code>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handlePullModel(preset.name)}
                                disabled={Boolean(pullingModel)}
                              >
                                {isPulling ? <Loader2 size={12} className="animate-spin" /> : <HardDriveDownload size={12} />}
                                ติดตั้งในเครื่องนี้
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleCopyCommand(preset.name)}>
                                <Copy size={12} /> คัดลอกคำสั่ง
                              </Button>
                              <Button variant="soft" size="sm" onClick={() => handleUseModel(preset.name)}>
                                <CheckCircle2 size={12} /> ใช้โมเดลนี้
                              </Button>
                            </div>
                            {isPulling && (
                              <div className="mt-4 space-y-2">
                                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                                  <div
                                    className="h-full rounded-full bg-[var(--mg-accent)] transition-all"
                                    style={{ width: `${pullPercent ?? 8}%` }}
                                  />
                                </div>
                                <p className="text-xs text-[var(--mg-muted)]">
                                  {pullProgress?.status ?? 'กำลังดาวน์โหลด'}{pullPercent != null ? ` - ${pullPercent}% (${formatBytes(pullProgress?.completed)} / ${formatBytes(pullProgress?.total)})` : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {pullError && (
                      <div className="mg-notice">
                        <AlertCircle size={14} className="text-[var(--mg-warning)]" />
                        <span>ติดตั้งผ่านแอปไม่สำเร็จ: {pullError} ให้คัดลอกคำสั่งแล้ววางใน PowerShell หรือเปิด Ollama ให้พร้อมก่อนลองใหม่</span>
                      </div>
                    )}
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'translation' && (
              <SettingsSheet>
                <SettingsRow title="บริบทข้ามหน้า" description="รักษาคำเรียก ความสัมพันธ์ และสำนวนให้ต่อเนื่องตอนแปลหลายหน้า">
                  <label className="settings-toggle-row">
                    <input
                      type="checkbox"
                      checked={draft.translationContextEnabled}
                      onChange={(e) => setDraft({ ...draft, translationContextEnabled: e.target.checked })}
                    />
                    <span>
                      <span className="block font-bold text-[var(--mg-text)]">ใช้บริบทข้ามหน้า</span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--mg-muted)]">
                        ส่งบทพูดหน้าก่อน ๆ เข้า Ollama ตอนแปลหลายหน้า
                      </span>
                    </span>
                  </label>
                </SettingsRow>
                <SettingsRow title="โหมดคำแปล" description="เลือกสมดุลระหว่างความกระชับในบับเบิลกับความตรงตามต้นฉบับ">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TRANSLATION_MODES.map((mode) => {
                      const active = (draft.translationMode ?? 'concise') === mode.value
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          className={`settings-choice-row settings-choice-card ${active ? 'settings-choice-active' : ''}`}
                          aria-pressed={active}
                          onClick={() => setDraft({ ...draft, translationMode: mode.value })}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span>{mode.label}</span>
                            {active && <CheckCircle2 size={15} className="settings-choice-check" aria-hidden="true" />}
                          </span>
                          <span className="mt-1 block text-xs font-medium leading-relaxed text-[var(--mg-muted)]">
                            {mode.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </SettingsRow>
                <SettingsRow title="ไกด์โทนคำแปล" description="กำกับชื่อ ความสัมพันธ์ คำเรียกแทนตัว และโทนภาษาไทยทั้งอัลบั้ม">
                  <TextareaField
                    rows={14}
                    className="resize-none font-mono text-xs leading-relaxed"
                    value={draft.translationStyleGuide}
                    onChange={(e) => setDraft({ ...draft, translationStyleGuide: e.target.value })}
                  />
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'cleanup' && (
              <SettingsSheet>
                <SettingsRow title="PanelCleaner bridge" description={canStartLocalServices ? 'Electron เริ่ม bridge บนเครื่องนี้ได้ โดยยังใช้ PanelCleaner เป็น external CLI' : 'Web phase ต้องใช้ local bridge เพราะ browser เรียก Python/CLI โดยตรงไม่ได้'}>
                  <div className="space-y-4">
                    <div className="mg-notice">
                      <Server size={14} />
                      <span>{canStartPanelCleaner ? 'กดเริ่ม bridge ได้จาก Electron หรือรัน npm run backend:panelcleaner เองก็ได้' : 'ให้รัน npm run backend:panelcleaner ก่อนเริ่มประมวลผล'}</span>
                    </div>
                    <Field label="PanelCleaner Bridge URL" hint="ค่าเริ่มต้น: http://localhost:5055">
                      <TextInput
                        type="url"
                        placeholder="http://localhost:5055"
                        value={draft.panelCleanerBridgeUrl}
                        onChange={(e) => setDraft({ ...draft, panelCleanerBridgeUrl: e.target.value })}
                      />
                    </Field>
                    <Field label="ตำแหน่งไฟล์ PanelCleaner" hint="เว้นว่างเพื่อค้นหา pcleaner / pcleaner-cli จาก PATH">
                      <TextInput
                        type="text"
                        placeholder="เว้นว่างเพื่อค้นหา pcleaner / pcleaner-cli จาก PATH"
                        value={draft.panelCleanerExecutablePath}
                        onChange={(e) => setDraft({ ...draft, panelCleanerExecutablePath: e.target.value })}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {canStartPanelCleaner && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleStartPanelCleaner}
                          disabled={startingPanelCleaner || checkingPanelCleaner}
                        >
                          {startingPanelCleaner ? <Loader2 size={12} className="animate-spin" /> : <Terminal size={12} />}
                          เริ่ม PanelCleaner
                        </Button>
                      )}
                      <Button variant="soft" size="sm" onClick={handleCheckPanelCleaner} disabled={checkingPanelCleaner}>
                        {checkingPanelCleaner ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        ตรวจ PanelCleaner
                      </Button>
                    </div>
                    {panelCleanerStatus && (
                      <div className="mg-notice">
                        {panelCleanerStatus.ok ? <CheckCircle2 size={14} className="text-[var(--mg-success)]" /> : <AlertCircle size={14} className="text-[var(--mg-warning)]" />}
                        <span>
                          {panelCleanerStatus.ok
                            ? `PanelCleaner พร้อมใช้งาน${panelCleanerStatus.version ? ` (${panelCleanerStatus.version})` : ''}${panelCleanerStatus.command ? ` - ${panelCleanerStatus.command}` : ''}`
                            : `${toFriendlyServiceError('panelcleaner', panelCleanerStatus.error)}${panelCleanerStatus.installHint ? ` - ${panelCleanerStatus.installHint}` : ''}`}
                        </span>
                      </div>
                    )}
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

          </section>
        </main>
      </div>
    </Modal>
  )
}

function SettingsSheet({ children }: { children: ReactNode }) {
  return <div className="settings-sheet">{children}</div>
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="settings-row">
      <div className="settings-row-label">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="settings-row-control">{children}</div>
    </section>
  )
}

function StatusTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'good' | 'muted'
}) {
  return (
    <div className="settings-status-tile">
      <div className={tone === 'good' ? 'text-[var(--mg-success)]' : 'text-[var(--mg-muted)]'}>{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--mg-dim)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--mg-text)]">{value}</p>
    </div>
  )
}

function StepCard({
  step,
  icon,
  title,
  description,
  action,
}: {
  step: string
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="settings-step">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-[var(--mg-text)]">{step}</span>
        <span className="text-[var(--mg-muted)]">{icon}</span>
      </div>
      <h4 className="mt-4 text-sm font-bold text-[var(--mg-text)]">{title}</h4>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--mg-muted)]">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  )
}
