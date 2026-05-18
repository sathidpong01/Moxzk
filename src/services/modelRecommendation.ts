import { OLLAMA_RECOMMENDED_MODEL } from '../components/Onboarding/ollamaTutorial'

export interface ModelRecommendation {
  model: string
  reason: string
  /** False when hardware could not be detected and a safe default was used. */
  detected: boolean
}

interface HardwareHints {
  deviceMemory?: number
  hardwareConcurrency?: number
}

function readHardwareHints(): HardwareHints {
  if (typeof navigator === 'undefined') return {}
  return {
    deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  }
}

/**
 * Picks one Ollama model that fits the current machine. `navigator.deviceMemory`
 * is coarse (capped at 8GB) so this only distinguishes "capable" from "modest"
 * and always falls back to the lightest model when detection is unavailable.
 */
export function recommendOllamaModel(hints: HardwareHints = readHardwareHints()): ModelRecommendation {
  const { deviceMemory, hardwareConcurrency } = hints

  if (deviceMemory == null) {
    return {
      model: OLLAMA_RECOMMENDED_MODEL,
      reason: 'ตรวจสเปคเครื่องไม่ได้ เลือกโมเดลขนาดเล็กที่รันได้ทั่วไป',
      detected: false,
    }
  }

  const isCapable = deviceMemory >= 8 && (hardwareConcurrency ?? 0) >= 8
  if (isCapable) {
    return {
      model: 'gemma3:12b',
      reason: 'เครื่องนี้แรม/คอร์เยอะ รองรับโมเดลที่แม่นขึ้นได้',
      detected: true,
    }
  }

  return {
    model: OLLAMA_RECOMMENDED_MODEL,
    reason: 'เลือกโมเดลขนาดเล็กให้รันลื่นบนเครื่องนี้',
    detected: true,
  }
}
