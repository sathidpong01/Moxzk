import { useState } from 'react'
import type Konva from 'konva'
import type { ProcessingMode } from '../../types'
import { useAppStore } from '../../store/appStore'
import type { CanvasEditorHandle } from '../Editor/CanvasEditor'
import ArtboardWorkspace from '../Editor/ArtboardWorkspace'
import ImageStrip from '../Editor/ImageStrip'
import ResourceMonitor from '../Processing/ResourceMonitor'
import ProcessingView from '../Processing/ProcessingView'
import LogPanel from '../Layout/LogPanel'
import PanelToggleBar from '../Layout/PanelToggleBar'
import OcrCorrectionModal from '../Editor/OcrCorrectionModal'
import { Button, DropdownItem, DropdownMenu } from '../ui/primitives'
import type { BatchProgressState } from '../../services/batch-processing'
import { Cpu, Eye, EyeOff, FileSearch, Loader2, MoreHorizontal, RotateCcw, ScrollText } from 'lucide-react'

interface EditStepProps {
  stageRef: React.RefObject<Konva.Stage | null>
  editorRef: React.RefObject<CanvasEditorHandle | null>
  onRetryFailedBatchAI: (mode: ProcessingMode) => void
  onRetryAI: () => void
  onCancelAI: () => void
  processingMode: ProcessingMode
  retryCount: number
  isBatchProcessing: boolean
  batchStatus: BatchProgressState | null
}

export default function EditStep({
  stageRef,
  editorRef,
  onRetryFailedBatchAI,
  onRetryAI,
  onCancelAI,
  processingMode,
  retryCount,
  isBatchProcessing,
  batchStatus,
}: EditStepProps) {
  const store = useAppStore()
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [showFilmstrip, setShowFilmstrip] = useState(true)
  const [viewport, setViewport] = useState({ zoom: 1, imageWidth: 0, imageHeight: 0 })

  const activeEntry = store.imageEntries.find((entry) => entry.id === store.activeImageId)
  const activeFile = activeEntry?.file
  const processRunId = store.processRunId
  const isAiProcessing = store.isProcessing && store.processKind === 'ai'
  const isLoadingImage = store.isProcessing && store.processKind === 'loading'
  const hasMultipleImages = store.imageEntries.length > 1
  const hasFailedPages = store.imageEntries.some((entry) => entry.status === 'error')
  const activePageIndex = Math.max(0, store.imageEntries.findIndex((entry) => entry.id === store.activeImageId))
  const showStatusCluster = isLoadingImage || (isBatchProcessing && batchStatus)

  return (
    <>
      <div className="absolute inset-0">
        {store.imageEntries.length > 0 ? (
          <ArtboardWorkspace
            entries={store.imageEntries}
            stageRef={stageRef}
            editorRef={editorRef}
            onViewportChange={setViewport}
          />
        ) : (
          <div className="studio-canvas flex h-full items-center justify-center">
            <p className="text-lg text-[var(--mg-muted)]">ไม่มีรูปภาพ</p>
          </div>
        )}
      </div>

      {isAiProcessing && activeFile && (
        <div className="studio-canvas absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-full max-w-lg px-4">
            <ProcessingView
              imageFile={activeFile}
              sourceLang={store.settings.sourceLang}
              mode={processingMode}
              settings={store.settings}
              ollamaOptions={{
                ollamaUrl: store.settings.ollamaUrl,
                ollamaModel: store.settings.ollamaModel,
                ollamaApiKey: store.settings.ollamaApiKey,
              }}
              abortSignal={store.processAbortController?.signal}
              onComplete={(regions, cleanedUrl) => store.completeProcess(regions, cleanedUrl, processRunId)}
              onError={(error) => store.setProcessError(error, processRunId)}
              onLog={store.addLog}
              retryCount={retryCount}
            />
            <div className="mt-3 flex justify-center">
              <Button variant="danger" size="sm" onClick={onCancelAI}>
                ยกเลิกงานนี้
              </Button>
            </div>
          </div>
        </div>
      )}

      {!store.isProcessing && store.processError && (
        <div className="floating-panel panel-enter absolute bottom-16 left-1/2 z-20 max-w-sm -translate-x-1/2 px-4 py-3 text-center">
          <p className="mb-2 text-sm font-medium text-[var(--mg-danger)]">{store.processError}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="primary" size="sm" onClick={onRetryAI}>
              <RotateCcw size={12} /> ลองอีกครั้ง
            </Button>
            <Button variant="ghost" size="sm" onClick={() => store.setProcessError(null)}>
              ปิด
            </Button>
          </div>
        </div>
      )}

      <ImageStrip
        isOpen={showFilmstrip}
        showToggle={hasMultipleImages}
        onToggle={() => setShowFilmstrip((value) => !value)}
      />

      <div className="pointer-events-none absolute right-3 top-16 z-20 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-[16px] border border-white/8 bg-[rgba(11,11,12,0.96)] px-3 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur">
          <div className="rounded-[12px] bg-white/[0.04] px-3 py-2 text-right">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-muted)]">หน้า</div>
            <div className="text-sm font-bold text-[var(--mg-text)]">
              {Math.max(1, activePageIndex + 1)}/{Math.max(store.imageEntries.length, 1)}
            </div>
          </div>

          <button
            className={clusterButtonClass()}
            onClick={() => setShowOcrModal(true)}
            disabled={store.regions.length === 0}
          >
            <FileSearch size={14} />
            <span>OCR</span>
          </button>

          <button
            className={clusterButtonClass(store.showTextOverlay)}
            onClick={() => store.toggleTextOverlay()}
          >
            {store.showTextOverlay ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{store.showTextOverlay ? 'ซ่อนข้อความ' : 'แสดงข้อความ'}</span>
          </button>

          {hasFailedPages && (
            <button
              className={clusterButtonClass()}
              onClick={() => onRetryFailedBatchAI(processingMode)}
              disabled={isBatchProcessing}
            >
              {isBatchProcessing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              <span>ลองหน้าที่พลาด</span>
            </button>
          )}

          <DropdownMenu
            trigger={(
              <button className={clusterButtonClass()} aria-label="เพิ่มเติม">
                <MoreHorizontal size={14} />
              </button>
            )}
          >
            {hasMultipleImages && (
              <DropdownItem onClick={() => setShowFilmstrip((value) => !value)}>
                {showFilmstrip ? 'ซ่อนแถบหน้า' : 'แสดงแถบหน้า'}
              </DropdownItem>
            )}
            <DropdownItem onClick={() => store.togglePanel('logs')}>
              <ScrollText size={14} /> {store.panels.logs ? 'ซ่อนบันทึกระบบ' : 'เปิดบันทึกระบบ'}
            </DropdownItem>
            <DropdownItem onClick={() => store.togglePanel('resource')}>
              <Cpu size={14} /> {store.panels.resource ? 'ซ่อนทรัพยากรเครื่อง' : 'เปิดทรัพยากรเครื่อง'}
            </DropdownItem>
          </DropdownMenu>
        </div>

        {showStatusCluster && (
          <div className="pointer-events-auto flex min-w-52 items-center gap-2 rounded-[14px] border border-white/8 bg-[rgba(11,11,12,0.96)] px-3 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur">
            {isLoadingImage && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mg-text)]">
                <Loader2 size={14} className="animate-spin" /> กำลังโหลดหน้า...
              </span>
            )}
            {isBatchProcessing && batchStatus && (
              <div className="min-w-44 flex-1">
                <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-[var(--mg-text)]">
                  <span className="truncate">{batchStatus.message}</span>
                  <span className="shrink-0 text-[var(--mg-muted)]">
                    {batchStatus.currentIndex}/{batchStatus.total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--mg-accent)] transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, batchStatus.progress))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {store.panels.resource && (
        <ResourceMonitor isProcessing={store.isProcessing} />
      )}

      {store.panels.logs && (
        <div className="fixed bottom-16 left-3 z-40 h-52 w-96">
          <LogPanel logs={store.logs} />
        </div>
      )}

      <PanelToggleBar editorRef={editorRef} viewportZoom={viewport.zoom} />

      <OcrCorrectionModal isOpen={showOcrModal} onClose={() => setShowOcrModal(false)} />
    </>
  )
}

function clusterButtonClass(active = false): string {
  return [
    'inline-flex h-10 items-center gap-2 rounded-[12px] px-3 text-sm font-bold transition',
    active
      ? 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)]'
      : 'bg-white/[0.04] text-[var(--mg-text)] hover:bg-white/[0.08]',
  ].join(' ')
}
