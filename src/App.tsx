import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppStep, TextRegion, AppSettings, ExportFormat } from './types'
import { DEFAULT_MOOD_MAP, restoreCustomFont } from './config/fonts'
import ImageUploader from './components/Upload/ImageUploader'
import ProcessingView from './components/Processing/ProcessingView'
import CanvasEditor from './components/Editor/CanvasEditor'
import PropertiesPanel from './components/Editor/PropertiesPanel'
import SplitView from './components/Comparison/SplitView'
import SettingsPanel from './components/Settings/SettingsPanel'
import FontConfigPage from './components/Settings/FontConfigPage'
import { exportAndDownload } from './services/exporter'
import { loadSettings, saveSettings } from './services/settingsStorage'
import { getAllFonts } from './services/fontStorage'
import { Toaster, toast } from 'sonner'

const STEPS: { id: AppStep; label: string; icon: string }[] = [
  { id: 'upload', label: 'Upload', icon: '📤' },
  { id: 'process', label: 'Process', icon: '⚙️' },
  { id: 'edit', label: 'Edit', icon: '✏️' },
  { id: 'export', label: 'Export', icon: '💾' },
]

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
  translatorApiUrl: import.meta.env.VITE_TRANSLATOR_API_URL ?? 'http://localhost:5003',
  sourceLang: 'auto',
  fontMoodMap: DEFAULT_MOOD_MAP,
}

function getLogStyle(log: string): string {
  const lower = log.toLowerCase()
  if (lower.includes('error') || lower.includes('ผิดพลาด'))
    return 'bg-red-900/40 text-red-200 border-l-2 border-red-500'
  if (lower.includes('เสร็จ') || lower.includes('finished') || lower.includes('done') || lower.includes('complete'))
    return 'bg-green-900/40 text-green-200 border-l-2 border-green-500'
  if (lower.includes('[queue]') || lower.includes('[waiting]') || lower.includes('คิว'))
    return 'bg-yellow-900/40 text-yellow-200 border-l-2 border-yellow-500'
  if (lower.includes('[progress]') || lower.includes('กำลัง') || lower.includes('ocr') || lower.includes('gemini'))
    return 'bg-blue-900/40 text-blue-200 border-l-2 border-blue-500'
  return 'text-base-content/70'
}

function LogPanel({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  if (logs.length === 0) return null

  return (
    <div className="bg-base-300/50 rounded-lg p-2 h-full flex flex-col min-h-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-1 shrink-0">
        Logs ({logs.length})
      </h3>
      <div className="overflow-y-auto flex-1 min-h-0 text-xs font-mono space-y-0.5">
        {logs.map((log, i) => (
          <div key={i} className={`leading-tight rounded px-1.5 py-0.5 ${getLogStyle(log)}`}>
            <span className="opacity-40 mr-1">{i + 1}</span>
            {log}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('upload')
  const [images, setImages] = useState<File[]>([])
  const [regions, setRegions] = useState<TextRegion[]>([])
  const [cleanedImageUrl, setCleanedImageUrl] = useState<string | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(DEFAULT_SETTINGS))
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showFontConfig, setShowFontConfig] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  // Restore custom fonts from IndexedDB on app startup
  useEffect(() => {
    getAllFonts().then(async (storedFonts) => {
      for (const sf of storedFonts) {
        try {
          await restoreCustomFont(sf)
        } catch {
          // font already registered or invalid
        }
      }
    }).catch((err) => {
      console.error('Failed to restore cached fonts on startup:', err)
    })
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const [exportFormat, setExportFormat] = useState<ExportFormat>('png')
  const [exportQuality, setExportQuality] = useState(95)
  const [processError, setProcessError] = useState<string | null>(null)

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const selectedRegion = regions.find((r) => r.id === selectedRegionId) ?? null

  const handleRegionUpdate = useCallback((id: string, updates: Partial<TextRegion>) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    )
  }, [])

  const handleAddLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-100), msg])
  }, [])

  const handleProcessComplete = useCallback(
    (translatedRegions: TextRegion[], cleanedUrl: string) => {
      setRegions(translatedRegions)
      setCleanedImageUrl(cleanedUrl)
      if (images[0]) {
        setOriginalImageUrl(URL.createObjectURL(images[0]))
      }
      setCurrentStep('edit')
      toast.success(`แปลเสร็จ! พบ ${translatedRegions.length} regions`)
    },
    [images],
  )

  const handleProcessError = useCallback((error: string) => {
    setProcessError(error)
    toast.error(`เกิดข้อผิดพลาด: ${error}`)
  }, [])

  const handleExport = useCallback(() => {
    const canvasEl = document.querySelector('.upper-canvas') as HTMLCanvasElement | null
    if (!canvasEl) {
      toast.error('ไม่พบ canvas สำหรับ export')
      return
    }
    exportAndDownload(canvasEl, 'manga-translated', {
      format: exportFormat,
      quality: exportQuality / 100,
      scale: 1,
    })
    toast.success('ดาวน์โหลดสำเร็จ!')
  }, [exportFormat, exportQuality])

  const handleStartProcess = useCallback(() => {
    setProcessError(null)
    setLogs([])
    setCurrentStep('process')
    toast.info('เริ่มประมวลผล...')
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-base-200">
      {/* Header — logo + steps (inline) + settings */}
      <div className="navbar bg-base-100 shadow-lg border-b border-base-300 min-h-0 py-1 px-4 shrink-0">
        <div className="flex-none">
          <span className="text-lg font-bold tracking-tight">
            📖 MG_Translater
          </span>
          <span className="badge badge-sm badge-ghost ml-2">v0.1</span>
        </div>

        {/* Steps — center, only show when not on upload */}
        {currentStep !== 'upload' && (
          <div className="flex-1 flex justify-center">
            <ul className="steps steps-horizontal text-xs">
              {STEPS.map((step, i) => (
                <li
                  key={step.id}
                  className={`step ${i <= stepIndex ? 'step-primary' : ''}`}
                >
                  {step.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {currentStep === 'upload' && <div className="flex-1" />}

        <div className="flex-none gap-1">
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => setShowFontConfig(true)}
            title="Fonts"
          >
            🔤
          </button>
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main content — fills remaining viewport */}
      <div className="flex-1 overflow-hidden p-3">
        {/* Upload Step */}
        {currentStep === 'upload' && (
          <div className="h-full flex items-center justify-center">
            <div className="card bg-base-100 shadow-xl max-w-xl w-full">
              <div className="card-body items-center text-center">
                <h2 className="card-title text-2xl mb-2">Upload Manga Images</h2>
                <p className="text-base-content/60 mb-4 text-sm">
                  ลากรูปมังงะมาวาง หรือเลือกไฟล์เพื่อเริ่มแปล
                </p>

                <ImageUploader
                  onImagesSelected={setImages}
                  selectedImages={images}
                />

                <div className="card-actions mt-4">
                  <button
                    className="btn btn-primary"
                    disabled={images.length === 0}
                    onClick={handleStartProcess}
                  >
                    Start Processing →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Process Step — two-column: progress left, logs right */}
        {currentStep === 'process' && (
          <div className="h-full flex gap-3">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="card bg-base-100 shadow-xl w-full max-w-md">
                <div className="card-body items-center text-center">
                  <h2 className="card-title text-xl mb-3">Processing</h2>

                  {images[0] ? (
                    <ProcessingView
                      imageFile={images[0]}
                      sourceLang={settings.sourceLang}
                      onComplete={handleProcessComplete}
                      onError={handleProcessError}
                      onLog={handleAddLog}
                    />
                  ) : (
                    <div className="alert alert-warning">
                      <span>ไม่มีรูปภาพ — กรุณากลับไปอัพโหลดก่อน</span>
                    </div>
                  )}

                  {processError && (
                    <div className="alert alert-error mt-3 text-sm">
                      <span>{processError}</span>
                    </div>
                  )}

                  <div className="card-actions mt-4">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentStep('upload')}
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: logs panel */}
            <div className="w-80 shrink-0 h-full">
              <LogPanel logs={logs} />
            </div>
          </div>
        )}

        {/* Edit Step — toolbar + canvas + sidebar */}
        {currentStep === 'edit' && (
          <div className="h-full flex flex-col gap-2">
            {/* Toolbar — zoom left, actions right */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/40">
                  {regions.length} regions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrentStep('upload')}
                >
                  ← Start Over
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setCurrentStep('export')}
                >
                  Continue to Export →
                </button>
              </div>
            </div>

            {/* Main area — canvas + sidebar */}
            <div className="flex-1 flex gap-3 min-h-0">
              {/* Canvas */}
              <div className="flex-1 min-w-0 min-h-0">
                {cleanedImageUrl ? (
                  <CanvasEditor
                    cleanedImageUrl={cleanedImageUrl}
                    regions={regions}
                    onRegionUpdate={handleRegionUpdate}
                    onSelectedRegion={setSelectedRegionId}
                  />
                ) : (
                  <div className="editor-canvas-area rounded-xl h-full flex items-center justify-center">
                    <p className="text-base-content/30 text-lg">
                      ไม่มีรูปที่ประมวลผลแล้ว
                    </p>
                  </div>
                )}
              </div>

              {/* Right sidebar: properties (top) + logs (bottom) */}
              <div className="w-72 shrink-0 flex flex-col gap-2 min-h-0">
                <div className="overflow-y-auto flex-1 min-h-0">
                  <PropertiesPanel
                    region={selectedRegion}
                    onUpdate={handleRegionUpdate}
                  />
                </div>

                {logs.length > 0 && (
                  <div className="max-h-48 min-h-0 shrink-0">
                    <LogPanel logs={logs} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Export Step */}
        {currentStep === 'export' && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-4">
              {originalImageUrl && cleanedImageUrl && (
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body py-4">
                    <h2 className="card-title text-xl mb-2">Before / After</h2>
                    <SplitView
                      originalImageUrl={originalImageUrl}
                      translatedImageUrl={cleanedImageUrl}
                    />
                  </div>
                </div>
              )}

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body items-center text-center py-4">
                  <h2 className="card-title text-xl mb-3">Export</h2>

                  <div className="w-full max-w-md space-y-3">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text">Format</span>
                      </label>
                      <select
                        className="select select-bordered select-sm w-full"
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      >
                        <option value="png">PNG (lossless)</option>
                        <option value="jpg">JPG (smaller file)</option>
                        <option value="webp">WebP (best balance)</option>
                      </select>
                    </div>

                    {exportFormat !== 'png' && (
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text">Quality: {exportQuality}%</span>
                        </label>
                        <input
                          type="range"
                          className="range range-primary range-sm"
                          min={10}
                          max={100}
                          value={exportQuality}
                          onChange={(e) => setExportQuality(Number(e.target.value))}
                        />
                      </div>
                    )}

                    <button
                      className="btn btn-primary w-full"
                      onClick={handleExport}
                    >
                      💾 Download
                    </button>
                  </div>

                  <div className="card-actions mt-3">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentStep('edit')}
                    >
                      ← Back to Editor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <SettingsPanel
        settings={settings}
        onSave={setSettings}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
      <FontConfigPage
        moodMap={settings.fontMoodMap}
        onSave={(moodMap) => setSettings((s) => ({ ...s, fontMoodMap: moodMap }))}
        isOpen={showFontConfig}
        onClose={() => setShowFontConfig(false)}
      />
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </div>
  )
}

export default App
