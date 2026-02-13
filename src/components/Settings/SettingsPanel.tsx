import { useState } from 'react'
import type { AppSettings } from '../../types'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({
  settings,
  onSave,
  isOpen,
  onClose,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppSettings>(settings)

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  const handleReset = () => {
    setDraft(settings)
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold mb-4">⚙️ Settings</h3>

        <div className="space-y-4">
          {/* Gemini API Key */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Gemini API Key</span>
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
                  className="link link-primary"
                >
                  Get API Key →
                </a>
              </span>
            </label>
          </div>

          {/* Translator API URL */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Translator Server URL</span>
            </label>
            <input
              type="url"
              className="input input-bordered w-full"
              placeholder="http://localhost:5003"
              value={draft.translatorApiUrl}
              onChange={(e) => setDraft({ ...draft, translatorApiUrl: e.target.value })}
            />
          </div>

          {/* Source Language */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Source Language</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={draft.sourceLang}
              onChange={(e) =>
                setDraft({ ...draft, sourceLang: e.target.value as 'ja' | 'zh' | 'en' })
              }
            >
              <option value="ja">🇯🇵 Japanese</option>
              <option value="zh">🇨🇳 Chinese</option>
              <option value="en">🇺🇸 English</option>
            </select>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
