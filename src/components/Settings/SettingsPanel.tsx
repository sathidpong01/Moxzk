import { useEffect, useState } from 'react'
import type { AppSettings } from '../../types'
import type { OllamaStatus } from '../../services/ollama'
import { getPanelCleanerStatus } from '../../services/panelcleaner-api'
import { webRuntime } from '../../runtime/webRuntime'
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Globe,
  Key,
  Loader2,
  Palette,
  Save,
  Server,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, Modal, SelectField, TextareaField, TextInput } from '../ui/primitives'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'general' | 'cleanup' | 'ai' | 'appearance'

const TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'ทั่วไป', icon: Settings },
  { id: 'cleanup', label: 'คลีนภาพ', icon: Server },
  { id: 'ai', label: 'Ollama', icon: Cpu },
  { id: 'appearance', label: 'หน้าตา', icon: Palette },
]

export default function SettingsPanel({
  settings,
  onSave,
  isOpen,
  onClose,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [tab, setTab] = useState<SettingsTab>('general')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [checkingOllama, setCheckingOllama] = useState(false)
  const [modelNames, setModelNames] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [panelCleanerStatus, setPanelCleanerStatus] = useState<{ ok: boolean; version?: string; command?: string; error?: string; installHint?: string } | null>(null)
  const [checkingPanelCleaner, setCheckingPanelCleaner] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setDraft(settings)
      setOllamaStatus(null)
      setPanelCleanerStatus(null)
    }
  }, [isOpen, settings])

  const handleSave = () => {
    onSave({ ...draft, theme: 'studio-dark' })
    onClose()
    toast.success('บันทึกการตั้งค่าเรียบร้อย')
  }

  const handleCheckOllama = async () => {
    setCheckingOllama(true)
    const status = await webRuntime.ollama.getServerStatus({
      ollamaUrl: draft.ollamaUrl,
      ollamaApiKey: draft.ollamaApiKey,
    })
    setOllamaStatus(status)
    setCheckingOllama(false)
    if (status.ok) {
      toast.success(status.version === 'cloud' ? 'Ollama Cloud พร้อมใช้งาน' : `Ollama ${status.version ?? ''} พร้อมใช้งาน`)
    } else {
      toast.error('เชื่อมต่อ Ollama ไม่สำเร็จ')
    }
  }

  const handleLoadModels = async () => {
    setLoadingModels(true)
    try {
      const models = await webRuntime.ollama.listModels({
        ollamaUrl: draft.ollamaUrl,
        ollamaApiKey: draft.ollamaApiKey,
      })
      setModelNames(models.map((model) => model.name || model.model || '').filter(Boolean))
      toast.success(`พบ ${models.length} โมเดล`)
    } catch (err) {
      toast.error('โหลดรายการโมเดลไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoadingModels(false)
    }
  }

  const handleCheckPanelCleaner = async () => {
    setCheckingPanelCleaner(true)
    const status = await getPanelCleanerStatus({
      bridgeUrl: draft.panelCleanerBridgeUrl,
      executablePath: draft.panelCleanerExecutablePath,
    })
    setPanelCleanerStatus(status)
    if (status.ok && !draft.panelCleanerExecutablePath && status.command && /[\\/]/.test(status.command)) {
      setDraft((current) => ({ ...current, panelCleanerExecutablePath: status.command! }))
    }
    setCheckingPanelCleaner(false)
    if (status.ok) {
      toast.success(`PanelCleaner พร้อมใช้งาน${status.version ? ` (${status.version})` : ''}`)
    } else {
      toast.error('เช็ค PanelCleaner ไม่สำเร็จ')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ตั้งค่า" className="max-w-3xl p-0">
      <div className="flex h-[70vh] max-h-[620px] min-h-0">
        <aside className="w-44 shrink-0 border-r border-[var(--mg-border)] p-3">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-sm font-bold ${
                  tab === id ? 'bg-white/10 text-[var(--mg-text)]' : 'text-[var(--mg-muted)] hover:bg-white/5'
                }`}
                onClick={() => setTab(id)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>
          <Button variant="primary" size="sm" className="mt-4 w-full" onClick={handleSave}>
            <Save size={12} /> บันทึก
          </Button>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto p-5">
          {tab === 'general' && (
            <div className="space-y-5">
              <h4 className="text-lg font-bold">ทั่วไป</h4>
              <Field label="ภาษาต้นฉบับ">
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
              </Field>
            </div>
          )}

          {tab === 'cleanup' && (
            <div className="space-y-5">
              <h4 className="text-lg font-bold">ระบบคลีนภาพ</h4>
              <div className="mg-notice">
                <Server size={14} />
                <span>Web phase ต้องใช้ local bridge เพราะ browser เรียก Python/CLI โดยตรงไม่ได้ ให้รัน npm run backend:panelcleaner ก่อนเริ่มประมวลผล</span>
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
              <Button variant="soft" size="sm" onClick={handleCheckPanelCleaner} disabled={checkingPanelCleaner}>
                {checkingPanelCleaner ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                ตรวจ PanelCleaner
              </Button>
              {panelCleanerStatus && (
                <div className="mg-notice">
                  {panelCleanerStatus.ok ? <CheckCircle2 size={14} className="text-[var(--mg-success)]" /> : <AlertCircle size={14} className="text-[var(--mg-warning)]" />}
                  <span>
                    {panelCleanerStatus.ok
                      ? `PanelCleaner พร้อมใช้งาน${panelCleanerStatus.version ? ` (${panelCleanerStatus.version})` : ''}${panelCleanerStatus.command ? ` - ${panelCleanerStatus.command}` : ''}`
                      : `${panelCleanerStatus.error ?? 'เช็ค PanelCleaner ไม่สำเร็จ'}${panelCleanerStatus.installHint ? ` - ${panelCleanerStatus.installHint}` : ''}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-5">
              <h4 className="text-lg font-bold">Ollama แปลภาษา</h4>
              <div className="mg-notice">
                <Globe size={14} />
                <span>Phase นี้เป็น web app จึงตรวจ path ของ ollama.exe หรือสั่ง start service โดยตรงไม่ได้ ให้เปิด Ollama app หรือรัน ollama serve ก่อนใช้งาน local endpoint</span>
              </div>
              <Field label="Ollama Endpoint" hint="Local: http://localhost:11434, Cloud: https://ollama.com">
                <TextInput
                  type="url"
                  placeholder="http://localhost:11434"
                  value={draft.ollamaUrl}
                  onChange={(e) => setDraft({ ...draft, ollamaUrl: e.target.value })}
                />
              </Field>
              <Field label="โมเดล Ollama" hint="เช่น gemma4:31b-cloud, qwen3-vl:235b-instruct-cloud หรือโมเดล vision ที่คุณติดตั้งเอง">
                <TextInput
                  type="text"
                  placeholder="gemma4:31b-cloud"
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
              <Field label={<span className="flex items-center gap-1"><Key size={12} /> Ollama Cloud API Key</span>}>
                <TextInput
                  type="password"
                  placeholder="ใส่เฉพาะเมื่อใช้ https://ollama.com"
                  value={draft.ollamaApiKey}
                  onChange={(e) => setDraft({ ...draft, ollamaApiKey: e.target.value })}
                />
              </Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-[var(--mg-border)] bg-white/[0.03] p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.translationContextEnabled}
                  onChange={(e) => setDraft({ ...draft, translationContextEnabled: e.target.checked })}
                />
                <span>
                  <span className="block font-bold text-[var(--mg-text)]">ใช้บริบทข้ามหน้า</span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--mg-muted)]">
                    ส่งบทพูดหน้าก่อน ๆ เข้า Ollama ตอนแปลหลายหน้า เพื่อรักษาคำเรียก ความสัมพันธ์ และสำนวนให้ต่อเนื่อง
                  </span>
                </span>
              </label>
              <Field label="ไกด์โทนคำแปล" hint="ใช้กำกับทั้งอัลบั้ม เช่น ชื่อตัวละคร ความสัมพันธ์ คำเรียกแทนตัว และโทนภาษา">
                <TextareaField
                  rows={6}
                  className="resize-none font-mono text-xs"
                  value={draft.translationStyleGuide}
                  onChange={(e) => setDraft({ ...draft, translationStyleGuide: e.target.value })}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
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
                      : `${ollamaStatus.url}: ${ollamaStatus.error ?? 'เชื่อมต่อไม่ได้'}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold">หน้าตา</h4>
              <div className="rounded-[8px] border border-[var(--mg-border)] bg-white/[0.03] p-4">
                <p className="font-bold">Studio Dark</p>
                <p className="mt-1 text-sm text-[var(--mg-muted)]">ธีมภายในใหม่ที่แทน daisyUI themes ทั้งหมดใน phase นี้</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
