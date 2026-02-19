import { useCallback, useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { useAppStore, type PanelId } from './store/appStore'
import type { ExportFormat, TextRegion, ProcessingMode } from './types'
import { useFloatingPanel } from './hooks/useFloatingPanel'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAuthStore } from './store/authStore'
import { useAlbumStore } from './store/albumStore'
import AuthModal from './components/Auth/AuthModal'
import UserMenu from './components/Auth/UserMenu'
import AlbumListModal from './components/Albums/AlbumListModal'
import ImageUploader from './components/Upload/ImageUploader'
import ProcessingView from './components/Processing/ProcessingView'
import CanvasEditor, { type CanvasEditorHandle } from './components/Editor/CanvasEditor'
import PropertiesPanel from './components/Editor/PropertiesPanel'
import BrushToolbar from './components/Editor/BrushToolbar'
import ImageStrip from './components/Editor/ImageStrip'
import ResourceMonitor from './components/Processing/ResourceMonitor'
import FloatingQuotaBar from './components/Layout/FloatingQuotaBar'
import SplitView from './components/Comparison/SplitView'
import SettingsPanel from './components/Settings/SettingsPanel'
import FontConfigPage from './components/Settings/FontConfigPage'
import OcrCorrectionModal from './components/Editor/OcrCorrectionModal'
import { renderStageToDataUrl, exportFromDataUrl } from './services/exporter'
import { Toaster, toast } from 'sonner'
import {
  BookOpen,
  Settings,
  Type,
  ArrowLeft,
  ArrowRight,
  Download,
  Paintbrush,
  Wand2,
  ScrollText,
  Cpu,
  Sparkles,
  PanelRightOpen,
  RotateCcw,
  Loader2,
  ImageIcon,
  GripVertical,
  X,
  Save,
  FileSearch,
  Eye,
  EyeOff,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────

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
  return (
    <div className="floating-panel-sm p-2 h-full flex flex-col min-h-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-1 shrink-0">
        Logs ({logs.length})
      </h3>
      {logs.length === 0 && (
        <p className="text-xs text-base-content/30 text-center py-4">ยังไม่มี log — กด AI Process เพื่อเริ่ม</p>
      )}
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

// ── Panel toggle bar — bottom-right floating bar to reopen closed panels ──

const PANEL_ICONS: { id: PanelId; icon: typeof Paintbrush; label: string }[] = [
  { id: 'brush', icon: Paintbrush, label: 'Brush Tools' },
  { id: 'properties', icon: PanelRightOpen, label: 'Properties' },
  { id: 'resource', icon: Cpu, label: 'Resource Monitor' },
  { id: 'quota', icon: Sparkles, label: 'AI Quota' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
]

function PanelToggleBar() {
  const panels = useAppStore((s) => s.panels)
  const togglePanel = useAppStore((s) => s.togglePanel)
  const step = useAppStore((s) => s.currentStep)
  if (step !== 'edit') return null

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 floating-panel-sm px-3 py-2 flex items-center gap-1.5 panel-enter">
      {PANEL_ICONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`btn btn-sm btn-square transition-all ${
            panels[id] ? 'btn-primary' : 'btn-ghost opacity-50 hover:opacity-100'
          }`}
          onClick={() => togglePanel(id)}
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────

function App() {
  const store = useAppStore()
  const stageRef = useRef<Konva.Stage>(null)
  const editorRef = useRef<CanvasEditorHandle>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('full')
  const [showOcrModal, setShowOcrModal] = useState(false)

  const selectedRegion = store.regions.find((r) => r.id === store.selectedRegionId) ?? null
  const editImageUrl = store.cleanedImageUrl || store.originalImageUrl
  const originalFileName = store.images[0]?.name?.replace(/\.[^.]+$/, '') || 'manga-translated'

  // Init: restore custom fonts + auth
  useEffect(() => { store.init() }, [])
  useEffect(() => {
    const cleanup = useAuthStore.getState().init()
    return () => { cleanup.then((unsub) => unsub()) }
  }, [])

  // Auto-save draft every 30s while editing
  useAutoSave(30_000)
  // Global keyboard shortcuts (Ctrl+Z, B, E, etc.)
  useKeyboardShortcuts()

  const handleGoToEdit = useCallback(() => {
    if (store.images.length === 0) return
    if (store.imageEntries.length === 0) {
      store.addImageEntries(store.images)
    }
    store.goToEdit()
  }, [store])

  const handleContinueToExport = useCallback(() => {
    const stage = stageRef.current
    if (!stage) {
      toast.error('ไม่พบ canvas สำหรับ export')
      return
    }
    // Deselect all to hide transformer handles before capture
    editorRef.current?.deselectAll()
    // Small delay to let the deselect render
    setTimeout(() => {
      const dataUrl = renderStageToDataUrl(stage, canvasScale)
      store.setTranslatedImageUrl(dataUrl)
      store.setStep('export')
    }, 50)
  }, [canvasScale, store])

  const handleExport = useCallback(() => {
    const url = store.translatedImageUrl
    if (!url) {
      toast.error('ไม่มีรูปที่แปลแล้ว')
      return
    }
    exportFromDataUrl(url, originalFileName, {
      format: store.exportFormat,
      quality: store.exportQuality / 100,
    })
    toast.success('ดาวน์โหลดสำเร็จ!')
  }, [store, originalFileName])

  const handleStartAI = useCallback(() => {
    if (!store.images[0]) return
    setRetryCount(0)
    store.startProcess()
  }, [store])

  const handleRetryAI = useCallback(() => {
    store.setProcessError(null)
    setRetryCount((c) => c + 1)
    store.startProcess()
  }, [store])

  const handleSaveToAlbum = useCallback(() => {
    const user = useAuthStore.getState().user
    if (!user) {
      useAuthStore.getState().setShowAuthModal(true)
      toast.info('กรุณาเข้าสู่ระบบก่อนบันทึก')
      return
    }
    useAlbumStore.getState().openForSave()
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden dot-canvas">
      {/* ── Seamless Navbar ── */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0 z-30 bg-linear-to-b from-base-300/60 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          <span className="text-sm font-bold tracking-tight">MG_Translater</span>
          <span className="badge badge-xs badge-ghost">v0.5</span>
        </div>

        {/* Step indicator — minimal */}
        {store.currentStep !== 'upload' && (
          <div className="flex items-center gap-1 text-xs">
            {['Upload', 'Edit', 'Export'].map((label, i) => {
              const stepMap = ['upload', 'edit', 'export']
              const idx = stepMap.indexOf(store.currentStep)
              return (
                <span key={label} className={`px-2 py-0.5 rounded-full transition-all ${
                  i <= idx ? 'bg-primary/20 text-primary font-bold' : 'text-base-content/30'
                }`}>
                  {i + 1}. {label}
                </span>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => store.toggleFontConfig(true)}
            title="Fonts"
          >
            <Type size={14} />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => store.toggleSettings(true)}
            title="Settings"
          >
            <Settings size={14} />
          </button>
          <UserMenu />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden relative">

        {/* ============ Upload Step ============ */}
        {store.currentStep === 'upload' && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-lg w-full text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Upload Manga Images</h2>
                <p className="text-base-content/50 text-sm">
                  ลากรูปมังงะมาวาง หรือเลือกไฟล์เพื่อเริ่มแปล
                </p>
              </div>

              <ImageUploader
                onImagesSelected={store.setImages}
                selectedImages={store.images}
              />

              <button
                className="btn btn-primary btn-lg gap-2 shadow-lg w-full max-w-xs mx-auto"
                disabled={store.images.length === 0}
                onClick={handleGoToEdit}
              >
                <ImageIcon size={18} />
                Open in Editor
              </button>
            </div>
          </div>
        )}

        {/* ============ Edit Step — full canvas + floating panels ============ */}
        {store.currentStep === 'edit' && (
          <>
            {/* Full-bleed Canvas */}
            <div className="absolute inset-0">
              {editImageUrl ? (
                <CanvasEditor
                  imageUrl={editImageUrl}
                  regions={store.regions}
                  onRegionUpdate={store.updateRegion}
                  onRegionDelete={store.deleteRegion}
                  onSelectedRegion={store.selectRegion}
                  stageRef={stageRef}
                  onScaleChange={setCanvasScale}
                  editorRef={editorRef}
                />
              ) : (
                <div className="h-full flex items-center justify-center dot-canvas">
                  <p className="text-base-content/30 text-lg">ไม่มีรูปภาพ</p>
                </div>
              )}
            </div>

            {/* Top overlay toolbar — right-aligned only, no overlap */}
            <div className="absolute top-2 right-3 z-20 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2">
                <span className="text-xs text-base-content/50 bg-base-300/70 backdrop-blur-sm rounded-full px-3 py-1">
                  {store.regions.length} regions · {store.brushStrokes.length} strokes
                </span>
                <button
                  className="btn btn-ghost btn-sm gap-1 bg-base-300/70 backdrop-blur-sm"
                  onClick={store.resetToUpload}
                >
                  <ArrowLeft size={14} /> เริ่มใหม่
                </button>
                <button
                  className="btn btn-ghost btn-sm gap-1 bg-base-300/70 backdrop-blur-sm"
                  onClick={handleSaveToAlbum}
                  title="บันทึกลงอัลบั้ม"
                >
                  <Save size={14} /> บันทึก
                </button>
                {store.regions.length > 0 && !store.isProcessing && (
                  <>
                    <button
                      className="btn btn-ghost btn-sm gap-1 bg-base-300/70 backdrop-blur-sm"
                      onClick={() => setShowOcrModal(true)}
                      title="ตรวจสอบ OCR"
                    >
                      <FileSearch size={14} /> OCR
                    </button>
                    <button
                      className={`btn btn-ghost btn-sm btn-square bg-base-300/70 backdrop-blur-sm ${!store.showTextOverlay ? 'opacity-50' : ''}`}
                      onClick={() => store.toggleTextOverlay()}
                      title={store.showTextOverlay ? 'ซ่อนข้อความ' : 'แสดงข้อความ'}
                    >
                      {store.showTextOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </>
                )}
                {!store.isProcessing && (
                  <div className="flex items-center">
                    <select
                      className="select select-sm bg-base-300/70 backdrop-blur-sm border-r-0 rounded-r-none text-xs h-8 min-h-0"
                      value={processingMode}
                      onChange={(e) => setProcessingMode(e.target.value as ProcessingMode)}
                    >
                      <option value="full">แปลทั้งหมด</option>
                      <option value="clean_only">คลีนอย่างเดียว</option>
                      <option value="ocr_only">OCR อย่างเดียว</option>
                    </select>
                    <button
                      className="btn btn-secondary btn-sm gap-1 shadow-md rounded-l-none"
                      onClick={handleStartAI}
                      disabled={!store.images[0]}
                    >
                      <Wand2 size={14} /> AI
                    </button>
                  </div>
                )}
                {store.isProcessing && (
                  <span className="btn btn-sm btn-disabled gap-1">
                    <Loader2 size={14} className="animate-spin" /> Processing...
                  </span>
                )}
                <button
                  className="btn btn-primary btn-sm gap-1 shadow-md"
                  onClick={handleContinueToExport}
                >
                  Export <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Inline Processing overlay */}
            {store.isProcessing && store.images[0] && (
              <div className="absolute inset-0 z-10 bg-base-100/50 backdrop-blur-sm flex items-center justify-center">
                <div className="w-full max-w-xl">
                  <ProcessingView
                    imageFile={store.images[0]}
                    sourceLang={store.settings.sourceLang}
                    apiKey={store.settings.geminiApiKey}
                    modelId={store.settings.geminiModel}
                    mode={processingMode}
                    translationEngine={store.settings.translationEngine}
                    llmOptions={{
                      libreTranslateUrl: store.settings.libreTranslateUrl,
                      ollamaUrl: store.settings.ollamaUrl,
                      ollamaModel: store.settings.ollamaModel,
                    }}
                    onComplete={store.completeProcess}
                    onError={(e) => store.setProcessError(e)}
                    onLog={store.addLog}
                    retryCount={retryCount}
                  />
                </div>
              </div>
            )}

            {/* Error retry overlay */}
            {!store.isProcessing && store.processError && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 floating-panel px-4 py-3 max-w-sm text-center panel-enter">
                <p className="text-sm text-error font-medium mb-2">{store.processError}</p>
                <div className="flex items-center justify-center gap-2">
                  <button className="btn btn-sm btn-primary gap-1" onClick={handleRetryAI}>
                    <RotateCcw size={12} /> Retry
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => store.setProcessError(null)}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Multi-image thumbnail strip */}
            <ImageStrip />

            {/* Floating Brush Toolbar */}
            {store.panels.brush && (
              <BrushToolbar onClose={() => store.togglePanel('brush', false)} />
            )}

            {/* Floating Properties Panel */}
            {store.panels.properties && selectedRegion && (
              <FloatingProperties
                region={selectedRegion}
                onUpdate={store.updateRegion}
                onDelete={store.deleteRegion}
              />
            )}

            {/* Floating Resource Monitor */}
            {store.panels.resource && (
              <ResourceMonitor isProcessing={store.isProcessing} />
            )}

            {/* Floating Logs — always show when panel toggled on */}
            {store.panels.logs && (
              <div className="fixed bottom-14 left-3 z-40 w-96 h-52">
                <LogPanel logs={store.logs} />
              </div>
            )}
          </>
        )}

        {/* ============ Export Step ============ */}
        {store.currentStep === 'export' && (
          <div className="h-full flex gap-3 p-3">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {store.originalImageUrl && store.translatedImageUrl && (
                <SplitView
                  originalImageUrl={store.originalImageUrl}
                  translatedImageUrl={store.translatedImageUrl}
                />
              )}
            </div>
            <div className="w-72 shrink-0 flex flex-col gap-3">
              <div className="card floating-panel">
                <div className="card-body py-4 gap-3">
                  <h2 className="card-title text-lg">Export</h2>
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-sm">Format</span>
                    </label>
                    <select
                      className="select select-bordered select-sm w-full"
                      value={store.exportFormat}
                      onChange={(e) => store.setExportFormat(e.target.value as ExportFormat)}
                    >
                      <option value="png">PNG (lossless)</option>
                      <option value="jpg">JPG (smaller file)</option>
                      <option value="webp">WebP (best balance)</option>
                    </select>
                  </div>
                  {store.exportFormat !== 'png' && (
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm">Quality: {store.exportQuality}%</span>
                      </label>
                      <input
                        type="range"
                        className="range range-primary range-sm"
                        min={10}
                        max={100}
                        value={store.exportQuality}
                        onChange={(e) => store.setExportQuality(Number(e.target.value))}
                      />
                    </div>
                  )}
                  <button className="btn btn-primary w-full gap-2" onClick={handleExport}>
                    <Download size={16} /> Download
                  </button>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => store.setStep('edit')}
              >
                <ArrowLeft size={14} /> Back to Editor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel toggle bar ── */}
      <PanelToggleBar />

      {/* ── Floating quota bar ── */}
      {store.panels.quota && <FloatingQuotaBar />}

      {/* ── Modals ── */}
      <SettingsPanel
        settings={store.settings}
        onSave={store.setSettings}
        isOpen={store.showSettings}
        onClose={() => store.toggleSettings(false)}
      />
      <FontConfigPage
        moodMap={store.settings.fontMoodMap}
        onSave={(moodMap) => store.setSettings({ ...store.settings, fontMoodMap: moodMap })}
        isOpen={store.showFontConfig}
        onClose={() => store.toggleFontConfig(false)}
      />
      <AuthModal />
      <AlbumListModal />
      <OcrCorrectionModal isOpen={showOcrModal} onClose={() => setShowOcrModal(false)} />
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </div>
  )
}

// ── Floating Properties wrapper ──────────────────────────────────────

function FloatingProperties({
  region,
  onUpdate,
  onDelete,
}: {
  region: TextRegion
  onUpdate: (id: string, u: Partial<TextRegion>) => void
  onDelete: (id: string) => void
}) {
  const { panelStyle, dragHandleProps } = useFloatingPanel({
    id: 'properties-panel',
    defaultPosition: { x: window.innerWidth - 300, y: 60 },
    defaultVisible: true,
  })
  const togglePanel = useAppStore((s) => s.togglePanel)

  return (
    <div style={panelStyle} className="floating-panel p-3 w-72 max-h-[80vh] overflow-y-auto panel-enter">
      <div className="flex items-center justify-between mb-2">
        <div {...dragHandleProps} className="flex items-center gap-1 drag-handle flex-1">
          <GripVertical size={14} className="text-base-content/30" />
          <span className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            Properties
          </span>
        </div>
        <button
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => togglePanel('properties', false)}
        >
          <X size={12} />
        </button>
      </div>
      <PropertiesPanel region={region} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  )
}

export default App
