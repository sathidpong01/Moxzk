import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  LogIn,
  Search,
  Settings,
  Terminal,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppSettings, TranslationMode } from '../../types'
import type { PanelCleanerStatus } from '../../services/panelcleaner-api'
import type { OllamaPullProgress, OllamaStatus } from '../../services/ollama'
import type { PanelCleanerDependencyStatus } from '../../runtime'
import { getAppRuntime } from '../../runtime'
import type { OnboardingSetupItem } from '../../services/onboardingStorage'

import { OLLAMA_DOWNLOAD_URL, OLLAMA_RECOMMENDED_MODEL } from './ollamaTutorial'
import { recommendOllamaModel } from '../../services/modelRecommendation'

const PYTHON_DOWNLOAD_URL = 'https://www.python.org/downloads/windows/'
// Ghost Polling: silently re-check service/model status so the user never has
// to press a manual "check" button during onboarding.
const SETUP_STATUS_POLL_MS = 3000
const BASE = import.meta.env.BASE_URL
const SETUP_ICON_SRC = {
  intro: `${BASE}setup-icons/moxzk.svg`,
  python: `${BASE}setup-icons/python.svg`,
  panelcleaner: `${BASE}setup-icons/panelcleaner.svg`,
  ollama: `${BASE}setup-icons/ollama.svg`,
  model: `${BASE}setup-icons/model.svg`,
  translation: `${BASE}setup-icons/translation.svg`,
  account: `${BASE}setup-icons/account-albums.svg`,
  workspace: `${BASE}setup-icons/workspace.svg`,
} as const

const SETUP_MODEL_OPTIONS = [
  {
    name: 'gemma3:4b',
    title: 'Gemma 3 4B',
    badge: 'แนะนำเริ่มต้น',
    description: 'ขนาดเริ่มต้นที่สมดุล เหมาะกับเครื่องทั่วไป และเป็นค่าแนะนำของ Moxzk',
  },
  {
    name: 'gemma3:12b',
    title: 'Gemma 3 12B',
    badge: 'แม่นขึ้น',
    description: 'เหมาะกับเครื่องแรงหน่วยความจำเยอะ เมื่อต้องการอ่านภาพและภาษาให้ละเอียดขึ้น',
  },
  {
    name: 'llama3.2-vision:11b',
    title: 'Llama 3.2 Vision 11B',
    badge: 'ทางเลือก vision',
    description: 'ทางเลือกสำหรับงานอ่านภาพโดยตรง ใช้ทรัพยากรมากกว่าโมเดลเริ่มต้น',
  },
]

const SETUP_MODEL_AUTOCOMPLETE_NAMES = [
  'qwen3.5:cloud',
  'qwen3.6',
  'qwen',
  'gemma4:31b-cloud',
  'gemma3:4b',
  'gemma3:12b',
  'llama3.2-vision:11b',
]

const SOURCE_LANGUAGE_OPTIONS: Array<{ value: AppSettings['sourceLang']; label: string; description: string }> = [
  { value: 'auto', label: 'ตรวจอัตโนมัติ', description: 'เหมาะกับงานที่มีหลายภาษา หรือยังไม่แน่ใจต้นฉบับ' },
  { value: 'ja', label: 'ญี่ปุ่น', description: 'เหมาะกับมังงะภาษาญี่ปุ่น' },
  { value: 'zh', label: 'จีน', description: 'เหมาะกับแมนฮวาหรือภาพภาษาจีน' },
  { value: 'en', label: 'อังกฤษ', description: 'เหมาะกับคอมิกหรือสแกนภาษาอังกฤษ' },
]

const TRANSLATION_MODE_OPTIONS: Array<{ value: TranslationMode; label: string; description: string }> = [
  {
    value: 'concise',
    label: 'สั้นเข้าใจได้',
    description: 'กระชับให้พอดีกับบับเบิล แต่ยังเก็บสาระสำคัญและน้ำเสียง',
  },
  {
    value: 'faithful',
    label: 'ตรงตามต้นฉบับ',
    description: 'รักษารายละเอียดและลำดับความคิดใกล้ต้นฉบับมากขึ้น',
  },
]

interface FirstRunSetupViewProps {
  isOpen: boolean
  settings: AppSettings
  currentSetupStep: OnboardingSetupItem
  completedSetupItems: OnboardingSetupItem[]
  skippedSetupItems: OnboardingSetupItem[]
  isAccountReady: boolean
  onOpenTutorial: () => void
  onOpenSettings: () => void
  onOpenAuth: () => void
  onUpdateSettings: (settings: AppSettings) => void | Promise<void>
  onCompleteSetupItem: (item: OnboardingSetupItem) => void
  onSkipSetupItem: (item: OnboardingSetupItem) => void
  onCurrentStepChange: (item: OnboardingSetupItem) => void
  onStart: (suppressReminder: boolean) => void
}

interface SetupAction {
  label: string
  icon: ReactNode
  onClick: () => void
  kind?: 'primary' | 'check' | 'secondary'
  disabled?: boolean
}

interface SetupStep {
  id: OnboardingSetupItem
  title: string
  description: string
  required: boolean
  ready: boolean
  statusText: string
  iconSrc: string
  iconAlt: string
  actions: SetupAction[]
}

function getPullPercent(progress: OllamaPullProgress | null): number | null {
  if (!progress?.total || !progress.completed) return null
  return Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 100)))
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

function resolveSetupModelName(model: string): string {
  const trimmed = model.trim()
  return trimmed || OLLAMA_RECOMMENDED_MODEL
}

function normalizeModelName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function uniqueModelNames(names: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const name of names) {
    const trimmed = name.trim()
    const key = normalizeModelName(trimmed)
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    unique.push(trimmed)
  }
  return unique
}

function getModelSearchSuggestions(query: string, candidates: string[]): string[] {
  const normalizedQuery = normalizeModelName(query)
  const ranked = candidates
    .map((name, index) => ({ name, index, normalized: normalizeModelName(name) }))
    .filter((candidate) => (
      normalizedQuery
        ? candidate.normalized.startsWith(normalizedQuery) || candidate.normalized.includes(normalizedQuery)
        : candidate.normalized
    ))
    .sort((a, b) => {
      if (!normalizedQuery) return a.index - b.index
      const aStarts = a.normalized.startsWith(normalizedQuery)
      const bStarts = b.normalized.startsWith(normalizedQuery)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return a.index - b.index
    })

  return ranked.slice(0, 6).map((candidate) => candidate.name)
}

function isCloudModelName(name: string): boolean {
  return /cloud/i.test(name)
}

export default function FirstRunSetupView({
  isOpen,
  settings,
  currentSetupStep,
  completedSetupItems,
  skippedSetupItems,
  isAccountReady,
  onOpenTutorial,
  onOpenSettings,
  onOpenAuth,
  onUpdateSettings,
  onCompleteSetupItem,
  onSkipSetupItem,
  onCurrentStepChange,
  onStart,
}: FirstRunSetupViewProps) {
  const appRuntime = getAppRuntime()
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const stepTitleRef = useRef<HTMLHeadingElement>(null)
  const [panelCleanerDependency, setPanelCleanerDependency] = useState<PanelCleanerDependencyStatus | null>(null)
  const [panelCleanerStatus, setPanelCleanerStatus] = useState<PanelCleanerStatus | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [modelPullProgress, setModelPullProgress] = useState<OllamaPullProgress | null>(null)
  const [modelNames, setModelNames] = useState<string[]>([])
  const [modelSearchInput, setModelSearchInput] = useState(() => resolveSetupModelName(settings.ollamaModel))
  const [debouncedModelSearch, setDebouncedModelSearch] = useState(() => resolveSetupModelName(settings.ollamaModel))
  const [modelSearchPending, setModelSearchPending] = useState(false)
  const [modelSearchFocused, setModelSearchFocused] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [ollamaInstallLogs, setOllamaInstallLogs] = useState<string[]>([])
  const [showIntro, setShowIntro] = useState(true)
  const completed = useMemo(() => new Set(completedSetupItems), [completedSetupItems])
  const skipped = useMemo(() => new Set(skippedSetupItems), [skippedSetupItems])
  const completedRef = useRef(completed)
  completedRef.current = completed
  const busyActionRef = useRef(busyAction)
  busyActionRef.current = busyAction
  const selectedModelName = resolveSetupModelName(modelSearchInput)
  const modelRecommendation = useMemo(() => recommendOllamaModel(), [])
  const modelSearchCandidates = useMemo(() => uniqueModelNames([
    ...SETUP_MODEL_OPTIONS.map((option) => option.name),
    ...SETUP_MODEL_AUTOCOMPLETE_NAMES,
    ...modelNames,
  ]), [modelNames])
  const exactModelMatch = modelSearchCandidates.some((name) => normalizeModelName(name) === normalizeModelName(debouncedModelSearch))
  const modelSearchSuggestions = useMemo(
    () => getModelSearchSuggestions(modelSearchInput, modelSearchCandidates),
    [modelSearchCandidates, modelSearchInput],
  )
  const showModelSearchSuggestions = modelSearchFocused && modelSearchSuggestions.length > 0 && busyAction !== 'model-pull'

  const refreshPanelCleanerDependency = useCallback(async () => {
    setBusyAction('python-check')
    try {
      const status = await appRuntime.localServices.getPanelCleanerDependencyStatus()
      setPanelCleanerDependency(status)
      if (status.python.state === 'ready' && !completed.has('python')) onCompleteSetupItem('python')
      if (status.state === 'ready' && !completed.has('panelcleaner')) onCompleteSetupItem('panelcleaner')
    } catch {
      setPanelCleanerDependency(null)
    } finally {
      setBusyAction((current) => current === 'python-check' ? null : current)
    }
  }, [appRuntime.localServices, completed, onCompleteSetupItem])

  const installPython = useCallback(async () => {
    setBusyAction('python-install')
    try {
      await appRuntime.localServices.installPython()
      await refreshPanelCleanerDependency()
    } finally {
      setBusyAction((current) => current === 'python-install' ? null : current)
    }
  }, [appRuntime.localServices, refreshPanelCleanerDependency])

  const checkPanelCleaner = useCallback(async () => {
    setBusyAction('panelcleaner-check')
    try {
      const status = await appRuntime.panelCleaner.getStatus({
        bridgeUrl: settings.panelCleanerBridgeUrl,
        executablePath: settings.panelCleanerExecutablePath,
        timeoutMs: 15000,
      })
      setPanelCleanerStatus(status)
      if (status.ok && !completed.has('panelcleaner')) onCompleteSetupItem('panelcleaner')
    } catch {
      setPanelCleanerStatus(null)
    } finally {
      setBusyAction((current) => current === 'panelcleaner-check' ? null : current)
    }
  }, [appRuntime.panelCleaner, completed, onCompleteSetupItem, settings.panelCleanerBridgeUrl, settings.panelCleanerExecutablePath])

  const installPanelCleaner = useCallback(async (repair = false) => {
    setBusyAction('panelcleaner-install')
    try {
      const result = repair
        ? await appRuntime.localServices.repairPanelCleaner()
        : await appRuntime.localServices.installPanelCleaner()
      if (result.ok) {
        await refreshPanelCleanerDependency()
        await checkPanelCleaner()
      }
    } finally {
      setBusyAction((current) => current === 'panelcleaner-install' ? null : current)
    }
  }, [appRuntime.localServices, checkPanelCleaner, refreshPanelCleanerDependency])

  const startPanelCleaner = useCallback(async () => {
    setBusyAction('panelcleaner-start')
    try {
      await appRuntime.localServices.startPanelCleanerBridge()
      await checkPanelCleaner()
    } finally {
      setBusyAction((current) => current === 'panelcleaner-start' ? null : current)
    }
  }, [appRuntime.localServices, checkPanelCleaner])

  const checkOllama = useCallback(async () => {
    setBusyAction('ollama-check')
    try {
      const status = await appRuntime.ollama.getServerStatus({
        ollamaUrl: settings.ollamaUrl,
        ollamaApiKey: settings.ollamaApiKey,
        timeoutMs: 8000,
      })
      setOllamaStatus(status)
      if (status.ok && !completed.has('ollama')) onCompleteSetupItem('ollama')
    } catch {
      setOllamaStatus(null)
    } finally {
      setBusyAction((current) => current === 'ollama-check' ? null : current)
    }
  }, [appRuntime.ollama, completed, onCompleteSetupItem, settings.ollamaApiKey, settings.ollamaUrl])

  const startOllama = useCallback(async () => {
    setBusyAction('ollama-start')
    try {
      await appRuntime.localServices.startOllama()
      await checkOllama()
    } finally {
      setBusyAction((current) => current === 'ollama-start' ? null : current)
    }
  }, [appRuntime.localServices, checkOllama])

  const installOllama = useCallback(async () => {
    setBusyAction('ollama-install')
    try {
      const result = await appRuntime.localServices.installOllama()
      if (!result.ok) return
      await startOllama()
      await checkOllama()
    } finally {
      setBusyAction((current) => current === 'ollama-install' ? null : current)
    }
  }, [appRuntime.localServices, checkOllama, startOllama])

  const pullModel = useCallback(async () => {
    setBusyAction('model-pull')
    setModelPullProgress({ status: 'กำลังเริ่มดาวน์โหลด' })
    try {
      const modelName = selectedModelName
      const s = settingsRef.current
      if (s.ollamaModel !== modelName) {
        await onUpdateSettings({ ...s, ollamaModel: modelName })
      }
      await appRuntime.ollama.pullModel({
        ollamaUrl: s.ollamaUrl,
        ollamaApiKey: s.ollamaApiKey,
        model: modelName,
        onProgress: setModelPullProgress,
      })
      setModelReady(true)
      if (!completed.has('model')) onCompleteSetupItem('model')
    } finally {
      setBusyAction((current) => current === 'model-pull' ? null : current)
    }
  }, [appRuntime.ollama, completed, onCompleteSetupItem, onUpdateSettings, selectedModelName])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    void onUpdateSettings({ ...settingsRef.current, ...patch })
  }, [onUpdateSettings])

  const chooseModel = useCallback((model: string) => {
    setModelSearchInput(model)
    setDebouncedModelSearch(model)
    setModelSearchFocused(false)
    setModelReady(false)
    setModelPullProgress(null)
    updateSettings({ ollamaModel: model })
  }, [updateSettings])

  const updateModelSearchInput = useCallback((model: string) => {
    setModelSearchInput(model)
    setModelReady(false)
    setModelPullProgress(null)
  }, [])

  const saveTranslationSetup = useCallback(() => {
    if (!completed.has('translation')) onCompleteSetupItem('translation')
  }, [completed, onCompleteSetupItem])

  useEffect(() => {
    if (!isOpen) return
    setShowIntro(true)
  }, [isOpen])

  // Ghost Polling: auto-detect service/model status in the background while the
  // setup view is open, so the user never has to press a manual check button.
  // Skips items already marked done and pauses while an install/start runs.
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const pollOnce = async () => {
      if (cancelled || busyActionRef.current) return
      const rt = getAppRuntime()
      const s = settingsRef.current
      const done = completedRef.current

      if (!done.has('python') || !done.has('panelcleaner')) {
        try {
          const status = await rt.localServices.getPanelCleanerDependencyStatus()
          if (cancelled) return
          setPanelCleanerDependency(status)
          if (status.python.state === 'ready' && !done.has('python')) onCompleteSetupItem('python')
          if (status.state === 'ready' && !done.has('panelcleaner')) onCompleteSetupItem('panelcleaner')
        } catch { /* keep last known value */ }
      }
      if (!cancelled && !completedRef.current.has('panelcleaner')) {
        try {
          const status = await rt.panelCleaner.getStatus({
            bridgeUrl: s.panelCleanerBridgeUrl,
            executablePath: s.panelCleanerExecutablePath,
            timeoutMs: 8000,
          })
          if (cancelled) return
          setPanelCleanerStatus(status)
          if (status.ok && !completedRef.current.has('panelcleaner')) onCompleteSetupItem('panelcleaner')
        } catch { /* keep last known value */ }
      }
      if (!cancelled && !completedRef.current.has('ollama')) {
        try {
          const status = await rt.ollama.getServerStatus({
            ollamaUrl: s.ollamaUrl,
            ollamaApiKey: s.ollamaApiKey,
            timeoutMs: 8000,
          })
          if (cancelled) return
          setOllamaStatus(status)
          if (status.ok && !completedRef.current.has('ollama')) onCompleteSetupItem('ollama')
        } catch { /* keep last known value */ }
      }
      if (!cancelled && !completedRef.current.has('model')) {
        try {
          const models = await rt.ollama.listModels({
            ollamaUrl: s.ollamaUrl,
            ollamaApiKey: s.ollamaApiKey,
            timeoutMs: 12000,
          })
          if (cancelled) return
          setModelNames(uniqueModelNames(models.map((model) => model.name || model.model || '').filter(Boolean)))
          const target = resolveSetupModelName(settingsRef.current.ollamaModel)
          const found = models.some((model) => normalizeModelName(model.name || model.model || '') === normalizeModelName(target))
          setModelReady(found)
          if (found && !completedRef.current.has('model')) onCompleteSetupItem('model')
        } catch { /* keep last known value */ }
      }
    }

    void pollOnce()
    const timer = window.setInterval(() => void pollOnce(), SETUP_STATUS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isOpen, onCompleteSetupItem])

  useEffect(() => {
    if (busyAction !== 'panelcleaner-install') return
    const timer = window.setInterval(async () => {
      try {
        const status = await appRuntime.localServices.getPanelCleanerDependencyStatus()
        setPanelCleanerDependency(status)
      } catch {
        // ignore poll errors
      }
    }, 1500)
    return () => window.clearInterval(timer)
  }, [busyAction, appRuntime.localServices])

  // Surface live winget progress while Ollama installs, so the spinner is
  // backed by a moving status line instead of looking frozen.
  useEffect(() => {
    if (busyAction !== 'ollama-install') {
      setOllamaInstallLogs([])
      return
    }
    const timer = window.setInterval(async () => {
      try {
        const status = await appRuntime.localServices.getOllamaInstallStatus()
        setOllamaInstallLogs(status.logs)
      } catch {
        // ignore poll errors
      }
    }, 1200)
    return () => window.clearInterval(timer)
  }, [busyAction, appRuntime.localServices])

  useEffect(() => {
    const nextModel = resolveSetupModelName(settings.ollamaModel)
    setModelSearchInput((current) => current.trim() === nextModel ? current : nextModel)
    setDebouncedModelSearch((current) => current.trim() === nextModel ? current : nextModel)
  }, [settings.ollamaModel])

  useEffect(() => {
    if (!isOpen) return
    setModelSearchPending(true)
    const timer = window.setTimeout(() => {
      const nextModel = resolveSetupModelName(modelSearchInput)
      setDebouncedModelSearch(nextModel)
      setModelSearchPending(false)
      if (nextModel !== settingsRef.current.ollamaModel) {
        void onUpdateSettings({ ...settingsRef.current, ollamaModel: nextModel })
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [isOpen, modelSearchInput, onUpdateSettings])

  useEffect(() => {
    if (settings.sourceLang && settings.translationMode && !completed.has('translation')) onCompleteSetupItem('translation')
  }, [completed, onCompleteSetupItem, settings.sourceLang, settings.translationMode])

  useEffect(() => {
    if (!isOpen || showIntro) return
    stepTitleRef.current?.focus()
  }, [currentSetupStep, isOpen, showIntro])

  const pythonReady = panelCleanerDependency !== null
    ? panelCleanerDependency.python.state === 'ready'
    : completed.has('python')
  const panelCleanerReady = panelCleanerDependency !== null
    ? panelCleanerDependency.state === 'ready' || panelCleanerStatus?.ok === true
    : completed.has('panelcleaner') || panelCleanerStatus?.ok === true
  const ollamaReady = completed.has('ollama') || ollamaStatus?.ok === true
  const translationReady = completed.has('translation') || Boolean(settings.sourceLang && settings.translationMode)
  const accountReady = completed.has('account') || isAccountReady
  const workspaceReady = completed.has('workspace')

  const setupSteps: SetupStep[] = [
    {
      id: 'python',
      title: 'โปรแกรม Python',
      description: 'ใช้สำหรับติดตั้งและรันตัวช่วยลบข้อความในเครื่อง',
      required: true,
      ready: pythonReady,
      statusText: pythonReady
        ? panelCleanerDependency?.python.version || 'พบ Python แล้ว'
        : 'ยังไม่พบ Python ที่ใช้งานได้',
      iconSrc: SETUP_ICON_SRC.python,
      iconAlt: 'Python',
      actions: [
        {
          label: 'ติดตั้ง Python',
          icon: busyAction === 'python-install' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />,
          onClick: installPython,
          kind: 'primary',
          disabled: busyAction !== null || !appRuntime.capabilities.canStartLocalServices,
        },
        {
          label: 'เปิดหน้าโหลด Python',
          icon: <ExternalLink size={13} />,
          onClick: () => window.open(PYTHON_DOWNLOAD_URL, '_blank', 'noopener,noreferrer'),
          kind: 'secondary',
        },
      ],
    },
    {
      id: 'panelcleaner',
      title: 'ตัวช่วยลบข้อความ',
      description: 'ติดตั้ง PanelCleaner เพื่อให้ Moxzk ลบข้อความเดิมออกจากภาพก่อนแปล',
      required: true,
      ready: panelCleanerReady,
      statusText: panelCleanerReady ? 'ตัวช่วยลบข้อความพร้อมใช้งาน' : 'ยังไม่ได้ติดตั้งหรือตรวจไม่ผ่าน',
      iconSrc: SETUP_ICON_SRC.panelcleaner,
      iconAlt: 'PanelCleaner',
      actions: [
        {
          label: panelCleanerDependency?.state === 'broken' ? 'ซ่อม PanelCleaner' : 'ติดตั้ง PanelCleaner',
          icon: busyAction === 'panelcleaner-install' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />,
          onClick: () => installPanelCleaner(panelCleanerDependency?.state === 'broken'),
          kind: 'primary',
          disabled: busyAction !== null || !pythonReady,
        },
        {
          label: 'เริ่มตัวช่วยลบข้อความ',
          icon: <Terminal size={13} />,
          onClick: startPanelCleaner,
          kind: 'secondary',
          disabled: busyAction !== null,
        },
      ],
    },
    {
      id: 'ollama',
      title: 'โปรแกรม Ollama',
      description: 'ติดตั้งและเปิด Ollama เพื่อให้ AI อ่านและแปลข้อความจากภาพ',
      required: true,
      ready: ollamaReady,
      statusText: ollamaReady ? 'Ollama พร้อมใช้งาน' : 'ยังเชื่อมต่อ Ollama ไม่ได้',
      iconSrc: SETUP_ICON_SRC.ollama,
      iconAlt: 'Ollama',
      actions: [
        {
          label: 'ติดตั้ง Ollama',
          icon: busyAction === 'ollama-install' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />,
          onClick: installOllama,
          kind: 'primary',
          disabled: busyAction !== null || !appRuntime.capabilities.canStartLocalServices,
        },
        { label: 'ดูวิธีติดตั้ง', icon: <BookOpen size={13} />, onClick: onOpenTutorial, kind: 'secondary' },
        { label: 'เริ่ม Ollama', icon: <Terminal size={13} />, onClick: startOllama, kind: 'secondary', disabled: busyAction !== null },
        { label: 'เปิดหน้าโหลด Ollama', icon: <ExternalLink size={13} />, onClick: () => window.open(OLLAMA_DOWNLOAD_URL, '_blank', 'noopener,noreferrer'), kind: 'secondary' },
      ],
    },
    {
      id: 'model',
      title: 'เลือกและโหลดโมเดลแปลภาพ',
      description: 'ชื่อโมเดลอิงจากคลังโมเดลของ Ollama เลือกตัวที่เหมาะกับเครื่องคุณก่อนโหลดเข้า Ollama',
      required: true,
      ready: completed.has('model') || modelReady,
      statusText: completed.has('model') || modelReady ? 'โมเดลพร้อมใช้งาน' : 'ยังไม่พบโมเดลใน Ollama',
      iconSrc: SETUP_ICON_SRC.model,
      iconAlt: 'โมเดลแปลภาพ',
      actions: [
        {
          label: 'โหลดเข้า Ollama',
          icon: busyAction === 'model-pull' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />,
          onClick: pullModel,
          kind: 'primary',
          disabled: busyAction !== null || !ollamaReady,
        },
      ],
    },
    {
      id: 'translation',
      title: 'ภาษาและโหมดแปล',
      description: 'เลือกภาษาต้นฉบับและแนวคำแปลเริ่มต้นได้จากหน้านี้เลย',
      required: true,
      ready: translationReady,
      statusText: translationReady ? 'ตั้งค่าไว้แล้ว' : 'ยังไม่ได้ตั้งค่าภาษาและโหมดแปล',
      iconSrc: SETUP_ICON_SRC.translation,
      iconAlt: 'ภาษาและโหมดแปล',
      actions: [
        { label: 'ใช้ตัวเลือกนี้', icon: <CheckCircle2 size={13} />, onClick: saveTranslationSetup, kind: 'primary' },
      ],
    },
    {
      id: 'account',
      title: 'บัญชีสำหรับเก็บงานขึ้นคลาวด์ (ข้ามได้)',
      description: 'ใช้ Moxzk แปลและ export ได้เลยโดยไม่ต้องสมัคร สมัครเมื่ออยากเก็บอัลบั้มและงานที่แก้ไว้ขึ้นคลาวด์ เปิดต่อข้ามเครื่องได้',
      required: false,
      ready: accountReady,
      statusText: accountReady ? 'เข้าสู่ระบบแล้ว' : 'ยังไม่ได้เข้าสู่ระบบ',
      iconSrc: SETUP_ICON_SRC.account,
      iconAlt: 'บัญชีและอัลบั้ม',
      actions: [
        { label: 'สมัครสมาชิก / เข้าสู่ระบบ', icon: <LogIn size={13} />, onClick: onOpenAuth, kind: 'primary' },
      ],
    },
    {
      id: 'workspace',
      title: 'งานร่างและไฟล์ในเครื่อง',
      description: 'งานร่างและตั้งค่าเก็บในเครื่องคุณ เปิดดูโฟลเดอร์ได้เลย หรือข้ามไปก่อนก็ได้',
      required: false,
      ready: workspaceReady,
      statusText: workspaceReady ? 'รับทราบแล้ว' : 'ดูได้ภายหลัง',
      iconSrc: SETUP_ICON_SRC.workspace,
      iconAlt: 'งานร่างและไฟล์ในเครื่อง',
      actions: [
        { label: 'รับทราบ', icon: <CheckCircle2 size={13} />, onClick: () => onCompleteSetupItem('workspace'), kind: 'primary' },
        { label: 'เปิด Settings', icon: <Settings size={13} />, onClick: onOpenSettings, kind: 'secondary' },
      ],
    },
  ]

  const currentStepIndex = Math.max(0, setupSteps.findIndex((step) => step.id === currentSetupStep))
  const activeStep = setupSteps[currentStepIndex] ?? setupSteps[0]
  const isLastStep = currentStepIndex === setupSteps.length - 1
  const activeSkipped = skipped.has(activeStep.id)
  const activeStatus = activeStep.ready ? 'ready' : activeSkipped ? 'skipped' : 'missing'
  const canGoNext = !activeStep.required || activeStep.ready || activeSkipped
  const skippedRequired = setupSteps.filter((step) => step.required && skipped.has(step.id))
  const totalPages = setupSteps.length + 1
  const visiblePageNumber = showIntro ? 1 : currentStepIndex + 2

  const goToStep = (index: number) => {
    const nextStep = setupSteps[Math.max(0, Math.min(index, setupSteps.length - 1))]
    onCurrentStepChange(nextStep.id)
  }

  const goNext = () => {
    if (!canGoNext) return
    if (isLastStep) {
      onStart(skippedRequired.length > 0)
      return
    }
    goToStep(currentStepIndex + 1)
  }

  const skipStep = () => {
    onSkipSetupItem(activeStep.id)
    if (!isLastStep) goToStep(currentStepIndex + 1)
  }

  const skipAllSetup = () => {
    onStart(true)
  }

  const primaryAction = activeStep.actions.find((action) => action.kind === 'primary') ?? activeStep.actions[0]
  const utilityActions = activeStep.actions.filter((action) => action !== primaryAction)
  const showPrimaryAction = Boolean(primaryAction && activeStatus !== 'ready')
  const modelPullPercent = getPullPercent(modelPullProgress)
  const modelSearchHelpText = modelSearchPending
    ? 'กำลังค้นหา...'
    : exactModelMatch
      ? 'พบชื่อโมเดลนี้แล้ว พร้อมตรวจหรือโหลดต่อ'
      : debouncedModelSearch
        ? 'เลือกจากรายการ หรือโหลดต่อได้ถ้าชื่อนี้ถูกต้อง'
        : 'พิมพ์ชื่อโมเดลที่ต้องการใช้'

  const getUtilityActionClassName = (action: SetupAction) => {
    if (action.kind === 'check') return `FirstRunSetupUtilityAction FirstRunSetupUtilityCheck FirstRunSetupUtilityCheck-${activeStatus}`
    return 'FirstRunSetupUtilityAction'
  }

  const renderStepExtras = () => {
    if (activeStep.id === 'panelcleaner' && busyAction === 'panelcleaner-install') {
      const installLogs = panelCleanerDependency?.logs
      return installLogs && installLogs.length > 0 ? (
        <div className="FirstRunSetupStepExtras FirstRunSetupInstallLog" aria-live="polite" aria-label="ล็อกการติดตั้ง">
          {installLogs.slice(-8).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : (
        <div className="FirstRunSetupStepExtras FirstRunSetupInstallLog">
          <p>กำลังติดตั้ง PanelCleaner…</p>
        </div>
      )
    }

    if (activeStep.id === 'ollama' && busyAction === 'ollama-install') {
      return ollamaInstallLogs.length > 0 ? (
        <div className="FirstRunSetupStepExtras FirstRunSetupInstallLog" aria-live="polite" aria-label="ความคืบหน้าการติดตั้ง Ollama">
          {ollamaInstallLogs.slice(-8).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : (
        <div className="FirstRunSetupStepExtras FirstRunSetupInstallLog">
          <p>กำลังเตรียมติดตั้ง Ollama…</p>
        </div>
      )
    }

    if (activeStep.id === 'model') {
      return (
        <div className="FirstRunSetupStepExtras FirstRunSetupModelExtras">
          {(() => {
            const recommended = SETUP_MODEL_OPTIONS.find((option) => option.name === modelRecommendation.model)
            const isPicked = selectedModelName === modelRecommendation.model
            return (
              <div className="FirstRunSetupModelRecommended">
                <div className="FirstRunSetupModelRecommendedInfo">
                  <span className="FirstRunSetupModelRecommendedTag">แนะนำสำหรับเครื่องนี้</span>
                  <strong>{recommended?.title ?? modelRecommendation.model}</strong>
                  <small>{recommended?.name ?? modelRecommendation.model}</small>
                  <p>{modelRecommendation.reason}</p>
                </div>
                <button
                  type="button"
                  className="FirstRunSetupModelRecommendedAction"
                  onClick={() => chooseModel(modelRecommendation.model)}
                  disabled={busyAction !== null || isPicked}
                >
                  {isPicked ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
                  {isPicked ? 'เลือกไว้แล้ว' : 'ใช้โมเดลนี้'}
                </button>
              </div>
            )
          })()}
          <label className="FirstRunSetupModelSearch">
            <span>Search หรือใส่ชื่อโมเดลเอง</span>
            <div className="FirstRunSetupModelSearchBox">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                role="combobox"
                aria-expanded={showModelSearchSuggestions}
                aria-haspopup="listbox"
                aria-controls="model-search-suggestions"
                aria-autocomplete="list"
                value={modelSearchInput}
                onChange={(event) => updateModelSearchInput(event.currentTarget.value)}
                onFocus={() => setModelSearchFocused(true)}
                onBlur={() => setModelSearchFocused(false)}
                placeholder="เช่น gemma3:4b หรือ llama3.2-vision:11b"
                spellCheck={false}
                autoComplete="off"
                disabled={busyAction === 'model-pull'}
              />
              {modelSearchPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {showModelSearchSuggestions && (
                <div id="model-search-suggestions" className="FirstRunSetupModelSuggestions" role="listbox" aria-label="รายชื่อโมเดลที่แนะนำ">
                  {modelSearchSuggestions.map((name) => {
                    const cloud = isCloudModelName(name)
                    const isSelected = modelSearchInput.trim() !== '' && normalizeModelName(selectedModelName) === normalizeModelName(name)
                    return (
                      <div
                        key={name}
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseModel(name)}
                      >
                        <span>{name}</span>
                        {cloud ? <Cloud size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <small className={exactModelMatch ? 'FirstRunSetupModelSearchReady' : ''}>
              {modelSearchHelpText}
            </small>
          </label>
          <div className="FirstRunSetupModelChoices" role="radiogroup" aria-label="เลือกโมเดล Ollama">
            {SETUP_MODEL_OPTIONS.map((option) => {
              const active = modelSearchInput.trim() !== '' && selectedModelName === option.name
              return (
                <button
                  key={option.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`FirstRunSetupModelChoice ${active ? 'FirstRunSetupModelChoiceActive' : ''}`}
                  onClick={() => chooseModel(option.name)}
                  disabled={busyAction !== null}
                >
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.name}</small>
                  </span>
                  <span className="FirstRunSetupModelBadge">{option.badge}</span>
                  <p>{option.description}</p>
                </button>
              )
            })}
          </div>
          {(busyAction === 'model-pull' || modelPullProgress) && (
            <div className="FirstRunSetupModelProgress">
              <div className="FirstRunSetupModelProgressHeader">
                <strong>กำลังโหลด {selectedModelName}</strong>
                <span>{modelPullPercent != null ? `${modelPullPercent}%` : 'กำลังเริ่ม'}</span>
              </div>
              <div className="FirstRunSetupModelProgressTrack" aria-hidden="true">
                <span style={{ width: '100%', transform: `scaleX(${(modelPullPercent ?? 8) / 100})` }} />
              </div>
              <p>
                {modelPullProgress?.status ?? 'กำลังดาวน์โหลด'}
                {modelPullPercent != null
                  ? ` - ${formatBytes(modelPullProgress?.completed)} / ${formatBytes(modelPullProgress?.total)}`
                  : ''}
              </p>
            </div>
          )}
        </div>
      )
    }

    if (activeStep.id === 'translation') {
      return (
        <div className="FirstRunSetupStepExtras FirstRunSetupTranslationExtras">
          <div className="FirstRunSetupChoiceGroup">
            <h3>ภาษาต้นฉบับ</h3>
            <div className="FirstRunSetupChoiceGrid">
              {SOURCE_LANGUAGE_OPTIONS.map((option) => {
                const active = settings.sourceLang === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`FirstRunSetupChoiceTile ${active ? 'FirstRunSetupChoiceTileActive' : ''}`}
                    onClick={() => updateSettings({ sourceLang: option.value })}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="FirstRunSetupChoiceGroup">
            <h3>โหมดคำแปล</h3>
            <div className="FirstRunSetupChoiceGrid FirstRunSetupChoiceGridTwo">
              {TRANSLATION_MODE_OPTIONS.map((option) => {
                const active = settings.translationMode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`FirstRunSetupChoiceTile ${active ? 'FirstRunSetupChoiceTileActive' : ''}`}
                    onClick={() => updateSettings({ translationMode: option.value })}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    if (activeStep.id === 'workspace') {
      const canStartLocalServices = appRuntime.capabilities.canStartLocalServices
      return (
        <div className="FirstRunSetupStepExtras FirstRunSetupWorkspaceExtras">
          {canStartLocalServices ? (
            <div className="FirstRunSetupWorkspaceFolders">
              <button type="button" onClick={() => { void appRuntime.app.openDraftsFolder(); if (!completed.has('workspace')) onCompleteSetupItem('workspace') }}>
                <FolderOpen size={16} aria-hidden="true" />
                <span>
                  <strong>โฟลเดอร์งานร่าง</strong>
                  <small>draft ที่บันทึกไว้ระหว่างแปล</small>
                </span>
              </button>
              <button type="button" onClick={() => { void appRuntime.app.openSettingsFolder(); if (!completed.has('workspace')) onCompleteSetupItem('workspace') }}>
                <FolderOpen size={16} aria-hidden="true" />
                <span>
                  <strong>โฟลเดอร์ตั้งค่า</strong>
                  <small>ไฟล์ config ของ Moxzk</small>
                </span>
              </button>
              <button type="button" onClick={() => { void appRuntime.app.openLogs(); if (!completed.has('workspace')) onCompleteSetupItem('workspace') }}>
                <FolderOpen size={16} aria-hidden="true" />
                <span>
                  <strong>โฟลเดอร์ log</strong>
                  <small>ไฟล์ log สำหรับ debug</small>
                </span>
              </button>
            </div>
          ) : (
            <p className="FirstRunSetupWorkspaceWebNote">
              บน web งานร่างเก็บใน browser (IndexedDB) ตั้งค่าเก็บใน localStorage
            </p>
          )}
        </div>
      )
    }

    if (activeStep.id === 'account') {
      return (
        <div className="FirstRunSetupAccountPreview" aria-hidden="true">
          <div className="FirstRunSetupAlbumCard FirstRunSetupAlbumCardOne">
            <span>อัลบั้มแปล</span>
            <strong>ตอนที่ 01</strong>
            <small>12 หน้า</small>
          </div>
          <div className="FirstRunSetupAlbumCard FirstRunSetupAlbumCardTwo">
            <span>รูปต้นฉบับ</span>
            <strong>page-08.webp</strong>
            <small>พร้อมแก้ต่อ</small>
          </div>
          <div className="FirstRunSetupAlbumCard FirstRunSetupAlbumCardThree">
            <span>งานที่บันทึกไว้</span>
            <strong>คำแปล + ตำแหน่งข้อความ</strong>
            <small>เปิดต่อภายหลังได้</small>
          </div>
        </div>
      )
    }

    return null
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[var(--moxzk-bg)] overflow-hidden pb-10 pt-[4.5rem]">
      <div className="FirstRunSetupShell">
        <div className="FirstRunSetupBrand">Moxzk setup</div>
        <div className="FirstRunSetupPageCount">{visiblePageNumber} / {totalPages}</div>
        {!showIntro && (
          <button type="button" className="FirstRunSetupTopSkip" aria-label={`ข้าม ${activeStep.title}`} onClick={skipStep}>
            Skip
          </button>
        )}

        <main className="FirstRunSetupMain" aria-live="polite">
          {showIntro ? (
            <section key="intro" className="FirstRunSetupFocusedPage">
              <img className="FirstRunSetupIcon" src={SETUP_ICON_SRC.intro} alt="Moxzk setup" />
              <div>
                <h2>ตั้งค่า Moxzk ให้พร้อมใช้งาน</h2>
                <p>
                  Moxzk ต้องใช้โปรแกรมเสริมบางอย่างในเครื่องเพื่อคลีนข้อความ แปลภาพ และจัดการงานของคุณให้ครบ<br/>
                  <span className="opacity-70">(ใช้เวลาตั้งค่าประมาณ 5–15 นาที สามารถ Skip ขั้นตอนเพื่อกลับมาทำทีหลังได้)</span>
                </p>
              </div>
              <div className="FirstRunSetupStatusLine FirstRunSetupStatusIntro">
                <span aria-hidden="true" />
                <strong>สิ่งที่ต้องติดตั้ง: Python, ตัวช่วยลบข้อความ, Ollama และโมเดลแปลภาพ</strong>
              </div>
              <div className="FirstRunSetupIntroActions">
                <button type="button" className="FirstRunSetupAction FirstRunSetupActionPrimary" onClick={() => setShowIntro(false)}>
                  เริ่มตั้งค่า
                </button>
                <button type="button" className="FirstRunSetupIntroSkip" onClick={skipAllSetup}>
                  Skip
                </button>
              </div>
            </section>
          ) : (
            <section key={currentSetupStep} className={`FirstRunSetupFocusedPage FirstRunSetupStepPage FirstRunSetupStepPage-${activeStep.id}`}>
              <img className="FirstRunSetupIcon" src={activeStep.iconSrc} alt={activeStep.iconAlt} />
              <div>
                <h2 ref={stepTitleRef} tabIndex={-1}>{activeStep.title}</h2>
                <p>{activeStep.description}</p>
              </div>
              <div className={`FirstRunSetupStatusLine FirstRunSetupStatus-${activeStatus}`}>
                <span aria-hidden="true" />
                <strong>
                  {activeStatus === 'ready'
                    ? 'ตรวจผ่านแล้ว พร้อมไปต่อ'
                    : activeStatus === 'skipped'
                      ? 'Skipped แล้ว กลับมาแก้ได้ภายหลัง'
                  : activeStep.statusText}
                </strong>
              </div>
              {renderStepExtras()}
              <div className="FirstRunSetupActionList">
                {activeStatus === 'ready' && (
                  <div className="FirstRunSetupReadyPanel" role="status">
                    <CheckCircle2 size={18} />
                    <span>
                      <strong>พร้อมใช้งานแล้ว</strong>
                      <small>{activeStep.statusText}</small>
                    </span>
                  </div>
                )}
                {showPrimaryAction && primaryAction && (
                  <button
                    type="button"
                    className="FirstRunSetupAction FirstRunSetupActionPrimary FirstRunSetupHeroAction"
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled}
                  >
                    {primaryAction.icon} {primaryAction.label}
                  </button>
                )}
                {utilityActions.length > 0 && (
                  <div className="FirstRunSetupUtilityActions">
                    {utilityActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className={getUtilityActionClassName(action)}
                        onClick={action.onClick}
                        disabled={action.disabled}
                      >
                        {action.icon} {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {skippedRequired.length > 0 && isLastStep && (
                <div className="FirstRunSetupSkippedSummary">
                  มีขั้นตอนสำคัญที่ถูกข้าม: {skippedRequired.map((step) => step.title).join(', ')}
                </div>
              )}
            </section>
          )}
        </main>

        {!showIntro && (
          <footer className="FirstRunSetupFooter">
            <div className="FirstRunSetupProgress" aria-label={`ขั้นตอน ${currentStepIndex + 2} จาก ${totalPages}`}>
              {Array.from({ length: totalPages }, (_, index) => (
                <span key={index} className={index <= currentStepIndex + 1 ? 'FirstRunSetupProgressDone' : ''} />
              ))}
            </div>
            <div className="FirstRunSetupNavActions">
              <button
                type="button"
                className="FirstRunSetupBackAction"
                onClick={() => currentStepIndex === 0 ? setShowIntro(true) : goToStep(currentStepIndex - 1)}
              >
                <ChevronLeft size={14} /> ย้อนกลับ
              </button>
              <button
                type="button"
                className="FirstRunSetupAction FirstRunSetupActionPrimary FirstRunSetupNextAction"
                onClick={goNext}
                disabled={!canGoNext}
              >
                {isLastStep ? 'เริ่มใช้งาน' : 'ถัดไป'} <ChevronRight size={14} />
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
