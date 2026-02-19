import { useEffect, useState } from 'react'
import type { AppSettings, GeminiModelId, TranslationEngine } from '../../types'
import { GEMINI_MODELS } from '../../services/geminiQuota'
import { Settings, X, Save, Key, Server, Globe, Palette, Cpu, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'general' | 'appearance' | 'api' | 'ai'

const TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'ai', label: 'AI / Translation', icon: Sparkles },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'api', label: 'API Keys', icon: Key },
]

const TIER_BADGE: Record<string, string> = {
  budget: 'badge-success',
  balanced: 'badge-info',
  premium: 'badge-warning',
}

const DAISY_THEMES = [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
  'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
  'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
  'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn',
  'business', 'acid', 'lemonade', 'night', 'coffee', 'winter',
  'dim', 'nord', 'sunset',
]

function ThemePreview({ theme, isActive, onClick }: { theme: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      data-theme={theme}
      className={`rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
        isActive ? 'border-primary ring-2 ring-primary/40 scale-105' : 'border-base-300/50'
      }`}
      onClick={onClick}
      title={theme}
    >
      <div className="bg-base-100 p-2 w-full">
        <div className="flex gap-1 mb-1.5">
          <div className="rounded-full w-2 h-2 bg-primary" />
          <div className="rounded-full w-2 h-2 bg-secondary" />
          <div className="rounded-full w-2 h-2 bg-accent" />
          <div className="rounded-full w-2 h-2 bg-neutral" />
        </div>
        <div className="space-y-1">
          <div className="rounded bg-base-content/20 h-1.5 w-full" />
          <div className="rounded bg-base-content/10 h-1.5 w-3/4" />
        </div>
        <div className="flex gap-1 mt-1.5">
          <div className="rounded bg-primary px-1.5 py-0.5">
            <span className="text-primary-content text-[7px] font-bold">Btn</span>
          </div>
          <div className="rounded bg-secondary px-1.5 py-0.5">
            <span className="text-secondary-content text-[7px] font-bold">Btn</span>
          </div>
        </div>
      </div>
      <div className="bg-base-200 px-2 py-1">
        <span className="text-[9px] font-medium text-base-content capitalize">{theme}</span>
      </div>
    </button>
  )
}

export default function SettingsPanel({
  settings,
  onSave,
  isOpen,
  onClose,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [tab, setTab] = useState<SettingsTab>('general')

  // Sync draft when settings change externally
  useEffect(() => {
    if (isOpen) setDraft(settings)
  }, [isOpen, settings])

  // Live theme preview
  useEffect(() => {
    if (isOpen) document.documentElement.setAttribute('data-theme', draft.theme)
    return () => { document.documentElement.setAttribute('data-theme', settings.theme) }
  }, [draft.theme, isOpen, settings.theme])

  const handleSave = () => {
    document.documentElement.setAttribute('data-theme', draft.theme)
    onSave(draft)
    onClose()
    toast.success('บันทึกการตั้งค่าเรียบร้อย')
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl p-0 flex h-[70vh] max-h-[600px]">
        {/* Side menu */}
        <div className="w-44 shrink-0 bg-base-200 border-r border-base-300 flex flex-col">
          <h3 className="text-sm font-bold px-4 pt-4 pb-2 flex items-center gap-2">
            <Settings size={16} /> Settings
          </h3>
          <ul className="menu menu-sm flex-1 px-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a
                  className={tab === id ? 'active' : ''}
                  onClick={() => setTab(id)}
                >
                  <Icon size={14} /> {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="p-3 border-t border-base-300 flex flex-col gap-1">
            <button className="btn btn-primary btn-sm w-full gap-1" onClick={handleSave}>
              <Save size={12} /> Save
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 relative">
          <button
            className="btn btn-ghost btn-xs btn-square absolute top-3 right-3"
            onClick={onClose}
          >
            <X size={14} />
          </button>

          {/* General tab */}
          {tab === 'general' && (
            <div className="space-y-5">
              <h4 className="text-lg font-bold">General</h4>
              <div className="form-control">
                <label className="label"><span className="label-text">Source Language</span></label>
                <select
                  className="select select-bordered w-full"
                  value={draft.sourceLang}
                  onChange={(e) =>
                    setDraft({ ...draft, sourceLang: e.target.value as AppSettings['sourceLang'] })
                  }
                >
                  <option value="auto">Auto Detect</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-1"><Server size={12} /> Translator Server URL</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  placeholder="http://localhost:5003"
                  value={draft.translatorApiUrl}
                  onChange={(e) => setDraft({ ...draft, translatorApiUrl: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Appearance tab */}
          {tab === 'appearance' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold">Appearance</h4>
              <p className="text-sm text-base-content/60">
                เลือกธีมที่ชอบ — จะแสดงตัวอย่างทันที
              </p>
              <div className="grid grid-cols-4 gap-2">
                {DAISY_THEMES.map((t) => (
                  <ThemePreview
                    key={t}
                    theme={t}
                    isActive={draft.theme === t}
                    onClick={() => setDraft({ ...draft, theme: t })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* AI tab */}
          {tab === 'ai' && (
            <div className="space-y-5">
              <h4 className="text-lg font-bold">AI / Translation</h4>

              {/* Translation Engine */}
              <div className="form-control">
                <label className="label"><span className="label-text flex items-center gap-1"><Cpu size={12} /> Translation Engine</span></label>
                <select
                  className="select select-bordered w-full"
                  value={draft.translationEngine}
                  onChange={(e) => setDraft({ ...draft, translationEngine: e.target.value as TranslationEngine })}
                >
                  <option value="gemini">Gemini API (แนะนำ)</option>
                  <option value="libretranslate">LibreTranslate (Docker)</option>
                  <option value="ollama">Ollama (Local LLM)</option>
                </select>
              </div>

              {/* Gemini Model Selector */}
              {draft.translationEngine === 'gemini' && (
                <div className="form-control">
                  <label className="label"><span className="label-text flex items-center gap-1"><Sparkles size={12} /> Gemini Model</span></label>
                  <div className="space-y-1.5">
                    {GEMINI_MODELS.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          draft.geminiModel === m.id
                            ? 'border-primary bg-primary/10'
                            : 'border-base-300/50 hover:border-base-300'
                        } ${!m.freeAvailable ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name="geminiModel"
                          className="radio radio-primary radio-xs"
                          checked={draft.geminiModel === m.id}
                          onChange={() => setDraft({ ...draft, geminiModel: m.id as GeminiModelId })}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{m.label}</span>
                            <span className={`badge badge-xs ${TIER_BADGE[m.tier]}`}>{m.tier}</span>
                            {!m.freeAvailable && <span className="badge badge-xs badge-ghost">Paid</span>}
                          </div>
                          <p className="text-[10px] text-base-content/50 mt-0.5">
                            {m.description} • In: {m.inputPrice} • Out: {m.outputPrice}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* LibreTranslate URL */}
              {draft.translationEngine === 'libretranslate' && (
                <div className="form-control">
                  <label className="label"><span className="label-text flex items-center gap-1"><Server size={12} /> LibreTranslate URL</span></label>
                  <input
                    type="url"
                    className="input input-bordered w-full"
                    placeholder="http://localhost:5004"
                    value={draft.libreTranslateUrl}
                    onChange={(e) => setDraft({ ...draft, libreTranslateUrl: e.target.value })}
                  />
                  <label className="label"><span className="label-text-alt text-xs">ต้องรัน Docker: libretranslate/libretranslate</span></label>
                </div>
              )}

              {/* Ollama URL + Model */}
              {draft.translationEngine === 'ollama' && (
                <>
                  <div className="form-control">
                    <label className="label"><span className="label-text flex items-center gap-1"><Server size={12} /> Ollama URL</span></label>
                    <input
                      type="url"
                      className="input input-bordered w-full"
                      placeholder="http://localhost:11434"
                      value={draft.ollamaUrl}
                      onChange={(e) => setDraft({ ...draft, ollamaUrl: e.target.value })}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text">Ollama Model</span></label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="typhoon2:8b"
                      value={draft.ollamaModel}
                      onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
                    />
                    <label className="label"><span className="label-text-alt text-xs">เช่น typhoon2:8b, llama3.1:8b, gemma2:9b</span></label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* API tab */}
          {tab === 'api' && (
            <div className="space-y-5">
              <h4 className="text-lg font-bold">API Keys</h4>
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-1"><Key size={12} /> Gemini API Key</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  placeholder="AIza..."
                  value={draft.geminiApiKey}
                  onChange={(e) => setDraft({ ...draft, geminiApiKey: e.target.value })}
                />
                <label className="label">
                  <span className="label-text-alt">
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary text-xs"
                    >
                      Get API Key from Google AI Studio →
                    </a>
                  </span>
                </label>
              </div>
              <div className="alert alert-info text-xs">
                <Globe size={14} />
                <span>API Key จะถูกเก็บไว้ใน localStorage ของเบราว์เซอร์เท่านั้น ไม่ส่งไปที่ server อื่น</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
