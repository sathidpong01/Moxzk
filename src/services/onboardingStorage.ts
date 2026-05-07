export const ONBOARDING_STORAGE_KEY = 'moxzk-onboarding-v1'

export const ONBOARDING_SETUP_ITEMS = [
  'python',
  'ollama',
  'model',
  'panelcleaner',
  'translation',
  'account',
  'workspace',
] as const

export type OnboardingSetupItem = typeof ONBOARDING_SETUP_ITEMS[number]

export interface OnboardingState {
  firstRunCompleted: boolean
  ollamaTutorialSeen: boolean
  setupReminderSuppressed: boolean
  currentSetupStep: OnboardingSetupItem
  completedSetupItems: OnboardingSetupItem[]
  skippedSetupItems: OnboardingSetupItem[]
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  firstRunCompleted: false,
  ollamaTutorialSeen: false,
  setupReminderSuppressed: false,
  currentSetupStep: 'python',
  completedSetupItems: [],
  skippedSetupItems: [],
}

export function loadOnboardingState(): OnboardingState {
  if (typeof localStorage === 'undefined') return DEFAULT_ONBOARDING_STATE

  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!raw) return DEFAULT_ONBOARDING_STATE
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return normalizeOnboardingState(parsed)
  } catch {
    return DEFAULT_ONBOARDING_STATE
  }
}

export function persistOnboardingState(state: OnboardingState): OnboardingState {
  const normalized = normalizeOnboardingState(state)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(normalized))
  }
  return normalized
}

export function completeFirstRunSetup(
  state: OnboardingState = loadOnboardingState(),
  options: { suppressReminder?: boolean } = {},
): OnboardingState {
  const suppressReminder = options.suppressReminder === true
  return persistOnboardingState({
    ...state,
    firstRunCompleted: true,
    setupReminderSuppressed: suppressReminder,
  })
}

export function markOllamaTutorialSeen(state: OnboardingState = loadOnboardingState()): OnboardingState {
  return persistOnboardingState({
    ...state,
    ollamaTutorialSeen: true,
    completedSetupItems: addCompletedSetupItem(state.completedSetupItems, 'ollama'),
  })
}

export function markOnboardingSetupItemComplete(
  item: OnboardingSetupItem,
  state: OnboardingState = loadOnboardingState(),
): OnboardingState {
  return persistOnboardingState({
    ...state,
    completedSetupItems: addCompletedSetupItem(state.completedSetupItems, item),
    skippedSetupItems: removeSetupItem(state.skippedSetupItems, item),
  })
}

export function skipOnboardingSetupItem(
  item: OnboardingSetupItem,
  state: OnboardingState = loadOnboardingState(),
): OnboardingState {
  return persistOnboardingState({
    ...state,
    skippedSetupItems: addCompletedSetupItem(state.skippedSetupItems, item),
    currentSetupStep: item,
  })
}

export function setCurrentOnboardingSetupStep(
  item: OnboardingSetupItem,
  state: OnboardingState = loadOnboardingState(),
): OnboardingState {
  return persistOnboardingState({
    ...state,
    currentSetupStep: item,
  })
}

function normalizeOnboardingState(value: Partial<OnboardingState>): OnboardingState {
  return {
    firstRunCompleted: value.firstRunCompleted === true,
    ollamaTutorialSeen: value.ollamaTutorialSeen === true,
    setupReminderSuppressed: value.setupReminderSuppressed === true,
    currentSetupStep: normalizeCurrentSetupStep(value.currentSetupStep),
    completedSetupItems: normalizeCompletedSetupItems(value.completedSetupItems),
    skippedSetupItems: normalizeSkippedSetupItems(value.skippedSetupItems),
  }
}

function normalizeCurrentSetupStep(value: unknown): OnboardingSetupItem {
  return typeof value === 'string' && ONBOARDING_SETUP_ITEMS.includes(value as OnboardingSetupItem)
    ? value as OnboardingSetupItem
    : DEFAULT_ONBOARDING_STATE.currentSetupStep
}

function normalizeCompletedSetupItems(value: unknown): OnboardingSetupItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is OnboardingSetupItem =>
    typeof item === 'string' && ONBOARDING_SETUP_ITEMS.includes(item as OnboardingSetupItem),
  )
}

function normalizeSkippedSetupItems(value: unknown): OnboardingSetupItem[] {
  return normalizeCompletedSetupItems(value)
}

function addCompletedSetupItem(items: OnboardingSetupItem[], item: OnboardingSetupItem): OnboardingSetupItem[] {
  return items.includes(item) ? items : [...items, item]
}

function removeSetupItem(items: OnboardingSetupItem[], item: OnboardingSetupItem): OnboardingSetupItem[] {
  return items.filter((candidate) => candidate !== item)
}
