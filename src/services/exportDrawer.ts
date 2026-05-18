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

export function getSmartQualityDefault(format: ExportFormat): ExportQualityPreset {
  return format === 'png' ? 100 : 90
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

export type ExportIntent = 'chat' | 'general' | 'print'

export interface ExportIntentOption {
  value: ExportIntent
  label: string
  hint: string
  format: ExportFormat
  quality: ExportQualityPreset
}

export const EXPORT_INTENT_OPTIONS: ExportIntentOption[] = [
  { value: 'chat', label: 'ส่งแชท / รีวิว', hint: 'ไฟล์เล็ก โหลดเร็ว', format: 'webp', quality: 75 },
  { value: 'general', label: 'ใช้งานทั่วไป', hint: 'สมดุลคุณภาพกับขนาดไฟล์', format: 'jpg', quality: 90 },
  { value: 'print', label: 'ส่งโรงพิมพ์', hint: 'คมชัดสูงสุด ไม่สูญเสียคุณภาพ', format: 'png', quality: 100 },
]

export function resolveExportIntent(format: ExportFormat, quality: number): ExportIntent | null {
  const match = EXPORT_INTENT_OPTIONS.find(
    (option) => option.format === format && (format === 'png' || option.quality === quality),
  )
  return match?.value ?? null
}
