import { useEffect, useMemo, useState } from 'react'
import type Konva from 'konva'
import type { ProcessingMode } from '../../types'
import { useAppStore } from '../../store/appStore'
import type { CanvasEditorHandle } from '../Editor/CanvasEditor'
import ArtboardWorkspace, { type ArtboardProcessCard } from '../Editor/ArtboardWorkspace'
import ImageStrip from '../Editor/ImageStrip'
import ResourceMonitor from '../Processing/ResourceMonitor'
import ProcessingView, { type ProcessingViewStatus } from '../Processing/ProcessingView'
import LogPanel from '../Layout/LogPanel'
import PanelToggleBar from '../Layout/PanelToggleBar'
import OcrCorrectionModal from '../Editor/OcrCorrectionModal'
import { DropdownItem, DropdownMenu, TooltipSurface } from '../ui/primitives'
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
  const [viewport, setViewport] = useState({ zoom: 1, zoomPercent: 100, imageWidth: 0, imageHeight: 0 })
  const [singleProcessStatus, setSingleProcessStatus] = useState<ProcessingViewStatus | null>(null)

  const activeEntry = store.imageEntries.find((entry) => entry.id === store.activeImageId)
  const activeFile = activeEntry?.file
  const processRunId = store.processRunId
  const isAiProcessing = store.isProcessing && store.processKind === 'ai'
  const isLoadingImage = store.isProcessing && store.processKind === 'loading'
  const hasMultipleImages = store.imageEntries.length > 1
  const hasFailedPages = store.imageEntries.some((entry) => entry.status === 'error')
  const activePageIndex = Math.max(0, store.imageEntries.findIndex((entry) => entry.id === store.activeImageId))
  const showStatusCluster = isLoadingImage || (isBatchProcessing && batchStatus)
  const activeProcessCard = useMemo<ArtboardProcessCard | null>(() => {
    if (isAiProcessing && activeFile) {
      return {
        type: 'running',
        label: singleProcessStatus?.label ?? 'กำลังประมวลผล',
        message: singleProcessStatus?.state.message ?? 'กำลังเตรียมงาน...',
        progress: singleProcessStatus?.state.progress ?? 0,
        actionLabel: 'ยกเลิกงานนี้',
        onAction: onCancelAI,
      }
    }

    if (!store.isProcessing && store.processError && activeEntry?.status === 'error') {
      return {
        type: 'error',
        label: 'ประมวลผลไม่สำเร็จ',
        message: store.processError,
        actionLabel: 'ลองอีกครั้ง',
        onAction: onRetryAI,
        secondaryActionLabel: 'ปิด',
        onSecondaryAction: () => store.setProcessError(null),
      }
    }

    return null
  }, [
    activeEntry?.status,
    activeFile,
    isAiProcessing,
    onCancelAI,
    onRetryAI,
    singleProcessStatus,
    store,
  ])

  useEffect(() => {
    if (!isAiProcessing) setSingleProcessStatus(null)
  }, [isAiProcessing])

  return (
    <>
      <div className="absolute inset-0">
        {store.imageEntries.length > 0 ? (
          <ArtboardWorkspace
            entries={store.imageEntries}
            stageRef={stageRef}
            editorRef={editorRef}
            onViewportChange={setViewport}
            activeProcessCard={activeProcessCard}
          />
        ) : (
          <div className="studio-canvas flex h-full items-center justify-center">
            <p className="text-lg text-[var(--moxzk-muted)]">ไม่มีรูปภาพ</p>
          </div>
        )}
      </div>

      {isAiProcessing && activeFile && (
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
          presentation="runner"
          onStatusChange={setSingleProcessStatus}
        />
      )}

      <ImageStrip
        isOpen={showFilmstrip}
        showToggle={hasMultipleImages}
        onToggle={() => setShowFilmstrip((value) => !value)}
      />

      <div className="pointer-events-none absolute right-3 top-[4.75rem] z-20 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-[14px] bg-[rgba(10,10,11,0.78)] p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <TooltipSurface label="หน้าปัจจุบัน">
            <div className="flex h-9 min-w-14 flex-col items-center justify-center rounded-[10px] bg-black/[0.34] px-2 text-center">
              <span className="text-[10px] font-bold leading-none text-[var(--moxzk-muted)]">หน้า</span>
              <span className="mt-0.5 text-[13px] font-black leading-none text-[var(--moxzk-text)]">
                {Math.max(1, activePageIndex + 1)}/{Math.max(store.imageEntries.length, 1)}
              </span>
            </div>
          </TooltipSurface>

          <button
            className={clusterButtonClass()}
            onClick={() => setShowOcrModal(true)}
            disabled={store.regions.length === 0}
          >
            <FileSearch size={14} />
            <span className="hidden sm:inline">ข้อความ</span>
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
              <ScrollText size={14} /> {store.panels.logs ? 'ซ่อนรายงานการทำงาน' : 'เปิดรายงานการทำงาน'}
            </DropdownItem>
            <DropdownItem onClick={() => store.togglePanel('resource')}>
              <Cpu size={14} /> {store.panels.resource ? 'ซ่อนทรัพยากรเครื่อง' : 'เปิดทรัพยากรเครื่อง'}
            </DropdownItem>
          </DropdownMenu>
        </div>

        {showStatusCluster && (
          <div className="pointer-events-auto flex min-w-52 items-center gap-2 rounded-[12px] bg-[rgba(10,10,11,0.78)] px-3 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            {isLoadingImage && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--moxzk-text)]">
                <Loader2 size={14} className="animate-spin" /> กำลังโหลดหน้า...
              </span>
            )}
            {isBatchProcessing && batchStatus && (
              <div className="min-w-44 flex-1">
                <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-[var(--moxzk-text)]">
                  <span className="truncate">{batchStatus.message}</span>
                  <span className="shrink-0 text-[var(--moxzk-muted)]">
                    {batchStatus.currentIndex}/{batchStatus.total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--moxzk-accent)] transition-all"
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

      <PanelToggleBar editorRef={editorRef} viewportZoomPercent={viewport.zoomPercent} />

      <OcrCorrectionModal isOpen={showOcrModal} onClose={() => setShowOcrModal(false)} />
    </>
  )
}

function clusterButtonClass(active = false): string {
  return [
    'inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm font-bold transition',
    active
      ? 'bg-[var(--moxzk-accent)] text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)] hover:bg-[var(--moxzk-accent)]'
      : 'bg-white/[0.055] text-[var(--moxzk-text)] hover:bg-white/[0.1]',
  ].join(' ')
}
