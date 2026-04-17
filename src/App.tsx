import { useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import { useAppStore } from './store/appStore'
import type { AppStep, ExportFormat } from './types'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useEditorActions } from './hooks/useEditorActions'
import { useAuthStore } from './store/authStore'
import { useAlbumStore } from './store/albumStore'
import type { CanvasEditorHandle } from './components/Editor/CanvasEditor'
import AuthModal from './components/Auth/AuthModal'
import UserMenu from './components/Auth/UserMenu'
import AlbumListModal from './components/Albums/AlbumListModal'
import UploadStep from './components/Steps/UploadStep'
import EditStep from './components/Steps/EditStep'
import ExportStep from './components/Steps/ExportStep'
import PanelToggleBar from './components/Layout/PanelToggleBar'
import SettingsPanel from './components/Settings/SettingsPanel'
import FontConfigPage from './components/Settings/FontConfigPage'
import { Badge, Button, DropdownItem, DropdownMenu, IconButton, Modal } from './components/ui/primitives'
import { Toaster } from 'sonner'
import { BookOpen, Download, FolderOpen, ImagePlus, RotateCcw, Save, Settings, Type, Wand2 } from 'lucide-react'
import type { ProcessingMode } from './types'

// ── Main App ─────────────────────────────────────────────────────────

function App() {
  const store = useAppStore()
  const albumStore = useAlbumStore()
  const stageRef = useRef<Konva.Stage>(null)
  const editorRef = useRef<CanvasEditorHandle>(null)
  const addImagesInputRef = useRef<HTMLInputElement>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [aiConfirmTarget, setAiConfirmTarget] = useState<'single' | 'batch' | null>(null)
  const [batchStopConfirmOpen, setBatchStopConfirmOpen] = useState(false)
  const [clearProjectConfirmOpen, setClearProjectConfirmOpen] = useState(false)
  const albumTitle = albumStore.currentAlbum?.title?.trim() || 'โปรเจกต์ใหม่'
  const stepLabel = useMemo(() => getStepLabel(store.currentStep), [store.currentStep])
  const defaultBatchMode: ProcessingMode = store.settings.cleanupBackend === 'panelcleaner' ? 'gemma_vision_full' : 'full'

  // Init: restore custom fonts + auth
  useEffect(() => { store.init() }, [])
  useEffect(() => {
    const cleanup = useAuthStore.getState().init()
    return () => { cleanup.then((unsub) => unsub()) }
  }, [])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('auth') !== 'success') return
    window.history.replaceState({}, '', '/')
    useAuthStore.getState().fetchProfile().catch((error) => {
      console.warn('[auth] Failed to refresh Google session:', error)
    })
  }, [])

  // Consolidated editor action callbacks
  const {
    retryCount,
    handleGoToEdit,
    handleContinueToExport,
    handleExport,
    handleStartAI,
    handleStartBatchAI,
    handleRetryFailedBatchAI,
    handleStopBatchAI,
    handleCancelAI,
    handleRetryAI,
    handleSaveToAlbum,
    isBatchProcessing,
    batchStatus,
  } = useEditorActions({ stageRef, editorRef, canvasScale })

  const requestAI = (target: 'single' | 'batch') => {
    if (store.isProcessing || isBatchProcessing) return
    setAiConfirmTarget(target)
  }

  // Auto-save draft every 30s while editing
  useAutoSave(30_000)
  // Global keyboard shortcuts (Ctrl+Z, B, E, etc.)
  useKeyboardShortcuts({
    onSave: handleSaveToAlbum,
    onExport: handleContinueToExport,
    onStartAI: () => requestAI('single'),
  })

  const handleAddImages = (files: FileList | null) => {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (images.length > 0) store.addImageEntries(images)
    if (addImagesInputRef.current) addImagesInputRef.current.value = ''
  }

  const handleOpenAlbums = () => {
    if (useAuthStore.getState().user) {
      useAlbumStore.getState().openForBrowse()
    } else {
      useAuthStore.getState().setShowAuthModal(true)
    }
  }

  const confirmStartAI = () => {
    if (aiConfirmTarget === 'single') {
      handleStartAI()
    } else if (aiConfirmTarget === 'batch') {
      handleStartBatchAI(defaultBatchMode)
    }
    setAiConfirmTarget(null)
  }

  return (
    <div className="studio-shell flex h-screen flex-col overflow-hidden">
      <div className="studio-chrome z-30 flex h-11 shrink-0 items-center justify-between gap-2 border-b px-2 sm:px-4">
        <div className="flex min-w-0 max-w-[180px] items-center gap-1.5 text-sm font-bold sm:max-w-none sm:gap-2">
          <BookOpen size={16} className="hidden shrink-0 text-[var(--mg-muted)] sm:block" />
          <span className="truncate text-[var(--mg-muted)]" title={albumTitle}>{albumTitle}</span>
          <span className="hidden text-[var(--mg-dim)] sm:inline">/</span>
          <div className="hidden items-center gap-1 sm:flex" aria-label={`Current step: ${stepLabel}`}>
            {(['upload', 'edit', 'export'] as AppStep[]).map((step) => (
              <Badge
                key={step}
                className={step === store.currentStep ? 'border-blue-300/50 text-blue-100' : 'text-[var(--mg-dim)]'}
              >
                {getStepLabel(step)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          {store.currentStep === 'edit' && (
            <>
              <input
                ref={addImagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleAddImages(event.currentTarget.files)}
              />
              <button
                className="mg-button mg-button-soft mg-button-sm gap-1"
                onClick={() => addImagesInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                <span className="hidden sm:inline">เพิ่มรูปภาพ</span>
              </button>
              <IconButton
                label="Open albums"
                onClick={handleOpenAlbums}
              >
                <FolderOpen size={15} />
              </IconButton>
              <button
                className="mg-button mg-button-ghost mg-button-sm gap-1"
                onClick={() => setClearProjectConfirmOpen(true)}
                title="ล้างโปรเจกต์ปัจจุบันและกลับไปหน้าอัปโหลด"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">ล้างโปรเจกต์</span>
              </button>
              <button className="mg-button mg-button-soft mg-button-sm mg-mobile-hidden gap-1" onClick={handleSaveToAlbum}>
                <Save size={14} /> Save
              </button>
              <DropdownMenu
                trigger={(
                  <button className="mg-button mg-button-ai mg-button-sm mg-mobile-hidden gap-1" disabled={store.isProcessing || isBatchProcessing}>
                    <Wand2 size={14} /> AI
                  </button>
                )}
              >
                <DropdownItem onClick={() => requestAI('single')}>
                  แปลหน้านี้
                </DropdownItem>
                {store.imageEntries.length > 1 && (
                  <DropdownItem onClick={() => requestAI('batch')}>
                    แปลทุกหน้า
                  </DropdownItem>
                )}
              </DropdownMenu>
              {isBatchProcessing && (
                <button className="mg-button mg-button-danger mg-button-sm mg-mobile-hidden gap-1" onClick={() => setBatchStopConfirmOpen(true)}>
                  หยุดหลังหน้านี้
                </button>
              )}
              <button className="mg-button mg-button-primary mg-button-sm gap-1 px-2 sm:px-3" onClick={handleContinueToExport}>
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}
          <IconButton
            label="Fonts"
            onClick={() => store.toggleFontConfig(true)}
          >
            <Type size={14} />
          </IconButton>
          <IconButton
            label="Settings"
            onClick={() => store.toggleSettings(true)}
          >
            <Settings size={14} />
          </IconButton>
          <UserMenu />
        </div>
      </div>

      <main className="relative flex-1 overflow-hidden">
        {store.currentStep === 'upload' && (
          <UploadStep
            images={store.images}
            onImagesSelected={store.setImages}
            onGoToEdit={handleGoToEdit}
            onOpenAlbums={handleOpenAlbums}
          />
        )}

        {store.currentStep === 'edit' && (
          <EditStep
            stageRef={stageRef}
            editorRef={editorRef}
            onScaleChange={setCanvasScale}
            onRetryFailedBatchAI={handleRetryFailedBatchAI}
            onRetryAI={handleRetryAI}
            onCancelAI={handleCancelAI}
            retryCount={retryCount}
            isBatchProcessing={isBatchProcessing}
            batchStatus={batchStatus}
          />
        )}

        {store.currentStep === 'export' && (
          <ExportStep
            originalImageUrl={store.originalImageUrl}
            translatedImageUrl={store.translatedImageUrl}
            exportFormat={store.exportFormat}
            exportQuality={store.exportQuality}
            imageEntries={store.imageEntries}
            onExportFormatChange={(f: ExportFormat) => store.setExportFormat(f)}
            onExportQualityChange={store.setExportQuality}
            onExport={handleExport}
            onBack={() => store.setStep('edit')}
          />
        )}
      </main>

      {/* ── Panel toggle bar ── */}
      <PanelToggleBar />

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
      <Modal
        isOpen={aiConfirmTarget !== null}
        onClose={() => setAiConfirmTarget(null)}
        title={aiConfirmTarget === 'batch' ? 'ยืนยันแปลทุกหน้า' : 'ยืนยันแปลหน้านี้'}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--mg-muted)]">
            {aiConfirmTarget === 'batch'
              ? 'ระบบจะเริ่มแปลทุกหน้าที่ยังไม่เสร็จ โดย cleanup หลายหน้าก่อนแล้วแปลทีละหน้า ถ้าหยุดระหว่างทางจะหยุดหลังหน้าปัจจุบันเสร็จ'
              : 'ระบบจะเริ่ม cleanup, OCR และแปลหน้าที่เลือกอยู่ตอนนี้ ระหว่างทำงานสามารถกดยกเลิกงานนี้ได้'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAiConfirmTarget(null)}>
              ยังไม่เริ่ม
            </Button>
            <Button variant="ai" onClick={confirmStartAI}>
              {aiConfirmTarget === 'batch' ? 'เริ่มแปลทุกหน้า' : 'เริ่มแปลหน้านี้'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={batchStopConfirmOpen}
        onClose={() => setBatchStopConfirmOpen(false)}
        title="ยืนยันหยุด Batch AI"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--mg-muted)]">
            ระบบจะไม่เริ่มหน้าถัดไป แต่จะปล่อยให้หน้าที่กำลังทำอยู่ตอนนี้จบก่อนเพื่อป้องกันข้อมูลค้าง
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBatchStopConfirmOpen(false)}>
              ทำต่อ
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                handleStopBatchAI()
                setBatchStopConfirmOpen(false)
              }}
            >
              หยุดหลังหน้านี้
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={clearProjectConfirmOpen}
        onClose={() => setClearProjectConfirmOpen(false)}
        title="ล้างโปรเจกต์นี้?"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--mg-muted)]">
            รูปและการแก้ไขที่ยังไม่ได้บันทึกจะถูกนำออกจาก canvas แล้วกลับไปหน้าอัปโหลด
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setClearProjectConfirmOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                store.resetToUpload()
                setClearProjectConfirmOpen(false)
              }}
            >
              ล้างโปรเจกต์
            </Button>
          </div>
        </div>
      </Modal>
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </div>
  )
}

function getStepLabel(step: AppStep): string {
  if (step === 'upload') return 'อัปโหลด'
  if (step === 'edit') return 'แก้ไข'
  return 'ส่งออก'
}

export default App
