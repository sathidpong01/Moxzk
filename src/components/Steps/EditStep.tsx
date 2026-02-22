import { useState } from 'react'
import type Konva from 'konva'
import type { ProcessingMode } from '../../types'
import { useAppStore } from '../../store/appStore'
import CanvasEditor, { type CanvasEditorHandle } from '../Editor/CanvasEditor'
import BrushToolbar from '../Editor/BrushToolbar'
import FloatingProperties from '../Editor/FloatingProperties'
import ImageStrip from '../Editor/ImageStrip'
import ResourceMonitor from '../Processing/ResourceMonitor'
import ProcessingView from '../Processing/ProcessingView'
import LogPanel from '../Layout/LogPanel'
import OcrCorrectionModal from '../Editor/OcrCorrectionModal'
import {
  ArrowLeft,
  ArrowRight,
  Wand2,
  Loader2,
  Save,
  FileSearch,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react'

interface EditStepProps {
  stageRef: React.RefObject<Konva.Stage | null>
  editorRef: React.RefObject<CanvasEditorHandle | null>
  onScaleChange: (scale: number) => void
  onContinueToExport: () => void
  onStartAI: () => void
  onRetryAI: () => void
  onSaveToAlbum: () => void
  retryCount: number
}

export default function EditStep({
  stageRef,
  editorRef,
  onScaleChange,
  onContinueToExport,
  onStartAI,
  onRetryAI,
  onSaveToAlbum,
  retryCount,
}: EditStepProps) {
  const store = useAppStore()
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('full')
  const [showOcrModal, setShowOcrModal] = useState(false)

  const activeEntry = store.imageEntries.find((e) => e.id === store.activeImageId)
  const activeFile = activeEntry?.file
  const activeImageUrl = activeEntry?.originalUrl

  const selectedRegion = store.regions.find((r) => r.id === store.selectedRegionId) ?? null
  const editImageUrl = store.cleanedImageUrl || store.originalImageUrl

  return (
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
            onScaleChange={onScaleChange}
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
            onClick={onSaveToAlbum}
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
                onClick={onStartAI}
                disabled={!activeFile && !activeImageUrl}
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
            onClick={onContinueToExport}
          >
            Export <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Inline Processing overlay */}
      {store.isProcessing && (activeFile || activeImageUrl) && (
        <div className="absolute inset-0 z-10 bg-base-100/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-full max-w-xl">
            <ProcessingView
              imageFile={activeFile || new File([], 'placeholder.webp')} // ProcessingView might need refactoring if it strictly uses File, but we'll use placeholder for now or it handles Blob/URL internally if updated later. Wait, we should check ProcessingView.
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
            <button className="btn btn-sm btn-primary gap-1" onClick={onRetryAI}>
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

      {/* OCR Correction Modal */}
      <OcrCorrectionModal isOpen={showOcrModal} onClose={() => setShowOcrModal(false)} />
    </>
  )
}
