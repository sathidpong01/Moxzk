import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppSettings, FontMoodMap, TranslationMode } from '../../types'
import EmotionFontSettings from '../Editor/EmotionFontSettings'
import type { OllamaPullProgress, OllamaStatus } from '../../services/ollama'
import type { PanelCleanerStatus } from '../../services/panelcleaner-api'
import { getAppRuntime } from '../../runtime'
import type { LocalServiceName, ManagedServiceStatus, PanelCleanerDependencyStatus, RuntimeUpdateStatus } from '../../runtime'
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  FolderOpen,
  Globe,
  HardDriveDownload,
  Heart,
  Info,
  Key,
  Languages,
  Loader2,
  Lock,
  Minus,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings,
  Terminal,
  Type,
  Workflow,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, Modal, SelectField, TextareaField, TextInput } from '../ui/primitives'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { parseApiError } from '../../utils/parseApiError'
import { isLocalServiceUrl } from '../../services/localServiceAutoStart'
import OllamaInstallTutorialModal from '../Onboarding/OllamaInstallTutorialModal'
import { markOllamaTutorialSeen } from '../../services/onboardingStorage'
import { OLLAMA_DOWNLOAD_URL } from '../Onboarding/ollamaTutorial'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void | Promise<void>
  isOpen: boolean
  onClose: () => void
  onOpenFirstRunSetup: () => void
}

type SettingsTab = 'general' | 'models' | 'translation' | 'cleanup' | 'fonts' | 'about' | 'supporter'

const TABS: { id: SettingsTab; label: string; description: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'ทั่วไป', description: 'ภาษาและสถานะรวม', icon: Settings },
  { id: 'models', label: 'AI แปลภาษา', description: 'Ollama และโมเดลที่ใช้แปล', icon: Cpu },
  { id: 'translation', label: 'แปลภาษา', description: 'บริบทและโทนคำแปล', icon: Languages },
  { id: 'cleanup', label: 'ลบข้อความ', description: 'ตัวช่วยลบข้อความในภาพ', icon: Server },
  { id: 'fonts', label: 'ฟอนต์', description: 'กำหนดฟอนต์ตามอารมณ์ของตัวละคร', icon: Type },
  { id: 'supporter', label: 'Supporter', description: 'Unlimited albums & pages', icon: Heart },
  { id: 'about', label: 'เกี่ยวกับ', description: 'เวอร์ชัน สิทธิ์ใช้งาน และเครื่องมือภายนอก', icon: Info },
]

const FACEBOOK_FANPAGE_URL = 'https://www.facebook.com/moxzk'

const APP_LICENSE_NAME = 'MIT'
const MAGGA_URL = 'https://magga.vercel.app'
const OLLAMA_API_DOC_URL = 'https://docs.ollama.com/api/introduction'
const PANELCLEANER_PACKAGE_URL = 'https://pypi.org/project/pcleaner-cli/'
const OLLAMA_STATUS_TIMEOUT_MS = 8000
const OLLAMA_MODELS_TIMEOUT_MS = 15000
const PANELCLEANER_STATUS_TIMEOUT_MS = 15000
const LOCAL_SERVICE_STATUS_POLL_MS = 1000

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

function isOllamaCloudEndpoint(url: string): boolean {
  try {
    return new URL(url.trim()).hostname === 'ollama.com'
  } catch {
    return false
  }
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

function ModelPullProgress({
  model,
  percent,
  progress,
}: {
  model: string
  percent: number | null
  progress: OllamaPullProgress | null
}) {
  const statusText = progress?.status ?? 'กำลังดาวน์โหลด'
  const byteText = percent != null ? ` - ${percent}% (${formatBytes(progress?.completed)} / ${formatBytes(progress?.total)})` : ''

  return (
    <div className="settings-model-progress">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate font-bold text-[var(--moxzk-text)]">กำลังโหลด {model} เข้า Ollama</span>
        <span className="shrink-0 text-[var(--moxzk-muted)]">{percent != null ? `${percent}%` : 'เริ่มต้น'}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[var(--moxzk-accent)] transition-all"
          style={{ width: `${percent ?? 8}%` }}
        />
      </div>
      <p className="text-xs text-[var(--moxzk-muted)]">{statusText}{byteText}</p>
    </div>
  )
}

function toFriendlyServiceError(service: 'ollama' | 'panelcleaner', raw?: string): string {
  const prefix = service === 'ollama' ? 'Ollama' : 'PanelCleaner'
  const fallback = service === 'ollama' ? 'เชื่อมต่อ Ollama ไม่สำเร็จ' : 'เช็ค PanelCleaner ไม่สำเร็จ'
  return parseApiError(`${prefix} ${raw ?? fallback}`).shortMessage
}

const EMPTY_MANAGED_STATUS: Record<LocalServiceName, ManagedServiceStatus> = {
  panelcleaner: {
    running: false,
    ownedByApp: false,
    inFlightCount: 0,
    idleTimeoutMs: null,
    idleDeadlineAt: null,
    command: null,
    lastError: null,
  },
  ollama: {
    running: false,
    ownedByApp: false,
    inFlightCount: 0,
    idleTimeoutMs: null,
    idleDeadlineAt: null,
    command: null,
    lastError: null,
  },
}

function formatVisibleAppVersion(version: string | null | undefined): string | null {
  const value = version?.trim()
  if (!value || value === '...' || value === 'web') return null
  return value
}

function describeUpdateStatus(status: RuntimeUpdateStatus | null): string {
  if (!status) return 'ยังไม่ได้ตรวจ'
  if (status.state === 'checking') return 'กำลังตรวจสอบอัปเดต'
  if (status.state === 'available') return `พบเวอร์ชัน ${status.version ?? 'ใหม่'} · กำลังดาวน์โหลด`
  if (status.state === 'downloading') return `กำลังดาวน์โหลด${status.percent != null ? ` · ${status.percent}%` : ''}`
  if (status.state === 'downloaded') return `ดาวน์โหลด ${status.version ?? 'เวอร์ชันใหม่'} เสร็จแล้ว`
  if (status.state === 'not-available') return 'ใช้เวอร์ชันล่าสุดแล้ว'
  if (status.state === 'disabled') return 'อัปเดตอัตโนมัติใช้ได้เมื่อเปิดจากแอป Windows'
  if (status.state === 'error') return status.error ? `ตรวจสอบไม่ได้ · ${status.error}` : 'ตรวจสอบอัปเดตไม่ได้'
  return 'พร้อมตรวจสอบ'
}

function formatUpdateProgress(status: RuntimeUpdateStatus | null): string | null {
  if (!status || status.state !== 'downloading') return null
  const total = formatBytes(status.total)
  const transferred = formatBytes(status.transferred)
  const speed = formatBytes(status.bytesPerSecond)
  return `${transferred} / ${total}${status.bytesPerSecond ? ` · ${speed}/s` : ''}`
}

function formatRemainingTime(deadlineAt: number | null): string | null {
  if (!deadlineAt) return null
  const remainingMs = Math.max(0, deadlineAt - Date.now())
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds} วินาที`
  if (seconds === 0) return `${minutes} นาที`
  return `${minutes} นาที ${seconds} วินาที`
}

function describeManagedStatus(status: ManagedServiceStatus): string {
  if (status.inFlightCount > 0) return 'กำลังใช้งาน'
  if (status.running && status.ownedByApp) {
    const remaining = formatRemainingTime(status.idleDeadlineAt)
    return remaining ? `แอปเปิดไว้ · ปิดในอีก ${remaining}` : 'แอปเปิดไว้'
  }
  if (status.running) return 'เปิดจากภายนอก'
  return 'ยังไม่ทำงาน'
}

function describeOllamaSummary(
  status: OllamaStatus | null,
  serviceStatus: ManagedServiceStatus,
  isCloudEndpoint: boolean,
): string {
  if (status?.ok) {
    const version = status.version && status.version !== 'cloud' ? ` · ${status.version}` : ''
    return `${isCloudEndpoint ? 'Ollama Cloud' : 'Ollama'} พร้อมใช้งาน${version}`
  }

  if (serviceStatus.running) return `Ollama เปิดอยู่ · ${describeManagedStatus(serviceStatus)}`
  if (serviceStatus.command) return 'พบ Ollama ในเครื่อง · ยังไม่ได้เริ่ม'
  if (isCloudEndpoint) return 'Ollama Cloud ต้องใช้รหัส Cloud'
  return 'ยังไม่พบ Ollama ในตำแหน่งที่ใช้กันทั่วไป'
}

function describePanelCleanerDependency(status: PanelCleanerDependencyStatus | null): string {
  if (!status) return 'ยังไม่ได้ตรวจ'
  if (status.state === 'installing') return 'กำลังติดตั้ง'
  if (status.state === 'ready') {
    const source = status.source === 'managed'
      ? 'ติดตั้งโดย Moxzk'
      : status.source === 'dev'
        ? 'ชุดพัฒนา'
        : status.source === 'explicit'
          ? 'ไฟล์ที่เลือกเอง'
          : 'ตำแหน่งในระบบ'
    return `พร้อมใช้งาน · ${source}`
  }
  if (status.state === 'broken') return 'ติดตั้งไว้แต่เสีย ต้องซ่อม'
  return 'ยังไม่ได้ติดตั้ง'
}

function describePanelCleanerSummary(
  dependency: PanelCleanerDependencyStatus | null,
  bridgeStatus: PanelCleanerStatus | null,
  serviceStatus: ManagedServiceStatus,
): string {
  const serviceText = describeManagedStatus(serviceStatus)

  if (bridgeStatus?.ok) {
    return `พร้อมใช้งานจาก${panelCleanerSourceText(bridgeStatus)} · ${serviceText}`
  }

  if (dependency?.state === 'ready') {
    return `${describePanelCleanerDependency(dependency)} · ${serviceText}`
  }

  if (serviceStatus.running) {
    return `ตัวช่วยเปิดอยู่ · ${bridgeStatus ? 'ตรวจไม่ผ่าน' : 'ยังไม่ได้ตรวจชุดลบข้อความ'} · ${serviceText}`
  }

  return `${describePanelCleanerDependency(dependency)} · ${serviceText}`
}

function describePanelCleanerFailure(status: PanelCleanerStatus, serviceStatus: ManagedServiceStatus): string {
  const lower = `${status.error ?? ''} ${status.installHint ?? ''}`.toLowerCase()

  if (!serviceStatus.running && (lower.includes('fetch') || lower.includes('econnrefused') || lower.includes('5055'))) {
    return 'ตัวช่วยยังไม่เปิด · กดเริ่ม PanelCleaner ก่อน'
  }

  if (lower.includes('executable not found') || lower.includes('install panelcleaner') || lower.includes('pcleaner-cli')) {
    return 'ยังไม่พบชุด PanelCleaner ที่ใช้งานได้ · กดติดตั้ง PanelCleaner หรือเลือกไฟล์เอง'
  }

  const friendly = toFriendlyServiceError('panelcleaner', status.error)
  return status.installHint ? `${friendly} · ${status.installHint}` : friendly
}

function panelCleanerSourceText(status: PanelCleanerStatus): string {
  if (status.source === 'managed') return 'ชุดที่ Moxzk ติดตั้งให้'
  if (status.source === 'dev') return 'ชุดพัฒนาในเครื่อง'
  if (status.source === 'explicit') return 'ไฟล์ที่เลือกเอง'
  if (status.source === 'path') return 'ตำแหน่งที่ระบบรู้จัก'
  return 'ไม่ทราบแหล่งที่มา'
}

export default function SettingsPanel({
  settings,
  onSave,
  isOpen,
  onClose,
  onOpenFirstRunSetup,
}: SettingsPanelProps) {
  const appRuntime = getAppRuntime()
  const { profile, redeemSupporterKey } = useAuthStore()
  const [supporterKeyInput, setSupporterKeyInput] = useState('')
  const [redeemingKey, setRedeemingKey] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
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
  const [panelCleanerDependency, setPanelCleanerDependency] = useState<PanelCleanerDependencyStatus | null>(null)
  const [checkingPanelCleaner, setCheckingPanelCleaner] = useState(false)
  const [checkingPanelCleanerDependency, setCheckingPanelCleanerDependency] = useState(false)
  const [startingOllama, setStartingOllama] = useState(false)
  const [startingPanelCleaner, setStartingPanelCleaner] = useState(false)
  const [installingPanelCleaner, setInstallingPanelCleaner] = useState(false)
  const [panelCleanerInstallLogs, setPanelCleanerInstallLogs] = useState<string[]>([])
  const [localServiceStatus, setLocalServiceStatus] = useState<Record<LocalServiceName, ManagedServiceStatus>>(EMPTY_MANAGED_STATUS)
  const [stoppingOwnedServices, setStoppingOwnedServices] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('...')
  const [updateStatus, setUpdateStatus] = useState<RuntimeUpdateStatus | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [authCallbackUrl, setAuthCallbackUrl] = useState<string | null>(null)
  const [showOllamaTutorial, setShowOllamaTutorial] = useState(false)

  const installedModels = useMemo(() => new Set(modelNames), [modelNames])
  const selectedModelName = draft.ollamaModel.trim()
  const visibleModelNames = useMemo(() => {
    if (!selectedModelName || installedModels.has(selectedModelName)) return modelNames
    return [selectedModelName, ...modelNames]
  }, [installedModels, modelNames, selectedModelName])
  const pullPercent = getPullPercent(pullProgress)
  const selectedModelKnown = Boolean(selectedModelName) && installedModels.has(selectedModelName)
  const selectedModelHasPreset = MODEL_PRESETS.some((preset) => preset.name === selectedModelName)
  const selectedModelIsPulling = Boolean(selectedModelName) && pullingModel === selectedModelName && !selectedModelHasPreset
  const showModelNotListedHint = Boolean(selectedModelName) && modelNames.length > 0 && !selectedModelKnown && !selectedModelIsPulling
  const currentTab = TABS.find((item) => item.id === tab) ?? TABS[0]
  const visibleAppVersion = formatVisibleAppVersion(appVersion)
  const visibleUpdateCurrentVersion = formatVisibleAppVersion(updateStatus?.currentVersion) ?? visibleAppVersion
  const canStartLocalServices = appRuntime.capabilities.canStartLocalServices
  const canStartOllama = canStartLocalServices && isLocalServiceUrl(draft.ollamaUrl)
  const isOllamaCloud = isOllamaCloudEndpoint(draft.ollamaUrl)
  const ollamaReady = Boolean(ollamaStatus?.ok)
  const canStartOllamaService = canStartOllama && !ollamaReady && !localServiceStatus.ollama.running
  const canPullOllamaModel = !isOllamaCloud && Boolean(selectedModelName) && !pullingModel
  const canStartPanelCleaner = canStartLocalServices && isLocalServiceUrl(draft.panelCleanerBridgeUrl)
  const hasOwnedServices = localServiceStatus.ollama.ownedByApp || localServiceStatus.panelcleaner.ownedByApp
  const panelCleanerReady = panelCleanerStatus?.ok || panelCleanerDependency?.state === 'ready'
  const canInstallPanelCleaner = canStartPanelCleaner && !panelCleanerReady && panelCleanerDependency?.state !== 'installing'
  const canRepairPanelCleaner = canStartPanelCleaner && panelCleanerDependency?.state === 'broken'
  const canStartPanelCleanerBridge = canStartPanelCleaner && !localServiceStatus.panelcleaner.running
  const updateProgressText = formatUpdateProgress(updateStatus)

  const refreshManagedStatuses = useCallback(async () => {
    if (!canStartLocalServices) {
      setLocalServiceStatus(EMPTY_MANAGED_STATUS)
      return
    }
    try {
      setLocalServiceStatus(await appRuntime.localServices.getManagedStatus())
    } catch {
      setLocalServiceStatus(EMPTY_MANAGED_STATUS)
    }
  }, [appRuntime.localServices, canStartLocalServices])

  const refreshPanelCleanerDependency = useCallback(async () => {
    if (!canStartLocalServices) {
      setPanelCleanerDependency(null)
      return
    }
    setCheckingPanelCleanerDependency(true)
    try {
      const status = await appRuntime.localServices.getPanelCleanerDependencyStatus()
      setPanelCleanerDependency(status)
      if (status.logs?.length) setPanelCleanerInstallLogs(status.logs)
    } catch {
      setPanelCleanerDependency(null)
    } finally {
      setCheckingPanelCleanerDependency(false)
    }
  }, [appRuntime.localServices, canStartLocalServices])

  const refreshOllamaModels = useCallback(async ({ notify = false }: { notify?: boolean } = {}) => {
    setLoadingModels(true)
    try {
      const models = await appRuntime.ollama.listModels({
        ollamaUrl: draft.ollamaUrl,
        ollamaApiKey: draft.ollamaApiKey,
        timeoutMs: OLLAMA_MODELS_TIMEOUT_MS,
      })
      const names = models.map((model) => model.name || model.model || '').filter(Boolean)
      setModelNames(names)
      if (notify) toast.success(`รีเฟรชแล้ว พบ ${models.length} โมเดล`)
    } catch (err) {
      if (notify) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(`รีเฟรชรายชื่อโมเดลไม่สำเร็จ: ${toFriendlyServiceError('ollama', message)}`)
      }
    } finally {
      setLoadingModels(false)
    }
  }, [appRuntime.ollama, draft.ollamaApiKey, draft.ollamaUrl])

  useEffect(() => {
    if (isOpen) {
      const { pendingSettingsTab, clearPendingSettingsTab } = useAppStore.getState()
      if (pendingSettingsTab) {
        setTab(pendingSettingsTab as SettingsTab)
        clearPendingSettingsTab()
      }
      setDraft(settings)
      setOllamaStatus(null)
      setPanelCleanerStatus(null)
      setPullProgress(null)
      setPullError(null)
      setPullingModel(null)
      setStartingOllama(false)
      setStartingPanelCleaner(false)
      setInstallingPanelCleaner(false)
      setPanelCleanerInstallLogs([])
      setSavingSettings(false)
      setSupporterKeyInput('')
      setRedeemError(null)
      void refreshManagedStatuses()
      void refreshPanelCleanerDependency()
      void appRuntime.app.getVersion()
        .then(setAppVersion)
        .catch(() => setAppVersion(appRuntime.kind))
      void appRuntime.updates.getStatus()
        .then(setUpdateStatus)
        .catch(() => setUpdateStatus(null))
      void appRuntime.customProtocolAuth.getCallbackUrl('/auth/callback')
        .then(setAuthCallbackUrl)
        .catch(() => setAuthCallbackUrl(null))
    }
  }, [appRuntime.app, appRuntime.customProtocolAuth, appRuntime.kind, appRuntime.updates, isOpen, refreshManagedStatuses, refreshPanelCleanerDependency, settings])

  useEffect(() => {
    if (!isOpen) return
    return appRuntime.updates.onStatusChange(setUpdateStatus)
  }, [appRuntime.updates, isOpen])

  useEffect(() => {
    if (!isOpen || !canStartLocalServices) return
    const timer = window.setInterval(() => {
      void refreshManagedStatuses()
    }, LOCAL_SERVICE_STATUS_POLL_MS)
    return () => window.clearInterval(timer)
  }, [canStartLocalServices, isOpen, refreshManagedStatuses])

  useEffect(() => {
    if (!isOpen || tab !== 'models') return
    void refreshOllamaModels()
  }, [isOpen, refreshOllamaModels, tab])

  const handleSave = async () => {
    setSavingSettings(true)
    try {
      await onSave({ ...draft, theme: 'studio-dark' })
      onClose()
      toast.success('บันทึกการตั้งค่าเรียบร้อย')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingSettings(false)
    }
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
      await refreshManagedStatuses()
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

  const handleLoadModels = () => refreshOllamaModels({ notify: true })

  const handleStartOllama = async () => {
    setStartingOllama(true)
    try {
      const result = await appRuntime.localServices.startOllama()
      if (result.ok) {
        toast.success('เริ่ม Ollama แล้ว')
        await handleCheckOllama()
        await refreshManagedStatuses()
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
    const targetModel = model.trim()
    if (!targetModel) {
      toast.error('กรุณาระบุชื่อโมเดล Ollama')
      return
    }
    setPullingModel(targetModel)
    setPullProgress({ status: 'เตรียมดาวน์โหลด' })
    setPullError(null)
    try {
      const result = await appRuntime.ollama.pullModel({
        ollamaUrl: draft.ollamaUrl,
        ollamaApiKey: draft.ollamaApiKey,
        model: targetModel,
        onProgress: setPullProgress,
      })
      setPullProgress(result)
      setModelNames((current) => current.includes(targetModel) ? current : [...current, targetModel])
      toast.success(`โหลด ${targetModel} เข้า Ollama แล้ว`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setPullError(message)
      toast.error(`โหลดเข้า Ollama ไม่สำเร็จ: ${message}`)
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
    setPullError(null)
    setDraft((current) => ({ ...current, ollamaModel: model }))
    toast.success(`เลือก ${model} เป็นโมเดลใช้งานแล้ว กดบันทึกเพื่อเก็บค่า`)
  }

  const handleRedeemSupporterKey = async () => {
    const key = supporterKeyInput.trim()
    if (!key) return
    setRedeemingKey(true)
    setRedeemError(null)
    try {
      await redeemSupporterKey(key)
      toast.success('Supporter unlocked — cloud storage พร้อมใช้งานแล้ว')
      setSupporterKeyInput('')
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Invalid or already used key')
    } finally {
      setRedeemingKey(false)
    }
  }

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleOpenRuntimePath = async (
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) => {
    try {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error ?? 'เปิดโฟลเดอร์ไม่สำเร็จ')
        return
      }
      toast.success(successMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCheckPanelCleaner = async () => {
    setCheckingPanelCleaner(true)
    try {
      await refreshPanelCleanerDependency()
      const status = await appRuntime.panelCleaner.getStatus({
        bridgeUrl: draft.panelCleanerBridgeUrl,
        executablePath: draft.panelCleanerExecutablePath,
        timeoutMs: PANELCLEANER_STATUS_TIMEOUT_MS,
      })
      setPanelCleanerStatus(status)
      await refreshManagedStatuses()
      if (status.ok && status.source === 'explicit' && !draft.panelCleanerExecutablePath && status.command && /[\\/]/.test(status.command)) {
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

  const handleInstallPanelCleaner = async () => {
    setInstallingPanelCleaner(true)
    setPanelCleanerInstallLogs(['กำลังเตรียมติดตั้ง PanelCleaner ในโปรไฟล์ผู้ใช้ของ Moxzk'])
    try {
      const result = await appRuntime.localServices.installPanelCleaner()
      if (result.logs?.length) setPanelCleanerInstallLogs(result.logs)
      if (!result.ok) {
        toast.error(result.error ?? 'ติดตั้ง PanelCleaner ไม่สำเร็จ')
        await refreshPanelCleanerDependency()
        return
      }
      toast.success('ติดตั้ง PanelCleaner เสร็จแล้ว')
      await handleStartPanelCleaner()
      await refreshPanelCleanerDependency()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`ติดตั้ง PanelCleaner ไม่สำเร็จ: ${message}`)
    } finally {
      setInstallingPanelCleaner(false)
    }
  }

  const handleRepairPanelCleaner = async () => {
    setInstallingPanelCleaner(true)
    setPanelCleanerInstallLogs(['กำลังซ่อม PanelCleaner โดยติดตั้งชุดใช้งานใหม่'])
    try {
      const result = await appRuntime.localServices.repairPanelCleaner()
      if (result.logs?.length) setPanelCleanerInstallLogs(result.logs)
      if (!result.ok) {
        toast.error(result.error ?? 'ซ่อม PanelCleaner ไม่สำเร็จ')
        await refreshPanelCleanerDependency()
        return
      }
      toast.success('ซ่อม PanelCleaner เสร็จแล้ว')
      await handleStartPanelCleaner()
      await refreshPanelCleanerDependency()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`ซ่อม PanelCleaner ไม่สำเร็จ: ${message}`)
    } finally {
      setInstallingPanelCleaner(false)
    }
  }

  const handlePickPanelCleanerExecutable = async () => {
    try {
      const result = await appRuntime.localServices.pickPanelCleanerExecutable()
      if (!result.ok || !result.path) {
        if (result.error && result.error !== 'USER_CANCELLED') toast.error(result.error)
        return
      }
      setDraft((current) => ({ ...current, panelCleanerExecutablePath: result.path! }))
      toast.success('เลือกไฟล์ PanelCleaner แล้ว กดบันทึกเพื่อเก็บค่า')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleStartPanelCleaner = async () => {
    setStartingPanelCleaner(true)
    try {
      const result = await appRuntime.localServices.startPanelCleanerBridge()
      if (result.ok) {
        toast.success('เริ่มตัวลบข้อความแล้ว')
        await handleCheckPanelCleaner()
        await refreshManagedStatuses()
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

  const handleStopOwnedServices = async () => {
    setStoppingOwnedServices(true)
    try {
      const result = await appRuntime.localServices.stopOwnedServices()
      if (result.ok) {
        toast.success('หยุดโปรแกรมช่วยทำงานที่แอปเปิดไว้แล้ว')
      } else {
        toast.error(result.error ?? 'หยุดโปรแกรมช่วยทำงานไม่สำเร็จ')
      }
      await refreshManagedStatuses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setStoppingOwnedServices(false)
    }
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const status = await appRuntime.updates.checkForUpdates()
      setUpdateStatus(status)
      if (status.state === 'not-available') toast.success('ใช้เวอร์ชันล่าสุดแล้ว')
      if (status.state === 'disabled') toast.info('อัปเดตอัตโนมัติใช้ได้ในแอป Windows ที่ติดตั้งแล้ว')
      if (status.state === 'error') toast.error(status.error ?? 'ตรวจสอบอัปเดตไม่ได้')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ตรวจสอบอัปเดตไม่ได้')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleInstallUpdate = async () => {
    setInstallingUpdate(true)
    try {
      const result = await appRuntime.updates.installDownloadedUpdate()
      if (!result.ok) {
        toast.error(result.error ?? 'ติดตั้งอัปเดตไม่สำเร็จ')
        setInstallingUpdate(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ติดตั้งอัปเดตไม่สำเร็จ')
      setInstallingUpdate(false)
    }
  }

  const handleOpenReleases = async () => {
    const result = await appRuntime.updates.openReleases()
    if (!result.ok) toast.error(result.error ?? 'เปิดหน้า GitHub Releases ไม่สำเร็จ')
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="ตั้งค่า"
        className="SettingsWorkspace max-w-6xl overflow-hidden p-0"
        hideHeader
      >
      <div className="SettingsFrame flex h-[min(84vh,820px)] min-w-0">
        <aside className="SettingsSidebar flex w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--settings-divider)]">
          <div className="border-b border-[var(--settings-divider)] p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-white/10 bg-white/[0.055] text-[var(--moxzk-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Cpu size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--moxzk-dim)]">Moxzk</p>
                <p className="mt-1 truncate text-xs font-bold text-[var(--moxzk-muted)]">Local manga studio</p>
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
                aria-current={tab === id ? 'page' : undefined}
                data-autofocus={tab === id ? true : undefined}
              >
                <Icon
                  size={15}
                  className={`shrink-0 ${tab === id ? 'text-[var(--moxzk-text)]' : 'text-[var(--moxzk-dim)] group-hover:text-[var(--moxzk-muted)]'}`}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-5">{label}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="SettingsMain flex min-w-0 flex-1 flex-col">
          <header className="SettingsHeader flex shrink-0 items-center justify-between gap-4 border-b border-[var(--settings-divider)] px-7 py-5">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-[var(--moxzk-text)]">{currentTab.label}</h2>
              <p className="mt-1 text-sm text-[var(--moxzk-muted)]">{currentTab.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={13} /> ยกเลิก
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={savingSettings}>
                {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึก
              </Button>
            </div>
          </header>

          <section className="min-h-0 flex-1 overflow-y-auto px-7">
            {tab === 'general' && (
              <SettingsSheet>
                <SettingsRow
                  title="ภาษาต้นฉบับ"
                  description="ค่าเริ่มต้นสำหรับ OCR และคำแปล"
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
                <SettingsRow title="แอปนี้" description="ข้อมูลสั้น ๆ และทางลัดที่ใช้จริง">
                  <div className="space-y-4">
                    <div className="moxzk-notice">
                      <Workflow size={14} />
                      <span>{visibleAppVersion ? `เวอร์ชัน ${visibleAppVersion}` : 'Moxzk พร้อมใช้งาน'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={onOpenFirstRunSetup}
                      >
                        <Workflow size={12} /> ตัวช่วยตั้งค่าเริ่มต้น
                      </Button>
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => handleOpenRuntimePath(appRuntime.app.openSettingsFolder, 'เปิดโฟลเดอร์ตั้งค่าแล้ว')}
                      >
                        <FolderOpen size={12} /> เปิดโฟลเดอร์ตั้งค่า
                      </Button>
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => handleOpenRuntimePath(appRuntime.app.openDraftsFolder, 'เปิดโฟลเดอร์งานร่างแล้ว')}
                      >
                        <FolderOpen size={12} /> เปิดงานร่าง
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenRuntimePath(appRuntime.app.openLogs, 'เปิดบันทึกปัญหาแล้ว')}
                      >
                        <Terminal size={12} /> เปิดบันทึกปัญหา
                      </Button>
                      {(hasOwnedServices || stoppingOwnedServices) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleStopOwnedServices}
                          disabled={stoppingOwnedServices}
                        >
                          {stoppingOwnedServices ? <Loader2 size={12} className="animate-spin" /> : <Server size={12} />}
                          หยุดโปรแกรมช่วยทำงาน
                        </Button>
                      )}
                    </div>
                    <div className="moxzk-notice">
                      <Key size={14} />
                      <span>
                        {appRuntime.capabilities.canSecureStoreSecrets
                          ? 'Moxzk จะเก็บรหัส Ollama Cloud ไว้ในพื้นที่ปลอดภัยของระบบ ไม่บันทึกลงไฟล์ตั้งค่าทั่วไป'
                          : 'โหมดนี้ยังเก็บรหัสลับแบบปลอดภัยไม่ได้'}
                      </span>
                    </div>
                    {authCallbackUrl && (
                      <div className="moxzk-notice">
                        <Globe size={14} />
                        <span>เข้าสู่ระบบผ่าน {authCallbackUrl}</span>
                      </div>
                    )}
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'fonts' && (
              <SettingsSheet>
                <SettingsRow
                  title="ฟอนต์ตามอารมณ์"
                  description="กำหนดว่าอารมณ์แต่ละแบบจะใช้ฟอนต์อะไร AI จะเลือกฟอนต์นี้ให้อัตโนมัติตามอารมณ์ที่วิเคราะห์ได้ สามารถปรับเปลี่ยนเองได้ทุกเวลา"
                >
                  <EmotionFontSettings
                    fontMoodMap={draft.fontMoodMap}
                    onChange={(fontMoodMap: FontMoodMap) => setDraft({ ...draft, fontMoodMap })}
                  />
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'models' && (
              <SettingsSheet>
                <SettingsRow
                  title="Ollama"
                  description="ตั้งค่าที่อยู่และรหัส Cloud"
                >
                  <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                      <Field label="ที่อยู่บริการ" hint="ในเครื่อง: http://localhost:11434">
                        <TextInput
                          type="url"
                          placeholder="http://localhost:11434"
                          value={draft.ollamaUrl}
                          onChange={(e) => setDraft({ ...draft, ollamaUrl: e.target.value })}
                        />
                      </Field>
                      <Field label={<span className="flex items-center gap-1"><Key size={12} /> รหัส Cloud</span>} hint="ใช้เฉพาะ https://ollama.com">
                        <TextInput
                          type="password"
                          placeholder="ไม่จำเป็นถ้าใช้ในเครื่อง"
                          value={draft.ollamaApiKey}
                          onChange={(e) => setDraft({ ...draft, ollamaApiKey: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canStartOllamaService && (
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
                        รีเฟรชรายชื่อ
                      </Button>
                      <Button variant="soft" size="sm" onClick={() => setShowOllamaTutorial(true)}>
                        <BookOpen size={12} /> วิธีติดตั้ง Ollama
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenLink(OLLAMA_DOWNLOAD_URL)}>
                        <ExternalLink size={12} /> ดาวน์โหลด
                      </Button>
                    </div>
                    <div className="moxzk-notice">
                      {ollamaReady ? <CheckCircle2 size={14} className="text-[var(--moxzk-success)]" /> : <Terminal size={14} />}
                      <span>{describeOllamaSummary(ollamaStatus, localServiceStatus.ollama, isOllamaCloud)}</span>
                    </div>
                    {localServiceStatus.ollama.lastError && (
                      <div className="moxzk-notice">
                        <AlertCircle size={14} className="text-[var(--moxzk-warning)]" />
                        <span>เริ่ม Ollama ครั้งล่าสุดไม่สำเร็จ: {localServiceStatus.ollama.lastError}</span>
                      </div>
                    )}
                    {ollamaStatus && !ollamaStatus.ok && (
                      <div className="moxzk-notice">
                        <AlertCircle size={14} className="text-[var(--moxzk-warning)]" />
                        <span>
                          {ollamaStatus.url}: {toFriendlyServiceError('ollama', ollamaStatus.error)}
                        </span>
                      </div>
                    )}
                    {!localServiceStatus.ollama.command && !isOllamaCloud && (
                      <div className="moxzk-notice">
                        <AlertCircle size={14} className="text-[var(--moxzk-warning)]" />
                        <span>
                          ยังไม่พบโปรแกรม Ollama ในตำแหน่งที่ใช้กันทั่วไป
                          {' '}
                          <button className="font-bold text-[var(--moxzk-text)] underline" type="button" onClick={() => handleOpenLink(OLLAMA_DOWNLOAD_URL)}>
                            เปิดหน้าโหลด Ollama
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </SettingsRow>

                <SettingsRow title="โมเดล" description="ชื่อโมเดลที่ใช้แปล">
                  <div className="space-y-3">
                    <Field label="โมเดล Ollama" hint="Moxzk สั่ง Ollama ให้โหลด โมเดลจะอยู่ในที่เก็บของ Ollama ไม่อยู่ในโฟลเดอร์ Moxzk">
                      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <TextInput
                          type="text"
                          placeholder="gemma3:4b"
                          value={draft.ollamaModel}
                          onChange={(e) => {
                            setPullError(null)
                            setDraft({ ...draft, ollamaModel: e.target.value })
                          }}
                          list={visibleModelNames.length > 0 ? 'ollama-models' : undefined}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handlePullModel(selectedModelName)}
                          disabled={!canPullOllamaModel}
                        >
                          {pullingModel === selectedModelName ? <Loader2 size={12} className="animate-spin" /> : <HardDriveDownload size={12} />}
                          โหลดเข้า Ollama
                        </Button>
                      </div>
                      {visibleModelNames.length > 0 && (
                        <datalist id="ollama-models">
                          {visibleModelNames.map((name) => <option key={name} value={name} />)}
                        </datalist>
                      )}
                    </Field>
                    <div className="moxzk-notice">
                      <HardDriveDownload size={14} />
                      <span>{isOllamaCloud ? 'Ollama Cloud ไม่ต้องโหลดไฟล์ในเครื่อง' : 'การโหลดใช้ Ollama API เหมือนคำสั่ง ollama pull และให้ Ollama จัดการตำแหน่งไฟล์เอง'}</span>
                    </div>
                    {selectedModelIsPulling && (
                      <ModelPullProgress model={selectedModelName} percent={pullPercent} progress={pullProgress} />
                    )}
                    {showModelNotListedHint && (
                      <div className="moxzk-notice">
                        <Info size={14} />
                        <span>โมเดลนี้ยังไม่อยู่ในรายชื่อที่รีเฟรชล่าสุด ถ้าชื่อถูกต้องให้กดโหลดเข้า Ollama เพื่อดาวน์โหลดหรือให้ Ollama ลงทะเบียนโมเดลนี้</span>
                      </div>
                    )}
                    {visibleModelNames.length > 0 && (
                      <div className="grid gap-2 md:grid-cols-2">
                        {visibleModelNames.slice(0, 4).map((name) => {
                          const active = selectedModelName === name
                          const isSavedOnly = active && !selectedModelKnown
                          return (
                            <button
                              key={name}
                              type="button"
                              aria-pressed={active}
                              className={`settings-choice-row ${active ? 'settings-choice-active' : ''}`}
                              onClick={() => handleUseModel(name)}
                            >
                              <span className="min-w-0 truncate">{name}</span>
                              {isSavedOnly && <span className="settings-pill">ค่าที่บันทึกไว้</span>}
                              {active && <CheckCircle2 size={14} className="settings-choice-check" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div className="grid gap-2 lg:grid-cols-2">
                      {MODEL_PRESETS.map((preset) => {
                        const isPulling = pullingModel === preset.name
                        const isInstalled = installedModels.has(preset.name)
                        const isSelected = selectedModelName === preset.name
                        return (
                          <div key={preset.name} className={`settings-model-preset ${isSelected ? 'settings-model-preset-active' : ''}`}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-[var(--moxzk-text)]">{preset.title}</h4>
                                <span className="settings-pill">{preset.badge}</span>
                                {isInstalled && <span className="settings-pill-success">ติดตั้งแล้ว</span>}
                                {isSelected && <CheckCircle2 size={14} className="settings-choice-check" />}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-[var(--moxzk-muted)]">{preset.description}</p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handlePullModel(preset.name)}
                                disabled={Boolean(pullingModel)}
                              >
                                {isPulling ? <Loader2 size={12} className="animate-spin" /> : <HardDriveDownload size={12} />}
                                โหลดเข้า Ollama
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleCopyCommand(preset.name)}>
                                <Copy size={12} /> คัดลอกคำสั่ง
                              </Button>
                            </div>
                            {isPulling && <ModelPullProgress model={preset.name} percent={pullPercent} progress={pullProgress} />}
                          </div>
                        )
                      })}
                    </div>
                    {pullError && (
                      <div className="moxzk-notice">
                        <AlertCircle size={14} className="text-[var(--moxzk-warning)]" />
                        <span>โหลดเข้า Ollama ไม่สำเร็จ: {pullError} ถ้าชื่อโมเดลผิดให้แก้ชื่อ หรือคัดลอกคำสั่งแล้ววางใน PowerShell เพื่อตรวจจาก Ollama โดยตรง</span>
                      </div>
                    )}
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'translation' && (
              <SettingsSheet>
                <SettingsRow title="บริบทข้ามหน้า" description="ช่วยให้คำเรียกและความสัมพันธ์ต่อเนื่อง">
                  <label className="settings-toggle-row">
                    <input
                      type="checkbox"
                      checked={draft.translationContextEnabled}
                      onChange={(e) => setDraft({ ...draft, translationContextEnabled: e.target.checked })}
                    />
                    <span>
                      <span className="block font-bold text-[var(--moxzk-text)]">ใช้บริบทข้ามหน้า</span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--moxzk-muted)]">
                        ส่งบทพูดหน้าก่อนเข้า Ollama ตอนแปลหลายหน้า
                      </span>
                    </span>
                  </label>
                </SettingsRow>
                <SettingsRow title="โหมดคำแปล" description="เลือกแนวแปลหลัก">
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
                          <span className="mt-1 block text-xs font-medium leading-relaxed text-[var(--moxzk-muted)]">
                            {mode.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </SettingsRow>
                <SettingsRow title="ไกด์โทนคำแปล" description="ชื่อ ความสัมพันธ์ คำเรียก และโทนภาษาไทย">
                  <TextareaField
                    rows={9}
                    className="resize-none font-mono text-xs leading-relaxed"
                    value={draft.translationStyleGuide}
                    onChange={(e) => setDraft({ ...draft, translationStyleGuide: e.target.value })}
                  />
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'cleanup' && (
              <SettingsSheet>
                <SettingsRow title="PanelCleaner" description="ตัวช่วยลบข้อความในภาพ">
                  <div className="space-y-3">
                    <div className="moxzk-notice">
                      {panelCleanerReady ? <CheckCircle2 size={14} className="text-[var(--moxzk-success)]" /> : <Server size={14} />}
                      <span>{describePanelCleanerSummary(panelCleanerDependency, panelCleanerStatus, localServiceStatus.panelcleaner)}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="ที่อยู่บริการ" hint="ค่าเริ่มต้น: http://localhost:5055">
                        <TextInput
                          type="url"
                          placeholder="http://localhost:5055"
                          value={draft.panelCleanerBridgeUrl}
                          onChange={(e) => setDraft({ ...draft, panelCleanerBridgeUrl: e.target.value })}
                        />
                      </Field>
                      <Field label="ไฟล์ PanelCleaner" hint="เว้นว่างเพื่อให้ Moxzk จัดการ">
                        <TextInput
                          type="text"
                          placeholder="ไม่ต้องใส่ถ้าใช้ชุดที่ติดตั้งจากแอป"
                          value={draft.panelCleanerExecutablePath}
                          onChange={(e) => setDraft({ ...draft, panelCleanerExecutablePath: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canInstallPanelCleaner && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleInstallPanelCleaner}
                          disabled={installingPanelCleaner || checkingPanelCleaner}
                        >
                          {installingPanelCleaner ? <Loader2 size={12} className="animate-spin" /> : <HardDriveDownload size={12} />}
                          ติดตั้ง PanelCleaner
                        </Button>
                      )}
                      {canRepairPanelCleaner && (
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={handleRepairPanelCleaner}
                          disabled={installingPanelCleaner || checkingPanelCleaner}
                        >
                          {installingPanelCleaner ? <Loader2 size={12} className="animate-spin" /> : <Workflow size={12} />}
                          ซ่อม PanelCleaner
                        </Button>
                      )}
                      {canStartPanelCleaner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePickPanelCleanerExecutable}
                          disabled={installingPanelCleaner}
                        >
                          <HardDriveDownload size={12} />
                          เลือกไฟล์เอง
                        </Button>
                      )}
                      {canStartPanelCleanerBridge && (
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={handleStartPanelCleaner}
                          disabled={startingPanelCleaner || checkingPanelCleaner || installingPanelCleaner}
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
                    {checkingPanelCleanerDependency && (
                      <div className="moxzk-notice">
                        <Loader2 size={14} className="animate-spin" />
                        <span>กำลังตรวจ PanelCleaner</span>
                      </div>
                    )}
                    {panelCleanerStatus && (
                      <div className="moxzk-notice">
                        {panelCleanerStatus.ok ? <CheckCircle2 size={14} className="text-[var(--moxzk-success)]" /> : <AlertCircle size={14} className="text-[var(--moxzk-warning)]" />}
                        <span>
                          {panelCleanerStatus.ok
                            ? `PanelCleaner พร้อมใช้งานจาก ${panelCleanerSourceText(panelCleanerStatus)}${panelCleanerStatus.version ? ` (${panelCleanerStatus.version})` : ''}${panelCleanerStatus.command ? ` - ${panelCleanerStatus.command}` : ''}`
                            : describePanelCleanerFailure(panelCleanerStatus, localServiceStatus.panelcleaner)}
                        </span>
                      </div>
                    )}
                    {panelCleanerInstallLogs.length > 0 && (
                      <div className="rounded-[8px] border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--moxzk-muted)]">
                          <Terminal size={13} />
                          รายละเอียดการติดตั้ง
                        </div>
                        <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--moxzk-muted)]">{panelCleanerInstallLogs.slice(-12).join('\n')}</pre>
                      </div>
                    )}
                    <div className="moxzk-notice">
                      <ExternalLink size={14} />
                      <span>
                        {panelCleanerDependency?.packageName ?? 'pcleaner-cli'} {panelCleanerDependency?.packageVersion ?? '2.11.9'} · {panelCleanerDependency?.licenseName ?? 'GPLv3'}
                        {' '}
                        <button className="font-bold text-[var(--moxzk-text)] underline" type="button" onClick={() => handleOpenLink(panelCleanerDependency?.projectUrl ?? PANELCLEANER_PACKAGE_URL)}>
                          รายละเอียด
                        </button>
                      </span>
                    </div>
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

            {tab === 'supporter' && (
              <SettingsSheet>
                <SettingsRow
                  title="Free vs Supporter"
                  description="เปรียบเทียบสิทธิ์การใช้งาน"
                >
                  <div className="w-full overflow-hidden rounded-[10px] border border-white/10">
                    <div className="grid grid-cols-3 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em]">
                      <div className="text-[var(--moxzk-dim)]">ฟีเจอร์</div>
                      <div className="text-center text-[var(--moxzk-dim)]">Free</div>
                      <div className="text-center text-[var(--moxzk-supporter)]">Supporter</div>
                    </div>
                    {([
                      { label: 'Albums', free: '1', pro: 'Unlimited' },
                      { label: 'Pages / album', free: '50', pro: 'Unlimited' },
                      { label: 'Cloud backup', free: true, pro: true },
                      { label: 'OCR + แปลด้วย AI', free: true, pro: true },
                      { label: 'Local Ollama', free: true, pro: true },
                      { label: 'PanelCleaner', free: true, pro: true },
                      { label: 'Export PNG / PDF', free: true, pro: true },
                      { label: 'Story context', free: true, pro: true },
                      { label: 'อัปเดตตลอดชีพ', free: false, pro: true },
                    ] as const).map(({ label, free, pro }, i) => (
                      <div
                        key={label}
                        className={`grid grid-cols-3 items-center px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.018]'}`}
                      >
                        <span className="text-[var(--moxzk-text)]">{label}</span>
                        <div className="flex justify-center">
                          {typeof free === 'string' ? (
                            <span className="text-xs text-[var(--moxzk-muted)]">{free}</span>
                          ) : free ? (
                            <Check size={13} className="text-[var(--moxzk-success)]" />
                          ) : (
                            <Minus size={13} className="text-[var(--moxzk-dim)]" />
                          )}
                        </div>
                        <div className="flex justify-center">
                          {typeof pro === 'string' ? (
                            <span className="text-xs font-semibold text-[var(--moxzk-accent)]">{pro}</span>
                          ) : pro ? (
                            <Check size={13} className="text-[var(--moxzk-success)]" />
                          ) : (
                            <Minus size={13} className="text-[var(--moxzk-dim)]" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsRow>

                <SettingsRow
                  title="สถานะ"
                  description="Unlimited albums & pages สำหรับ Supporter"
                >
                  {!profile ? (
                    <div className="moxzk-notice">
                      <Info size={14} />
                      <span>ต้อง login ก่อนเพื่อดูสถานะ Supporter</span>
                    </div>
                  ) : profile.supporter_unlocked ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--moxzk-supporter-subtle)] text-[var(--moxzk-supporter)]">
                          <Heart size={16} className="fill-[var(--moxzk-supporter)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--moxzk-text)]">Supporter</p>
                          <p className="mt-0.5 text-xs text-[var(--moxzk-muted)]">Unlimited albums & pages ปลดล็อกแล้ว</p>
                        </div>
                        <CheckCircle2 size={16} className="ml-auto shrink-0 text-[var(--moxzk-success)]" />
                      </div>
                      <div className="moxzk-notice">
                        <Info size={14} />
                        <span>ขอบคุณที่ support Moxzk สิทธิ์นี้ผูกกับบัญชีของคุณถาวร</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-white/10 bg-white/[0.025] px-4 py-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--moxzk-dim)]">
                          <Lock size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--moxzk-text)]">ยังไม่ได้เป็น Supporter</p>
                          <p className="mt-0.5 text-xs text-[var(--moxzk-muted)]">Free: 1 album, 50 pages/album</p>
                        </div>
                      </div>
                      <div className="space-y-2 rounded-[10px] border border-white/8 bg-white/[0.02] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--moxzk-dim)]">วิธี Support</p>
                        <p className="text-sm leading-6 text-[var(--moxzk-muted)]">
                          Moxzk เป็น indie tool — ไม่มีรายเดือน ไม่มี subscription
                          Support ครั้งเดียวเพื่อปลดล็อก unlimited albums & pages ถาวร
                        </p>
                        <Button variant="soft" size="sm" onClick={() => handleOpenLink(FACEBOOK_FANPAGE_URL)}>
                          <ExternalLink size={12} /> ส่งข้อความผ่าน Facebook
                        </Button>
                      </div>
                    </div>
                  )}
                </SettingsRow>

                {profile && !profile.supporter_unlocked && (
                  <SettingsRow
                    title="Redeem Key"
                    description="กรอก key ที่ได้รับเพื่อปลดล็อก"
                  >
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <TextInput
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={supporterKeyInput}
                          onChange={(e) => {
                            setSupporterKeyInput(e.target.value)
                            setRedeemError(null)
                          }}
                          className="font-mono text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && supporterKeyInput.trim()) void handleRedeemSupporterKey()
                          }}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleRedeemSupporterKey}
                          disabled={!supporterKeyInput.trim() || redeemingKey}
                        >
                          {redeemingKey ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                          Unlock
                        </Button>
                      </div>
                      {redeemError && (
                        <div className="moxzk-notice">
                          <AlertCircle size={14} className="text-[var(--moxzk-warning)]" />
                          <span>{redeemError}</span>
                        </div>
                      )}
                    </div>
                  </SettingsRow>
                )}
              </SettingsSheet>
            )}

            {tab === 'about' && (
              <SettingsSheet>
                <SettingsRow title="Moxzk" description="ข้อมูลแอปและสิทธิ์ใช้งาน">
                  <div className="settings-about-summary">
                    <div className="settings-about-meta">
                      {visibleAppVersion && <span>เวอร์ชัน {visibleAppVersion}</span>}
                      <span>ใช้สิทธิ์ {APP_LICENSE_NAME}</span>
                    </div>
                    <p>
                      Moxzk เปิดให้ใช้และปรับแก้ตัวโปรแกรมได้ภายใต้ MIT แต่สิทธิ์นี้ไม่รวมชื่อ โลโก้ ไฟล์ของผู้ใช้
                      งานมังงะ งานแปล หรือข้อมูลจาก Magga
                    </p>
                    <Button variant="soft" size="sm" onClick={() => handleOpenLink(MAGGA_URL)}>
                      <ExternalLink size={12} /> เปิด Magga
                    </Button>
                  </div>
                </SettingsRow>

                <SettingsRow title="อัปเดตโปรแกรม" description="ดาวน์โหลดเบื้องหลัง แล้วรีสตาร์ทเมื่องานพร้อม">
                  <div className="settings-update-panel">
                    <div className="settings-update-status">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--moxzk-text)]">{describeUpdateStatus(updateStatus)}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--moxzk-muted)]">
                            {visibleUpdateCurrentVersion
                              ? `เวอร์ชันปัจจุบัน ${visibleUpdateCurrentVersion}`
                              : 'ตรวจอัปเดตได้เมื่อเปิดจากแอป Windows ที่ติดตั้งแล้ว'}
                            {updateStatus?.version && updateStatus.version !== visibleUpdateCurrentVersion ? ` · รุ่นใหม่ ${updateStatus.version}` : ''}
                          </p>
                        </div>
                        {updateStatus?.state === 'downloaded' ? (
                          <CheckCircle2 size={18} className="shrink-0 text-[var(--moxzk-success)]" />
                        ) : updateStatus?.state === 'error' ? (
                          <AlertCircle size={18} className="shrink-0 text-[var(--moxzk-warning)]" />
                        ) : (
                          <RefreshCw size={18} className={`shrink-0 text-[var(--moxzk-dim)] ${updateStatus?.state === 'checking' || updateStatus?.state === 'downloading' ? 'animate-spin' : ''}`} />
                        )}
                      </div>
                      {updateStatus?.state === 'downloading' && (
                        <>
                          <div className="settings-update-progress" aria-label="กำลังดาวน์โหลดอัปเดต">
                            <span style={{ width: `${updateStatus.percent ?? 8}%` }} />
                          </div>
                          {updateProgressText && <p className="text-xs text-[var(--moxzk-muted)]">{updateProgressText}</p>}
                        </>
                      )}
                      {updateStatus?.state === 'disabled' && (
                        <p className="text-xs leading-5 text-[var(--moxzk-dim)]">
                          ถ้าใช้งานผ่านเว็บ ให้ดาวน์โหลดเวอร์ชันล่าสุดจาก GitHub Releases
                        </p>
                      )}
                      {updateStatus?.state === 'downloaded' && (
                        <p className="text-xs leading-5 text-[var(--moxzk-muted)]">
                          บันทึกงานให้เรียบร้อยก่อนรีสตาร์ท เพื่อให้ editor กลับมาเปิดงานเดิมได้ตามปกติ
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={handleCheckUpdate}
                        disabled={checkingUpdate || updateStatus?.state === 'checking' || updateStatus?.state === 'downloading'}
                      >
                        {checkingUpdate || updateStatus?.state === 'checking' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        ตรวจอัปเดต
                      </Button>
                      {updateStatus?.state === 'downloaded' && (
                        <Button variant="primary" size="sm" onClick={handleInstallUpdate} disabled={installingUpdate}>
                          {installingUpdate ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          รีสตาร์ทเพื่อติดตั้ง
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={handleOpenReleases}>
                        <ExternalLink size={12} /> เปิด GitHub Releases
                      </Button>
                    </div>
                    <div className="moxzk-notice">
                      <Info size={14} />
                      <span>
                        Windows อาจเตือน SmartScreen เพราะ Moxzk เป็นโปรแกรม indie ที่ยังไม่ได้ยืนยันตัวตนแบบบริษัท ดูรหัสตรวจสอบไฟล์ใน release note ได้เสมอ
                      </span>
                    </div>
                  </div>
                </SettingsRow>

                <SettingsRow title="สิ่งที่ใช้ร่วมกัน" description="แต่ละส่วนมีเงื่อนไขของเจ้าของเดิม">
                  <div className="space-y-3">
                    <ul className="settings-about-list">
                      <li>
                        <Server size={14} />
                        <span>ตัวช่วยลบข้อความใช้ PanelCleaner แยกจากตัวโปรแกรมหลัก</span>
                      </li>
                      <li>
                        <Cpu size={14} />
                        <span>Ollama, Ollama Cloud และโมเดลที่เลือกใช้ มีเงื่อนไขจากผู้ให้บริการนั้นเอง</span>
                      </li>
                      <li>
                        <Info size={14} />
                        <span>รูปภาพ อัลบั้ม งานร่าง ไฟล์ที่นำเข้า และไฟล์ที่ export ยังเป็นของคุณตามสิทธิ์เดิม</span>
                      </li>
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenLink(panelCleanerDependency?.projectUrl ?? PANELCLEANER_PACKAGE_URL)}>
                        <ExternalLink size={12} /> รายละเอียด PanelCleaner
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenLink(OLLAMA_API_DOC_URL)}>
                        <ExternalLink size={12} /> รายละเอียด Ollama
                      </Button>
                    </div>
                  </div>
                </SettingsRow>
              </SettingsSheet>
            )}

          </section>
        </main>
      </div>
      </Modal>
      <OllamaInstallTutorialModal
        isOpen={showOllamaTutorial}
        onClose={() => setShowOllamaTutorial(false)}
        onComplete={() => {
          markOllamaTutorialSeen()
          setShowOllamaTutorial(false)
        }}
        onCheckStatus={handleCheckOllama}
        onStartOllama={canStartOllamaService ? handleStartOllama : undefined}
        onPullRecommendedModel={handlePullModel}
        onSaveSettings={handleSave}
      />
    </>
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
