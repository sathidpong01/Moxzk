import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { useAppStore } from './store/appStore'
import type { ExportFormat } from './types'
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
import { Button, DropdownItem, DropdownMenu, IconButton, Modal, SelectField } from './components/ui/primitives'
import { Toaster } from 'sonner'
import { BookOpen, Download, FolderOpen, ImagePlus, MoreHorizontal, RotateCcw, Save, Settings, Type, Wand2 } from 'lucide-react'
import type { ProcessingMode } from './types'

// ── Main App ─────────────────────────────────────────────────────────

const AI_MODE_OPTIONS: Array<{ value: ProcessingMode; label: string }> = [
  { value: 'gemma_vision_full', label: 'Gemma อ่าน+แปล' },
  { value: 'clean_only', label: 'คลีนอย่างเดียว' },
]

function App() {
  const store = useAppStore()
  const albumStore = useAlbumStore()
  const stageRef = useRef<Konva.Stage>(null)
  const editorRef = useRef<CanvasEditorHandle>(null)
  const addImagesInputRef = useRef<HTMLInputElement>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [aiConfirmTarget, setAiConfirmTarget] = useState<'single' | 'batch' | null>(null)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('gemma_vision_full')
  const [batchStopConfirmOpen, setBatchStopConfirmOpen] = useState(false)
  const [clearProjectConfirmOpen, setClearProjectConfirmOpen] = useState(false)
  const albumTitle = albumStore.currentAlbum?.title?.trim() || 'โปรเจกต์ใหม่'
  const activePageIndex = Math.max(0, store.imageEntries.findIndex((entry) => entry.id === store.activeImageId))
  const headerStatus = getHeaderStatus({
    step: store.currentStep,
    queuedImages: store.images.length,
    pageCount: store.imageEntries.length,
    activePageIndex,
    regions: store.regions.length,
    strokes: store.brushStrokes.length,
  })

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
      handleStartBatchAI(processingMode)
    }
    setAiConfirmTarget(null)
  }

  return (
    <div className="studio-shell relative h-screen overflow-hidden">
      <header className="pointer-events-none fixed left-3 right-3 top-3 z-50 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <div className="floating-panel-sm mg-header-panel pointer-events-auto flex w-fit max-w-full min-w-0 items-center gap-2 overflow-hidden px-3 py-2">
          <BookOpen size={16} className="hidden shrink-0 text-[var(--mg-muted)] sm:block" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--mg-text)]" title={albumTitle}>{albumTitle}</div>
            <div className="hidden truncate text-[11px] font-bold text-[var(--mg-muted)] min-[420px]:block">{headerStatus}</div>
          </div>
        </div>

        <div className="floating-panel-sm mg-header-panel pointer-events-auto flex min-w-0 max-w-full shrink-0 items-center justify-self-end gap-1 px-2 py-2 sm:gap-2">
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
                <span className="hidden sm:inline">เพิ่มหน้า</span>
              </button>
              <button className="mg-button mg-button-soft mg-button-sm mg-mobile-hidden gap-1" onClick={handleSaveToAlbum}>
                <Save size={14} /> บันทึก
              </button>
              <SelectField
                value={processingMode}
                onChange={setProcessingMode}
                buttonClassName="h-8 min-h-8 w-40 py-0 text-xs"
                className="hidden lg:block"
                options={AI_MODE_OPTIONS}
              />
              <DropdownMenu
                trigger={(
                  <button className="mg-button mg-button-ai mg-button-sm gap-1" disabled={store.isProcessing || isBatchProcessing}>
                    <Wand2 size={14} /> <span className="hidden sm:inline">AI อ่าน+แปล</span>
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
                <span className="hidden sm:inline">ส่งออก</span>
              </button>
              <DropdownMenu
                trigger={(
                  <button className="mg-button mg-button-ghost mg-button-sm gap-1">
                    <MoreHorizontal size={14} />
                    <span className="hidden lg:inline">เพิ่มเติม</span>
                  </button>
                )}
              >
                <DropdownItem onClick={handleOpenAlbums}>
                  <FolderOpen size={14} /> เปิดอัลบั้ม
                </DropdownItem>
                <DropdownItem onClick={() => store.toggleFontConfig(true)}>
                  <Type size={14} /> ฟอนต์
                </DropdownItem>
                <DropdownItem onClick={() => store.toggleSettings(true)}>
                  <Settings size={14} /> ตั้งค่า
                </DropdownItem>
                {AI_MODE_OPTIONS.map((option) => (
                  <DropdownItem key={option.value} onClick={() => setProcessingMode(option.value)}>
                    <Wand2 size={14} /> {processingMode === option.value ? 'ใช้โหมด: ' : 'โหมด: '}{option.label}
                  </DropdownItem>
                ))}
                <DropdownItem className="text-red-200" onClick={() => setClearProjectConfirmOpen(true)}>
                  <RotateCcw size={14} /> ล้างโปรเจกต์
                </DropdownItem>
              </DropdownMenu>
            </>
          )}
          {store.currentStep !== 'edit' && (
            <>
              <IconButton
                label="เปิดอัลบั้ม"
                onClick={handleOpenAlbums}
              >
                <FolderOpen size={15} />
              </IconButton>
              <IconButton
                label="ฟอนต์"
                onClick={() => store.toggleFontConfig(true)}
              >
                <Type size={14} />
              </IconButton>
              <IconButton
                label="ตั้งค่า"
                onClick={() => store.toggleSettings(true)}
              >
                <Settings size={14} />
              </IconButton>
            </>
          )}
          <UserMenu />
        </div>
      </header>

      <main className="relative h-full overflow-hidden">
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
            processingMode={processingMode}
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
      <Toaster position="top-right" theme="dark" richColors closeButton toastOptions={{ className: 'mt-12' }} />
    </div>
  )
}

function getHeaderStatus({
  step,
  queuedImages,
  pageCount,
  activePageIndex,
  regions,
  strokes,
}: {
  step: 'upload' | 'edit' | 'export'
  queuedImages: number
  pageCount: number
  activePageIndex: number
  regions: number
  strokes: number
}): string {
  if (step === 'upload') {
    return queuedImages > 0 ? `${queuedImages} หน้าในคิว` : 'ลากรูป วางจากคลิปบอร์ด หรือเปิดจากอัลบั้ม'
  }
  if (step === 'export') {
    return `${Math.max(pageCount, 1)} หน้า · ตรวจไฟล์ก่อนดาวน์โหลด`
  }
  const pageText = pageCount > 1 ? `หน้า ${activePageIndex + 1}/${pageCount}` : 'หน้าเดียว'
  return `${pageText} · ${regions} กล่องข้อความ · ${strokes} สโตรกแปรง`
}

export default App
