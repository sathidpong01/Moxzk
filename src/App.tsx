import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { useAppStore } from './store/appStore'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useEditorActions } from './hooks/useEditorActions'
import { useAuthStore } from './store/authStore'
import { useAlbumStore } from './store/albumStore'
import type { CanvasEditorHandle } from './components/Editor/CanvasEditor'
import AuthModal from './components/Auth/AuthModal'
import UserMenu from './components/Auth/UserMenu'
import AlbumListModal from './components/Albums/AlbumListModal'
import ExportDrawer from './components/Editor/ExportDrawer'
import UploadStep from './components/Steps/UploadStep'
import EditStep from './components/Steps/EditStep'
import SettingsPanel from './components/Settings/SettingsPanel'
import FontConfigPage from './components/Settings/FontConfigPage'
import AppChromeBar from './components/Layout/AppChromeBar'
import WorkspaceBackdrop from './components/Layout/WorkspaceBackdrop'
import { Button, DropdownItem, DropdownMenu, IconButton, Modal, SelectField } from './components/ui/primitives'
import { getAppRuntime } from './runtime'
import { Toaster } from 'sonner'
import { BookOpen, ChevronDown, Download, FolderOpen, ImagePlus, MoreHorizontal, RotateCcw, Save, Settings, Type, Wand2 } from 'lucide-react'
import type { ProcessingMode } from './types'

// ── Main App ─────────────────────────────────────────────────────────

const AI_MODE_OPTIONS: Array<{ value: ProcessingMode; label: string }> = [
  { value: 'gemma_vision_full', label: 'คลีน+แปล' },
  { value: 'clean_only', label: 'คลีนอย่างเดียว' },
]

function App() {
  const store = useAppStore()
  const albumStore = useAlbumStore()
  const stageRef = useRef<Konva.Stage>(null)
  const editorRef = useRef<CanvasEditorHandle>(null)
  const addImagesInputRef = useRef<HTMLInputElement>(null)
  const [aiConfirmTarget, setAiConfirmTarget] = useState<'single' | 'batch' | null>(null)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('gemma_vision_full')
  const [batchStopConfirmOpen, setBatchStopConfirmOpen] = useState(false)
  const [clearProjectConfirmOpen, setClearProjectConfirmOpen] = useState(false)
  const [exportDrawerOpen, setExportDrawerOpen] = useState(false)
  const appRuntime = getAppRuntime()
  const hasCustomChrome = appRuntime.kind === 'electron' && appRuntime.capabilities.canUseCustomWindowControls
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
  useEffect(() => {
    if (store.currentStep !== 'edit') {
      setExportDrawerOpen(false)
    }
  }, [store.currentStep])
  // Consolidated editor action callbacks
  const {
    retryCount,
    handleGoToEdit,
    handleOpenExportDrawer,
    handleExport,
    handleStartAI,
    handleStartBatchAI,
    handleRetryFailedBatchAI,
    handleStopBatchAI,
    handleCancelAI,
    handleRetryAI,
    handleSaveToAlbum,
    handleSaveAsAlbum,
    isBatchProcessing,
    batchStatus,
  } = useEditorActions({
    onOpenExportDrawer: () => setExportDrawerOpen(true),
  })

  const requestAI = (target: 'single' | 'batch') => {
    if (store.isProcessing || isBatchProcessing) return
    setAiConfirmTarget(target)
  }

  // Auto-save draft every 30s while editing
  useAutoSave(30_000)
  // Global keyboard shortcuts (Ctrl+Z, B, E, etc.)
  useKeyboardShortcuts({
    onSave: handleSaveToAlbum,
    onExport: handleOpenExportDrawer,
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
    <div className={`studio-shell relative isolate h-screen overflow-hidden ${hasCustomChrome ? 'moxzk-has-custom-chrome' : ''}`}>
      <WorkspaceBackdrop />
      <header className="moxzk-app-chrome fixed left-3 right-3 top-3 z-50 flex min-w-0 items-center gap-3">
        <div className="moxzk-project-chip moxzk-window-no-drag flex max-w-[min(22rem,45vw)] min-w-0 items-center gap-2 overflow-hidden px-3 py-2">
          <BookOpen size={16} className="hidden shrink-0 text-[var(--moxzk-muted)] sm:block" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--moxzk-text)]" title={albumTitle}>{albumTitle}</div>
            <div className="hidden truncate text-[11px] font-bold text-[var(--moxzk-muted)] min-[420px]:block">{headerStatus}</div>
          </div>
        </div>

        <div className="moxzk-chrome-drag flex min-w-6 flex-1 self-stretch" aria-hidden="true" />

        <div className="moxzk-command-dock moxzk-window-no-drag flex min-w-0 max-w-full shrink-0 items-center justify-self-end gap-1 px-2 py-2 sm:gap-2">
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
                className="moxzk-button moxzk-button-soft moxzk-button-sm gap-1"
                onClick={() => addImagesInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                <span className="hidden sm:inline">เพิ่มรูป</span>
              </button>
              <div className="moxzk-split-button moxzk-mobile-hidden">
                <button className="moxzk-button moxzk-button-soft moxzk-button-sm gap-1 rounded-r-none border-r-0" onClick={handleSaveToAlbum}>
                  <Save size={14} /> บันทึก
                </button>
                <DropdownMenu
                  trigger={(
                    <button className="moxzk-button moxzk-button-soft moxzk-button-sm rounded-l-none px-2" aria-label="ตัวเลือกการบันทึก">
                      <ChevronDown size={13} />
                    </button>
                  )}
                >
                  <DropdownItem onClick={handleSaveAsAlbum}>
                    <Save size={14} /> บันทึกเป็น
                  </DropdownItem>
                </DropdownMenu>
              </div>
              <SelectField
                value={processingMode}
                onChange={setProcessingMode}
                buttonClassName="h-8 min-h-8 w-40 py-0 text-xs"
                className="hidden lg:block"
                options={AI_MODE_OPTIONS}
              />
              <DropdownMenu
                trigger={(
                  <button className="moxzk-button moxzk-button-ai moxzk-button-sm gap-1" disabled={store.isProcessing || isBatchProcessing}>
                    <Wand2 size={14} /> <span className="hidden sm:inline">AI แปล</span>
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
                <button className="moxzk-button moxzk-button-danger moxzk-button-sm moxzk-mobile-hidden gap-1" onClick={() => setBatchStopConfirmOpen(true)}>
                  หยุดหลังหน้านี้
                </button>
              )}
              <button className="moxzk-button moxzk-button-primary moxzk-button-sm gap-1 px-2 sm:px-3" onClick={handleOpenExportDrawer}>
                <Download size={14} />
                <span className="hidden sm:inline">ส่งออก</span>
              </button>
              <DropdownMenu
                trigger={(
                  <button className="moxzk-button moxzk-button-ghost moxzk-button-sm px-2" aria-label="เพิ่มเติม">
                    <MoreHorizontal size={14} />
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
          <AppChromeBar />
        </div>
      </header>

      <main className="relative z-10 h-full overflow-hidden">
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
            onRetryFailedBatchAI={handleRetryFailedBatchAI}
            onRetryAI={handleRetryAI}
            onCancelAI={handleCancelAI}
            processingMode={processingMode}
            retryCount={retryCount}
            isBatchProcessing={isBatchProcessing}
            batchStatus={batchStatus}
          />
        )}

      </main>

      {store.currentStep === 'edit' && exportDrawerOpen && (
        <ExportDrawer
          isOpen={exportDrawerOpen}
          activeImageId={store.activeImageId}
          exportFormat={store.exportFormat}
          exportQuality={store.exportQuality}
          imageEntries={store.imageEntries}
          onClose={() => setExportDrawerOpen(false)}
          onExportFormatChange={store.setExportFormat}
          onExportQualityChange={store.setExportQuality}
          onExport={handleExport}
        />
      )}

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
          <p className="text-sm leading-6 text-[var(--moxzk-muted)]">
            {aiConfirmTarget === 'batch'
              ? 'ระบบจะคลีนและแปลทุกหน้าที่ยังไม่เสร็จ ถ้าหยุดระหว่างทางจะหยุดหลังหน้าปัจจุบันเสร็จ'
              : 'ระบบจะคลีน OCR และแปลหน้าที่เลือกอยู่ตอนนี้ ระหว่างทำงานสามารถกดยกเลิกงานนี้ได้'}
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
          <p className="text-sm leading-6 text-[var(--moxzk-muted)]">
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
          <p className="text-sm leading-6 text-[var(--moxzk-muted)]">
            รูปและการแก้ไขที่ยังไม่ได้บันทึกจะถูกนำออกจาก canvas แล้วกลับไปหน้าอัปโหลด
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setClearProjectConfirmOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setExportDrawerOpen(false)
                store.resetToUpload()
                setClearProjectConfirmOpen(false)
              }}
            >
              ล้างโปรเจกต์
            </Button>
          </div>
        </div>
      </Modal>
      <Toaster
        position="top-right"
        theme="dark"
        closeButton
        toastOptions={{
          className: 'mt-12',
          style: {
            background: 'var(--moxzk-surface-2)',
            borderColor: 'var(--moxzk-border)',
            color: 'var(--moxzk-text)',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.3)',
          },
        }}
      />
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
  step: 'upload' | 'edit'
  queuedImages: number
  pageCount: number
  activePageIndex: number
  regions: number
  strokes: number
}): string {
  if (step === 'upload') {
    return queuedImages > 0 ? `${queuedImages} หน้าในคิว` : 'ลากรูป วางจากคลิปบอร์ด หรือเปิดจากอัลบั้ม'
  }
  const pageText = pageCount > 1 ? `หน้า ${activePageIndex + 1}/${pageCount}` : 'หน้าเดียว'
  return `${pageText} · ${regions} ข้อความ · ${strokes} รอยแปรง`
}

export default App
