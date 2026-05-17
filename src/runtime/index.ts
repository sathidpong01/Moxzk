import type { AppRuntime } from './types'

let currentRuntime: AppRuntime | null = null

export function getAppRuntime(): AppRuntime {
  if (!currentRuntime) {
    throw new Error('App runtime is not installed. installElectronRuntime() must run before getAppRuntime().')
  }
  return currentRuntime
}

export function setAppRuntime(runtime: AppRuntime): void {
  currentRuntime = runtime
}

export type {
  AppRuntime,
  LocalServiceName,
  ManagedServiceStatus,
  PanelCleanerDependencyStatus,
  RuntimeActionResult,
  RuntimeExportDestination,
  RuntimeExportFile,
  RuntimeExportResult,
  RuntimeProjectDraft,
  RuntimeSaveExportOptions,
  RuntimeUpdateStatus,
  RuntimeUpdateState,
  RuntimeWindowState,
} from './types'
