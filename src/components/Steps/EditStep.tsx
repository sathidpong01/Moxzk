import { useState } from 'react'
import type Konva from 'konva'
import type { ProcessingMode } from '../../types'
import { useAppStore } from '../../store/appStore'
import CanvasEditor, { type CanvasEditorHandle } from '../Editor/CanvasEditor'
import ArtboardWorkspace from '../Editor/ArtboardWorkspace'
import BrushToolbar from '../Editor/BrushToolbar'
import FloatingProperties from '../Editor/FloatingProperties'
import ImageStrip from '../Editor/ImageStrip'
import ResourceMonitor from '../Processing/ResourceMonitor'
import ProcessingView from '../Processing/ProcessingView'
import LogPanel from '../Layout/LogPanel'
import OcrCorrectionModal from '../Editor/OcrCorrectionModal'
import { Button, SelectField } from '../ui/primitives'
import type { BatchProgressState } from '../../services/batch-processing'
import {
  Loader2,
  FileSearch,
  Eye,
  EyeOff,
  RotateCcw,
  Images,
} from 'lucide-react'

interface EditStepProps {
  stageRef: React.RefObject<Konva.Stage | null>
  editorRef: React.RefObject<CanvasEditorHandle | null>
  onScaleChange: (scale: number) => void
  onRetryFailedBatchAI: (mode: ProcessingMode) => void
  onRetryAI: () => void
  onCancelAI: () => void
  retryCount: number
  isBatchProcessing: boolean
  batchStatus: BatchProgressState | null
}

export default function EditStep({
  stageRef,
  editorRef,
  onScaleChange,
  onRetryFailedBatchAI,
  onRetryAI,
  onCancelAI,
  retryCount,
  isBatchProcessing,
  batchStatus,
}: EditStepProps) {
  const store = useAppStore()
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('gemma_vision_full')
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [showArtboards, setShowArtboards] = useState(true)
  const [showFilmstrip, setShowFilmstrip] = useState(true)
  const [viewport, setViewport] = useState({ zoom: 1, imageWidth: 0, imageHeight: 0 })

  const activeEntry = store.imageEntries.find((e) => e.id === store.activeImageId)
  const activeFile = activeEntry?.file
  const processRunId = store.processRunId
  const isAiProcessing = store.isProcessing && store.processKind === 'ai'
  const isLoadingImage = store.isProcessing && store.processKind === 'loading'
  const hasMultipleImages = store.imageEntries.length > 1

  const selectedRegion = store.regions.find((r) => r.id === store.selectedRegionId) ?? null
  const editImageUrl = store.cleanedImageUrl || store.originalImageUrl
  const hasFailedPages = store.imageEntries.some((entry) => entry.status === 'error')

  return (
    <>
      {/* Full-bleed Canvas */}
      <div className="absolute inset-0">
        {hasMultipleImages && showArtboards ? (
          <ArtboardWorkspace
            entries={store.imageEntries}
            stageRef={stageRef}
            editorRef={editorRef}
            onViewportChange={setViewport}
          />
        ) : editImageUrl ? (
          <CanvasEditor
            imageUrl={editImageUrl}
            regions={store.regions}
            onRegionUpdate={store.updateRegion}
            onSelectedRegion={store.selectRegion}
            stageRef={stageRef}
            onScaleChange={onScaleChange}
            onViewportChange={setViewport}
            editorRef={editorRef}
          />
        ) : (
          <div className="h-full flex items-center justify-center dot-canvas">
            <p className="text-lg text-[var(--mg-muted)]">ไม่มีรูปภาพ</p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-20">
        <div className="pointer-events-auto flex items-center gap-2 rounded-[8px] border border-[var(--mg-border)] bg-black/45 p-1 backdrop-blur">
          <span className="hidden rounded px-2 text-xs text-[var(--mg-muted)] sm:inline">
            {store.regions.length} regions · {store.brushStrokes.length} strokes
          </span>
          {hasMultipleImages && (
            <>
              <Button
                variant={showArtboards ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowArtboards((value) => !value)}
                title={showArtboards ? 'Focus mode' : 'Artboard mode'}
              >
                <Images size={14} /> Artboards
              </Button>
            </>
          )}
          {store.regions.length > 0 && !isAiProcessing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOcrModal(true)}
                title="ตรวจสอบ OCR"
              >
                <FileSearch size={14} /> OCR
              </Button>
              <button
                className={`mg-icon-button h-8 w-8 ${!store.showTextOverlay ? 'opacity-50' : ''}`}
                onClick={() => store.toggleTextOverlay()}
                aria-label={store.showTextOverlay ? 'ซ่อนข้อความ' : 'แสดงข้อความ'}
                title={store.showTextOverlay ? 'ซ่อนข้อความ' : 'แสดงข้อความ'}
              >
                {store.showTextOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </>
          )}
          {!isAiProcessing && (
            <div className="flex min-w-0 items-center gap-1">
              <SelectField
                value={processingMode}
                onChange={setProcessingMode}
                buttonClassName="h-8 min-h-8 w-40 py-0 text-xs"
                options={[
                  { value: 'gemma_vision_full', label: 'Gemma อ่าน+แปล' },
                  { value: 'full', label: 'OCR fallback' },
                  { value: 'clean_only', label: 'คลีนอย่างเดียว' },
                  { value: 'ocr_only', label: 'OCR อย่างเดียว' },
                ]}
              />
              {hasFailedPages && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetryFailedBatchAI(processingMode)}
                  disabled={isBatchProcessing}
                >
                  Retry failed
                </Button>
              )}
            </div>
          )}
          {isAiProcessing && (
            <span className="mg-button mg-button-soft mg-button-sm gap-1 opacity-70">
              <Loader2 size={14} className="animate-spin" /> Processing...
            </span>
          )}
          {isLoadingImage && (
            <span className="mg-button mg-button-soft mg-button-sm gap-1 opacity-70">
              <Loader2 size={14} className="animate-spin" /> กำลังโหลดรูป...
            </span>
          )}
          {isBatchProcessing && batchStatus && (
            <div className="min-w-52 rounded-[7px] border border-[var(--mg-border)] bg-black/35 px-2 py-1">
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
          {isBatchProcessing && !batchStatus && (
            <span className="mg-button mg-button-soft mg-button-sm opacity-70">กำลังเตรียม Batch...</span>
          )}
        </div>
      </div>

      {/* Inline Processing overlay */}
      {isAiProcessing && activeFile && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--mg-bg)]">
          <div className="w-full max-w-xl">
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
              onError={(e) => store.setProcessError(e, processRunId)}
              onLog={store.addLog}
              retryCount={retryCount}
            />
            <div className="mt-4 flex justify-center">
              <Button variant="danger" size="sm" onClick={onCancelAI}>
                ยกเลิกงานนี้
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error retry overlay */}
      {!store.isProcessing && store.processError && (
        <div className="floating-panel panel-enter absolute bottom-16 left-1/2 z-20 max-w-sm -translate-x-1/2 px-4 py-3 text-center">
          <p className="mb-2 text-sm font-medium text-[var(--mg-danger)]">{store.processError}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="primary" size="sm" onClick={onRetryAI}>
              <RotateCcw size={12} /> Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => store.setProcessError(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-40 hidden items-center gap-3 rounded-[8px] border border-[var(--mg-border)] bg-black/45 px-3 py-2 text-xs font-bold text-[var(--mg-muted)] backdrop-blur sm:flex">
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <span className="h-4 w-px bg-[var(--mg-border)]" />
        <span>{viewport.imageWidth || 0} × {viewport.imageHeight || 0} px</span>
      </div>

      {/* Multi-image thumbnail strip */}
      <ImageStrip isOpen={showFilmstrip} onToggle={() => setShowFilmstrip((value) => !value)} />

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
        <div className="fixed bottom-16 left-3 z-40 h-52 w-96">
          <LogPanel logs={store.logs} />
        </div>
      )}

      {/* OCR Correction Modal */}
      <OcrCorrectionModal isOpen={showOcrModal} onClose={() => setShowOcrModal(false)} />
    </>
  )
}
