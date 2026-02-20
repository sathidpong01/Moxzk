import type { ExportFormat } from '../../types'
import SplitView from '../Comparison/SplitView'
import { ArrowLeft, Download } from 'lucide-react'

interface ExportStepProps {
  originalImageUrl: string | null
  translatedImageUrl: string | null
  exportFormat: ExportFormat
  exportQuality: number
  onExportFormatChange: (format: ExportFormat) => void
  onExportQualityChange: (quality: number) => void
  onExport: () => void
  onBack: () => void
}

export default function ExportStep({
  originalImageUrl,
  translatedImageUrl,
  exportFormat,
  exportQuality,
  onExportFormatChange,
  onExportQualityChange,
  onExport,
  onBack,
}: ExportStepProps) {
  return (
    <div className="h-full flex gap-3 p-3">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {originalImageUrl && translatedImageUrl && (
          <SplitView
            originalImageUrl={originalImageUrl}
            translatedImageUrl={translatedImageUrl}
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
                value={exportFormat}
                onChange={(e) => onExportFormatChange(e.target.value as ExportFormat)}
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpg">JPG (smaller file)</option>
                <option value="webp">WebP (best balance)</option>
              </select>
            </div>
            {exportFormat !== 'png' && (
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-sm">Quality: {exportQuality}%</span>
                </label>
                <input
                  type="range"
                  className="range range-primary range-sm"
                  min={10}
                  max={100}
                  value={exportQuality}
                  onChange={(e) => onExportQualityChange(Number(e.target.value))}
                />
              </div>
            )}
            <button className="btn btn-primary w-full gap-2" onClick={onExport}>
              <Download size={16} /> Download
            </button>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm gap-1"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> Back to Editor
        </button>
      </div>
    </div>
  )
}
