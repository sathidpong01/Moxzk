import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { useAppStore } from './store/appStore'
import type { ExportFormat } from './types'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useEditorActions } from './hooks/useEditorActions'
import { useAuthStore } from './store/authStore'
import type { CanvasEditorHandle } from './components/Editor/CanvasEditor'
import AuthModal from './components/Auth/AuthModal'
import UserMenu from './components/Auth/UserMenu'
import AlbumListModal from './components/Albums/AlbumListModal'
import UploadStep from './components/Steps/UploadStep'
import EditStep from './components/Steps/EditStep'
import ExportStep from './components/Steps/ExportStep'
import PanelToggleBar from './components/Layout/PanelToggleBar'
import FloatingQuotaBar from './components/Layout/FloatingQuotaBar'
import SettingsPanel from './components/Settings/SettingsPanel'
import FontConfigPage from './components/Settings/FontConfigPage'
import { Toaster } from 'sonner'
import { BookOpen, Settings, Type } from 'lucide-react'

// ── Main App ─────────────────────────────────────────────────────────

function App() {
  const store = useAppStore()
  const stageRef = useRef<Konva.Stage>(null)
  const editorRef = useRef<CanvasEditorHandle>(null)
  const [canvasScale, setCanvasScale] = useState(1)

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

  // Consolidated editor action callbacks
  const {
    retryCount,
    handleGoToEdit,
    handleContinueToExport,
    handleExport,
    handleStartAI,
    handleRetryAI,
    handleSaveToAlbum,
  } = useEditorActions({ stageRef, editorRef, canvasScale })

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
        {store.currentStep === 'upload' && (
          <UploadStep
            images={store.images}
            onImagesSelected={store.setImages}
            onGoToEdit={handleGoToEdit}
          />
        )}

        {store.currentStep === 'edit' && (
          <EditStep
            stageRef={stageRef}
            editorRef={editorRef}
            onScaleChange={setCanvasScale}
            onContinueToExport={handleContinueToExport}
            onStartAI={handleStartAI}
            onRetryAI={handleRetryAI}
            onSaveToAlbum={handleSaveToAlbum}
            retryCount={retryCount}
          />
        )}

        {store.currentStep === 'export' && (
          <ExportStep
            originalImageUrl={store.originalImageUrl}
            translatedImageUrl={store.translatedImageUrl}
            exportFormat={store.exportFormat}
            exportQuality={store.exportQuality}
            onExportFormatChange={(f: ExportFormat) => store.setExportFormat(f)}
            onExportQualityChange={store.setExportQuality}
            onExport={handleExport}
            onBack={() => store.setStep('edit')}
          />
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
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </div>
  )
}

export default App
