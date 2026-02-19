/**
 * Client-side file validation — magic bytes + size check.
 * Prevents invalid files from being uploaded or processed.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const ALLOWED_MAGIC: { mime: string; bytes: number[] }[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
]

export interface ValidationResult {
  valid: boolean
  error?: string
}

export async function validateImageFile(file: File): Promise<ValidationResult> {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return { valid: false, error: `ไฟล์ใหญ่เกิน 50MB (${sizeMB}MB)` }
  }

  if (file.size === 0) {
    return { valid: false, error: 'ไฟล์ว่างเปล่า' }
  }

  // Magic bytes check
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const isValidType = ALLOWED_MAGIC.some(({ bytes }) =>
    bytes.every((b, i) => header[i] === b),
  )

  if (!isValidType) {
    return { valid: false, error: 'รองรับเฉพาะ PNG, JPG, WebP เท่านั้น' }
  }

  return { valid: true }
}

export async function validateImageFiles(files: File[]): Promise<ValidationResult> {
  for (const file of files) {
    const result = await validateImageFile(file)
    if (!result.valid) {
      return { valid: false, error: `${file.name}: ${result.error}` }
    }
  }
  return { valid: true }
}
