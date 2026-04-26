import type { ExportFormat } from '../types'
import type { RuntimeExportDestination } from '../runtime'

export type ExportPreviewMode = 'after' | 'slider' | 'side-by-side' | 'overlay'

export const DEFAULT_EXPORT_DESTINATION = 'zip' satisfies RuntimeExportDestination

export const EXPORT_PREVIEW_MODE_OPTIONS: Array<{ value: ExportPreviewMode; label: string }> = [
  { value: 'after', label: 'After' },
  { value: 'slider', label: 'สไลด์' },
  { value: 'side-by-side', label: 'วางคู่' },
  { value: 'overlay', label: 'ซ้อนภาพ' },
]

export const EXPORT_FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
]

export const EXPORT_DESTINATION_OPTIONS: Array<{ value: RuntimeExportDestination; label: string }> = [
  { value: 'zip', label: 'บันทึกเป็น ZIP' },
  { value: 'folder', label: 'บันทึกลงโฟลเดอร์' },
]

export const EXPORT_QUALITY_PRESETS = [50, 75, 90, 100] as const

export type ExportQualityPreset = (typeof EXPORT_QUALITY_PRESETS)[number]

export function supportsExportQuality(format: ExportFormat): boolean {
  return format !== 'png'
}

export function isExportQualityPreset(value: number): value is ExportQualityPreset {
  return EXPORT_QUALITY_PRESETS.includes(value as ExportQualityPreset)
}

export function normalizeExportQualityPreset(value: number): ExportQualityPreset {
  return EXPORT_QUALITY_PRESETS.reduce<ExportQualityPreset>((best, candidate) => {
    const candidateDistance = Math.abs(candidate - value)
    const bestDistance = Math.abs(best - value)
    if (candidateDistance < bestDistance) return candidate
    if (candidateDistance > bestDistance) return best
    return candidate > best ? candidate : best
  }, EXPORT_QUALITY_PRESETS[0])
}
