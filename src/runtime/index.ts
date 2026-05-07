import type { AppRuntime } from './types'
import { webRuntime } from './webRuntime'

let currentRuntime: AppRuntime = webRuntime

export function getAppRuntime(): AppRuntime {
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
