import { app, autoUpdater, BrowserWindow, shell } from 'electron'
import { shutdownOwnedServices } from './localServices'
import { IPC_CHANNELS } from '../shared/ipcChannels'

// Moxzk updates run through Squirrel.Windows + the free hosted update server
// at update.electronjs.org, which serves the `RELEASES` manifest and `.nupkg`
// packages from the latest GitHub release. Squirrel applies updates by
// extracting each version into its own `app-<version>` folder under
// %LocalAppData%\Moxzk and repointing the launcher stub — there is no
// installer wizard and no elevation prompt.
//
// Electron's built-in `autoUpdater` is the Squirrel client. It emits no
// granular download-progress events: Squirrel downloads in the background and
// only reports `update-downloaded`. The `downloading` state below therefore
// carries no percent.

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

const REPO_OWNER = 'sathidpong01'
const REPO_NAME = 'Moxzk'
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
const FIRST_CHECK_DELAY_MS = 1_500
const PERIODIC_CHECK_MS = 4 * 60 * 60 * 1000

let initialized = false
let feedConfigured = false
let checking = false
let updateQuitInProgress = false
let periodicCheckTimer: NodeJS.Timeout | null = null
let status: NativeUpdateStatus = createStatus('idle')

function isUpdateSupported(): boolean {
  return app.isPackaged && process.platform === 'win32'
}

function disabledStatus(): NativeUpdateStatus {
  return createStatus('disabled', {
    error: app.isPackaged
      ? 'Auto update is only enabled for Windows builds.'
      : 'Auto update is enabled only in packaged builds.',
  })
}

function configureFeed(): boolean {
  if (feedConfigured) return true
  if (!isUpdateSupported()) return false
  // The hosted server compares the running version (last path segment) against
  // the latest published RELEASES file and returns 204 when already current.
  const feedUrl = `https://update.electronjs.org/${REPO_OWNER}/${REPO_NAME}/${process.platform}-${process.arch}/${app.getVersion()}`
  autoUpdater.setFeedURL({ url: feedUrl })
  feedConfigured = true
  return true
}

export function initializeAppUpdater(): void {
  if (initialized) return
  initialized = true

  autoUpdater.on('checking-for-update', () => {
    checking = true
    setStatus(createStatus('checking', status))
  })

  autoUpdater.on('update-available', () => {
    // Squirrel begins downloading immediately; it does not report progress.
    setStatus(createStatus('downloading', status))
  })

  autoUpdater.on('update-not-available', () => {
    checking = false
    setStatus(createStatus('not-available', { checkedAt: Date.now() }))
  })

  autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName, releaseDate) => {
    checking = false
    setStatus(createStatus('downloaded', {
      version: releaseName || undefined,
      releaseName: releaseName || null,
      releaseDate: releaseDate ? new Date(releaseDate).toISOString() : undefined,
      releaseNotes: normalizeReleaseNotes(releaseNotes),
      downloadedAt: Date.now(),
    }))
  })

  autoUpdater.on('error', (error) => {
    checking = false
    setStatus(createStatus('error', {
      ...status,
      error: error instanceof Error ? error.message : String(error),
    }))
  })
}

export function scheduleUpdateChecks(): void {
  initializeAppUpdater()
  if (!isUpdateSupported()) {
    setStatus(disabledStatus())
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
  if (!isUpdateSupported()) {
    const next = disabledStatus()
    setStatus(next)
    return next
  }
  if (checking) return status

  checking = true
  setStatus(createStatus('checking', status))
  try {
    if (!configureFeed()) {
      throw new Error('Update feed is unavailable.')
    }
    autoUpdater.checkForUpdates()
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
    // Squirrel swaps the active version folder and relaunches Moxzk.
    autoUpdater.quitAndInstall()
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

function normalizeReleaseNotes(notes: string | undefined): string | null {
  if (!notes) return null
  return notes.slice(0, 1200) || null
}
