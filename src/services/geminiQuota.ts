/**
 * Gemini API quota tracker — counts calls per day, detects tier from 429 errors.
 * Stored in localStorage, resets at midnight Pacific Time.
 */

const STORAGE_KEY = 'mg-gemini-quota'

export type GeminiTier = 'free' | 'tier1' | 'tier2' | 'unknown'

interface QuotaState {
  date: string          // YYYY-MM-DD in Pacific Time
  used: number
  limit: number
  tier: GeminiTier
  model: string
}

// Default free-tier limits (from Google docs + observed 429 errors)
const DEFAULT_LIMITS: Record<GeminiTier, number> = {
  free: 20,
  tier1: 1000,
  tier2: 4000,
  unknown: 25,
}

function getPacificDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function loadQuota(): QuotaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultQuota()
    const parsed: QuotaState = JSON.parse(raw)
    // Reset if date changed
    if (parsed.date !== getPacificDate()) {
      const fresh = createDefaultQuota()
      fresh.tier = parsed.tier   // Keep detected tier
      fresh.limit = parsed.limit // Keep detected limit
      return fresh
    }
    return parsed
  } catch {
    return createDefaultQuota()
  }
}

function createDefaultQuota(): QuotaState {
  return {
    date: getPacificDate(),
    used: 0,
    limit: DEFAULT_LIMITS.free,
    tier: 'unknown',
    model: 'gemini-2.5-flash',
  }
}

function saveQuota(state: QuotaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full
  }
}

/** Call this after each successful Gemini API call */
export function incrementQuota(): QuotaState {
  const state = loadQuota()
  state.used += 1
  saveQuota(state)
  return state
}

/** Call this when a 429 error is received to update tier + limit */
export function updateQuotaFromError(errorBody: string): QuotaState {
  const state = loadQuota()

  try {
    // Try to extract quota info from error JSON
    const isFree = errorBody.includes('free_tier')
    const quotaValueMatch = errorBody.match(/"quotaValue"\s*:\s*"?(\d+)"?/)
    const modelMatch = errorBody.match(/"model"\s*:\s*"([^"]+)"/)

    if (isFree) {
      state.tier = 'free'
    } else if (errorBody.includes('GenerateRequestsPerDayPerProject')) {
      state.tier = 'tier1'
    }

    if (quotaValueMatch) {
      state.limit = parseInt(quotaValueMatch[1], 10)
    } else if (state.tier !== 'unknown') {
      state.limit = DEFAULT_LIMITS[state.tier]
    }

    if (modelMatch) {
      state.model = modelMatch[1]
    }

    // If we hit quota, used is at least equal to limit
    state.used = Math.max(state.used, state.limit)
  } catch {
    // Parse failed — just mark as exhausted
    state.used = state.limit
  }

  saveQuota(state)
  return state
}

/** Get current quota state */
export function getQuota(): QuotaState {
  return loadQuota()
}

/** Get usage percentage 0-100 */
export function getUsagePercent(): number {
  const { used, limit } = loadQuota()
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

/** Reset quota (for testing) */
export function resetQuota(): void {
  localStorage.removeItem(STORAGE_KEY)
}
