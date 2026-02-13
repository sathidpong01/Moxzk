import { useCallback, useState } from 'react'
import type { AppStep, TextRegion, AppSettings, ExportFormat } from './types'
import { DEFAULT_MOOD_MAP } from './config/fonts'
import ImageUploader from './components/Upload/ImageUploader'
import ProcessingView from './components/Processing/ProcessingView'
import CanvasEditor from './components/Editor/CanvasEditor'
import PropertiesPanel from './components/Editor/PropertiesPanel'
import SplitView from './components/Comparison/SplitView'
import SettingsPanel from './components/Settings/SettingsPanel'
import FontConfigPage from './components/Settings/FontConfigPage'
import { exportAndDownload } from './services/exporter'

const STEPS: { id: AppStep; label: string; icon: string }[] = [
  { id: 'upload', label: 'Upload', icon: '📤' },
  { id: 'process', label: 'Process', icon: '⚙️' },
  { id: 'edit', label: 'Edit', icon: '✏️' },
  { id: 'export', label: 'Export', icon: '💾' },
]

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
  translatorApiUrl: import.meta.env.VITE_TRANSLATOR_API_URL ?? 'http://localhost:5003',
  sourceLang: 'ja',
  fontMoodMap: DEFAULT_MOOD_MAP,
}

function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('upload')
  const [images, setImages] = useState<File[]>([])
  const [regions, setRegions] = useState<TextRegion[]>([])
  const [cleanedImageUrl, setCleanedImageUrl] = useState<string | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showFontConfig, setShowFontConfig] = useState(false)
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

  const handleProcessComplete = useCallback(
    (translatedRegions: TextRegion[], cleanedUrl: string) => {
      setRegions(translatedRegions)
      setCleanedImageUrl(cleanedUrl)
      if (images[0]) {
        setOriginalImageUrl(URL.createObjectURL(images[0]))
      }
      setCurrentStep('edit')
    },
    [images],
  )

  const handleProcessError = useCallback((error: string) => {
    setProcessError(error)
  }, [])

  const handleExport = useCallback(() => {
    const canvasEl = document.querySelector('.canvas-container canvas') as HTMLCanvasElement | null
    if (!canvasEl) return
    exportAndDownload(canvasEl, 'manga-translated', {
      format: exportFormat,
      quality: exportQuality / 100,
      scale: 1,
    })
  }, [exportFormat, exportQuality])

  const handleStartProcess = useCallback(() => {
    setProcessError(null)
    setCurrentStep('process')
  }, [])

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg border-b border-base-300">
        <div className="flex-1">
          <span className="text-xl font-bold px-4 tracking-tight">
            📖 MG_Translater
          </span>
          <span className="badge badge-sm badge-ghost">v0.1</span>
        </div>
        <div className="flex-none gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowFontConfig(true)}
          >
            🔤 Fonts
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(true)}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex justify-center py-6 bg-base-100/50 border-b border-base-300">
        <ul className="steps steps-horizontal">
          {STEPS.map((step, i) => (
            <li
              key={step.id}
              className={`step ${i <= stepIndex ? 'step-primary' : ''}`}
            >
              <span className="hidden sm:inline">{step.icon} </span>
              {step.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Upload Step */}
        {currentStep === 'upload' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center">
              <h2 className="card-title text-2xl mb-2">Upload Manga Images</h2>
              <p className="text-base-content/60 mb-6">
                ลากรูปมังงะมาวาง หรือเลือกไฟล์เพื่อเริ่มแปล
              </p>

              <ImageUploader
                onImagesSelected={setImages}
                selectedImages={images}
              />

              <div className="card-actions mt-6">
                <button
                  className="btn btn-primary btn-lg"
                  disabled={images.length === 0}
                  onClick={handleStartProcess}
                >
                  Start Processing →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Process Step */}
        {currentStep === 'process' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center">
              <h2 className="card-title text-2xl mb-4">Processing</h2>

              {images[0] ? (
                <ProcessingView
                  imageFile={images[0]}
                  sourceLang={settings.sourceLang}
                  onComplete={handleProcessComplete}
                  onError={handleProcessError}
                />
              ) : (
                <div className="alert alert-warning">
                  <span>ไม่มีรูปภาพ — กรุณากลับไปอัพโหลดก่อน</span>
                </div>
              )}

              {processError && (
                <div className="alert alert-error mt-4">
                  <span>{processError}</span>
                </div>
              )}

              <div className="card-actions mt-6 gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentStep('upload')}
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Step */}
        {currentStep === 'edit' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-2xl">Canvas Editor</h2>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  {cleanedImageUrl ? (
                    <CanvasEditor
                      cleanedImageUrl={cleanedImageUrl}
                      regions={regions}
                      onRegionUpdate={handleRegionUpdate}
                      onSelectedRegion={setSelectedRegionId}
                    />
                  ) : (
                    <div className="canvas-container rounded-xl min-h-[500px] flex items-center justify-center">
                      <p className="text-base-content/30 text-lg">
                        ไม่มีรูปที่ประมวลผลแล้ว
                      </p>
                    </div>
                  )}
                </div>
                <div className="w-72 max-h-[600px] overflow-y-auto">
                  <PropertiesPanel
                    region={selectedRegion}
                    moodMap={settings.fontMoodMap}
                    onUpdate={handleRegionUpdate}
                  />
                </div>
              </div>

              <div className="card-actions mt-6 gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentStep('upload')}
                >
                  ← Start Over
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentStep('export')}
                >
                  Continue to Export →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Step */}
        {currentStep === 'export' && (
          <div className="space-y-6">
            {/* Comparison */}
            {originalImageUrl && cleanedImageUrl && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title text-2xl mb-4">Before / After</h2>
                  <SplitView
                    originalImageUrl={originalImageUrl}
                    translatedImageUrl={cleanedImageUrl}
                  />
                </div>
              </div>
            )}

            {/* Export options */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <h2 className="card-title text-2xl mb-4">Export</h2>

                <div className="w-full max-w-md space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Format</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
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
                      <label className="label">
                        <span className="label-text">Quality: {exportQuality}%</span>
                      </label>
                      <input
                        type="range"
                        className="range range-primary"
                        min={10}
                        max={100}
                        value={exportQuality}
                        onChange={(e) => setExportQuality(Number(e.target.value))}
                      />
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-lg w-full"
                    onClick={handleExport}
                  >
                    💾 Download
                  </button>
                </div>

                <div className="card-actions mt-6">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setCurrentStep('edit')}
                  >
                    ← Back to Editor
                  </button>
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
    </div>
  )
}

export default App
