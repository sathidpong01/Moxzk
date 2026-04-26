/**
 * Parse Ollama/API error responses into user-friendly messages.
 */

export interface ParsedError {
  shortMessage: string
  retryDelaySec: number | null
  isQuotaError: boolean
  statusCode: number | null
}

export function parseApiError(raw: string): ParsedError {
  const result: ParsedError = {
    shortMessage: raw,
    retryDelaySec: null,
    isQuotaError: false,
    statusCode: null,
  }

  // Try to parse as JSON error envelope
  try {
    const parsed = JSON.parse(raw)
    const err = parsed?.error ?? parsed

    if (err?.code) result.statusCode = err.code
    if (err?.message && typeof err.message === 'string') {
      result.shortMessage = err.message
    }
  } catch {
    // Not JSON — try to extract from stringified JSON
  }

  const lower = raw.toLowerCase()

  // Detect quota/rate-limit errors
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate') || lower.includes('resource_exhausted')) {
    result.isQuotaError = true

    // Extract retry delay
    const retryMatch = raw.match(/retry\s*(?:in|delay['":\s]*)\s*["']?(\d+(?:\.\d+)?)\s*s/i)
    if (retryMatch) {
      result.retryDelaySec = Math.ceil(parseFloat(retryMatch[1]))
    }

    // Extract model name for context
    const modelMatch = raw.match(/model:\s*([a-z0-9._-]+)/i)
    const model = modelMatch ? modelMatch[1] : 'ollama'

    // Extract limit
    const limitMatch = raw.match(/limit:\s*(\d+)/i)
    const limit = limitMatch ? limitMatch[1] : null

    if (result.retryDelaySec) {
      result.shortMessage = `Quota เต็ม (${model}${limit ? `, ${limit} req/day` : ''}) — รอ ${result.retryDelaySec} วินาที`
    } else {
      result.shortMessage = `Quota เต็ม (${model}${limit ? `, ${limit} req/day` : ''}) — รอสักครู่แล้วลองใหม่`
    }
  }

  // Detect API key errors
  if (lower.includes('api key') || lower.includes('api_key') || lower.includes('unauthorized') || lower.includes('401')) {
    result.shortMessage = 'API Key ไม่ถูกต้อง — ตรวจสอบ Ollama Cloud API Key ใน Settings'
  }

  // Detect network errors
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('econnrefused') || lower.includes('timed out') || lower.includes('timeout')) {
    if (lower.includes('ollama') || lower.includes('11434')) {
      result.shortMessage = lower.includes('timed out') || lower.includes('timeout')
        ? 'Ollama ตอบช้าเกินเวลา — ตรวจว่า service พร้อมและโมเดลไม่ค้างอยู่'
        : 'เชื่อมต่อ Ollama ไม่ได้ — เปิด Ollama app หรือรัน ollama serve แล้วลองใหม่'
    } else if (lower.includes('panelcleaner') || lower.includes('5055')) {
      result.shortMessage = lower.includes('timed out') || lower.includes('timeout')
        ? 'PanelCleaner bridge ตอบช้าเกินเวลา — bridge เปิดอยู่แต่ CLI อาจยังไม่พร้อม'
        : 'เชื่อมต่อ PanelCleaner bridge ไม่ได้ — รัน npm run backend:panelcleaner แล้วลองใหม่'
    } else {
      result.shortMessage = 'เชื่อมต่อ Server ไม่ได้ — ตรวจสอบ PanelCleaner bridge'
    }
  }

  // Truncate if still too long
  if (result.shortMessage.length > 120) {
    result.shortMessage = result.shortMessage.slice(0, 117) + '...'
  }

  return result
}
