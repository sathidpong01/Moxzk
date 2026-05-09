import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { shutdownOwnedServices } from './localServices'
import { IPC_CHANNELS } from '../shared/ipcChannels'

export type NativeUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'disabled'
  | 'error'

export interface NativeUpdateStatus {
  state: NativeUpdateState
  currentVersion: string
  version?: string
  releaseName?: string | null
  releaseDate?: string
  releaseNotes?: string | null
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
  checkedAt?: number
  downloadedAt?: number
  canInstall: boolean
  manualUrl: string
}

const RELEASES_URL = 'https://github.com/sathidpong01/Moxzk/releases'
const FIRST_CHECK_DELAY_MS = 12_000
const PERIODIC_CHECK_MS = 4 * 60 * 60 * 1000

let initialized = false
let checking = false
let updateQuitInProgress = false
let periodicCheckTimer: NodeJS.Timeout | null = null
let status: NativeUpdateStatus = createStatus('idle')

export function initializeAppUpdater(): void {
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.allowPrerelease = false
  autoUpdater.fullChangelog = false
  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => {
    checking = true
    setStatus(createStatus('checking', status))
  })

  autoUpdater.on('update-available', (info) => {
    setStatus(createStatus('available', updateInfoToStatus(info)))
  })

  autoUpdater.on('download-progress', (progress) => {
    setStatus(createStatus('downloading', {
      ...status,
      ...progressToStatus(progress),
    }))
  })

  autoUpdater.on('update-not-available', (info) => {
    checking = false
    setStatus(createStatus('not-available', {
      ...updateInfoToStatus(info),
      checkedAt: Date.now(),
    }))
  })

  autoUpdater.on('update-downloaded', (event) => {
    checking = false
    setStatus(createStatus('downloaded', {
      ...updateInfoToStatus(event),
      downloadedAt: Date.now(),
    }))
  })

  autoUpdater.on('error', (error) => {
    checking = false
    setStatus(createStatus('error', {
      ...status,
      error: error.message || String(error),
    }))
  })
}

export function scheduleUpdateChecks(): void {
  initializeAppUpdater()
  if (!app.isPackaged || process.platform !== 'win32') {
    setStatus(createStatus('disabled', {
      error: app.isPackaged ? 'Auto update is only enabled for Windows builds.' : 'Auto update is enabled only in packaged builds.',
    }))
    return
  }

  setTimeout(() => {
    void checkForUpdates()
  }, FIRST_CHECK_DELAY_MS)

  if (periodicCheckTimer) clearInterval(periodicCheckTimer)
  periodicCheckTimer = setInterval(() => {
    void checkForUpdates()
  }, PERIODIC_CHECK_MS)
}

export async function checkForUpdates(): Promise<NativeUpdateStatus> {
  initializeAppUpdater()
  if (!app.isPackaged || process.platform !== 'win32') {
    const next = createStatus('disabled', {
      error: app.isPackaged ? 'Auto update is only enabled for Windows builds.' : 'Auto update is enabled only in packaged builds.',
    })
    setStatus(next)
    return next
  }
  if (checking) return status

  checking = true
  setStatus(createStatus('checking', status))
  try {
    await autoUpdater.checkForUpdates()
    return status
  } catch (error) {
    checking = false
    const next = createStatus('error', {
      ...status,
      error: error instanceof Error ? error.message : String(error),
    })
    setStatus(next)
    return next
  }
}

export async function installDownloadedUpdate(): Promise<void> {
  if (status.state !== 'downloaded') {
    throw new Error('No downloaded update is ready to install.')
  }
  updateQuitInProgress = true
  try {
    await shutdownOwnedServices()
    autoUpdater.quitAndInstall(false, true)
  } catch (error) {
    updateQuitInProgress = false
    throw error
  }
}

export function isUpdateQuitInProgress(): boolean {
  return updateQuitInProgress
}

export function getUpdateStatus(): NativeUpdateStatus {
  return status
}

export async function openReleasesPage(): Promise<{ ok: boolean; error?: string }> {
  await shell.openExternal(RELEASES_URL)
  return { ok: true }
}

function setStatus(next: NativeUpdateStatus): void {
  status = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue
    win.webContents.send(IPC_CHANNELS.updatesStatusChanged, status)
  }
}

function createStatus(state: NativeUpdateState, patch: Partial<NativeUpdateStatus> = {}): NativeUpdateStatus {
  return {
    state,
    currentVersion: app.getVersion(),
    canInstall: state === 'downloaded',
    manualUrl: RELEASES_URL,
    ...patch,
  }
}

function updateInfoToStatus(info: UpdateInfo): Partial<NativeUpdateStatus> {
  return {
    version: info.version,
    releaseName: info.releaseName,
    releaseDate: info.releaseDate,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
  }
}

function progressToStatus(progress: ProgressInfo): Partial<NativeUpdateStatus> {
  return {
    percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  }
}

function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes.slice(0, 1200)
  return notes
    .map((item) => `${item.version}: ${item.note ?? ''}`.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 1200) || null
}
