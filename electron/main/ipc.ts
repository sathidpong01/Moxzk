import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getDraftDir, getLogsDir, getUserDataDir } from './appPaths'
import { getCustomProtocolCallbackUrl, signInWithGoogleSystemBrowser } from './desktopAuth'
import {
  beginUsage,
  endUsage,
  getManagedStatus,
  installOllama,
  startOllama,
  startPanelCleanerBridge,
  stopOwnedServices,
} from './localServices'
import {
  getPanelCleanerDependencyStatus,
  installPython,
  installPanelCleaner,
  repairPanelCleaner,
} from './panelCleanerDependency'
import { deleteSecret, getSecret, setSecret } from './secureStore'
import { checkForUpdates, getUpdateStatus, installDownloadedUpdate, openReleasesPage } from './updater'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type {
  NativeLocalServiceName,
  NativeFilePayload,
  NativeProjectDraftPayload,
  NativeResult,
  NativeSaveExportOptions,
  NativePathPickResult,
} from '../../src/runtime/electronBridge'
const ASSETS_DIR = 'assets'
const MANIFEST_FILE = 'manifest.json'
const ASSET_META_FILE = 'assets.json'

interface StoredAssetMeta {
  id: string
  name: string
  type: string
  fileName: string
}

export function registerRuntimeIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.filesSaveFile, async (_event, file: NativeFilePayload) => {
    return saveNativeFile(file)
  })

  ipcMain.handle(
    IPC_CHANNELS.filesSaveExportFiles,
    async (
      _event,
      files: NativeFilePayload[],
      archiveName: string,
      options: NativeSaveExportOptions = {},
    ) => saveNativeExportFiles(files, archiveName, options),
  )

  ipcMain.handle(IPC_CHANNELS.projectDraftSave, async (_event, payload: NativeProjectDraftPayload) => {
    return saveProjectDraft(payload)
  })

  ipcMain.handle(IPC_CHANNELS.projectDraftLoad, async () => {
    return loadProjectDraft()
  })

  ipcMain.handle(IPC_CHANNELS.projectDraftClear, async () => {
    return clearProjectDraft()
  })

  ipcMain.handle(IPC_CHANNELS.localServicesStartPanelCleanerBridge, async () => {
    return nativeActionResult(startPanelCleanerBridge)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesStartOllama, async () => {
    return nativeActionResult(startOllama)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesBeginUsage, async (_event, service: NativeLocalServiceName) => {
    beginUsage(service)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.localServicesEndUsage, async (_event, service: NativeLocalServiceName) => {
    endUsage(service)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.localServicesGetManagedStatus, async () => {
    return nativeActionResult(getManagedStatus)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesPanelCleanerDependencyStatus, async () => {
    return nativeActionResult(getPanelCleanerDependencyStatus)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesInstallPython, async () => {
    return nativeActionResult(installPython)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesInstallOllama, async () => {
    return nativeActionResult(installOllama)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesInstallPanelCleaner, async () => {
    return nativeActionResult(installPanelCleaner)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesRepairPanelCleaner, async () => {
    return nativeActionResult(repairPanelCleaner)
  })

  ipcMain.handle(IPC_CHANNELS.localServicesPickPanelCleanerExecutable, async () => {
    return pickPanelCleanerExecutable()
  })

  ipcMain.handle(IPC_CHANNELS.localServicesStopOwnedServices, async () => {
    return nativeActionResult(stopOwnedServices)
  })

  ipcMain.handle(IPC_CHANNELS.authSignInWithGoogle, async () => {
    return nativeActionResult(signInWithGoogleSystemBrowser)
  })

  ipcMain.handle(IPC_CHANNELS.appGetVersion, async () => {
    return nativeActionResult(async () => app.getVersion())
  })

  ipcMain.handle(IPC_CHANNELS.appOpenLogs, async () => {
    return nativeActionResult(async () => openNativePath(getLogsDir()))
  })

  ipcMain.handle(IPC_CHANNELS.appOpenSettingsFolder, async () => {
    return nativeActionResult(async () => openNativePath(getUserDataDir()))
  })

  ipcMain.handle(IPC_CHANNELS.appOpenDraftsFolder, async () => {
    return nativeActionResult(async () => openNativePath(getDraftDir()))
  })

  ipcMain.handle(IPC_CHANNELS.updatesGetStatus, async () => {
    return nativeActionResult(async () => getUpdateStatus())
  })

  ipcMain.handle(IPC_CHANNELS.updatesCheckForUpdates, async () => {
    return nativeActionResult(checkForUpdates)
  })

  ipcMain.handle(IPC_CHANNELS.updatesInstallDownloaded, async () => {
    return nativeActionResult(installDownloadedUpdate)
  })

  ipcMain.handle(IPC_CHANNELS.updatesOpenReleases, async () => {
    return nativeActionResult(openReleasesPage)
  })

  ipcMain.handle(IPC_CHANNELS.secureStoreGetSecret, async (_event, key: string) => {
    return nativeActionResult(async () => getSecret(key))
  })

  ipcMain.handle(IPC_CHANNELS.secureStoreSetSecret, async (_event, key: string, value: string) => {
    return nativeActionResult(async () => setSecret(key, value))
  })

  ipcMain.handle(IPC_CHANNELS.secureStoreDeleteSecret, async (_event, key: string) => {
    return nativeActionResult(async () => deleteSecret(key))
  })

  ipcMain.handle(IPC_CHANNELS.customProtocolAuthGetCallbackUrl, async (_event, callbackPath: string) => {
    return nativeActionResult(async () => getCustomProtocolCallbackUrl(callbackPath))
  })

  ipcMain.handle(IPC_CHANNELS.windowControlsMinimize, async (event) => {
    return nativeActionResult(async () => {
      getSenderWindow(event.sender).minimize()
    })
  })

  ipcMain.handle(IPC_CHANNELS.windowControlsToggleMaximize, async (event) => {
    return nativeActionResult(async () => {
      const win = getSenderWindow(event.sender)
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
      return getWindowState(win)
    })
  })

  ipcMain.handle(IPC_CHANNELS.windowControlsClose, async (event) => {
    return nativeActionResult(async () => {
      getSenderWindow(event.sender).close()
    })
  })

  ipcMain.handle(IPC_CHANNELS.windowControlsGetState, async (event) => {
    return nativeActionResult(async () => getWindowState(getSenderWindow(event.sender)))
  })
}

async function pickPanelCleanerExecutable(): Promise<NativeResult<NativePathPickResult>> {
  try {
    const result = await dialog.showOpenDialog({
      title: 'เลือกไฟล์ PanelCleaner',
      properties: ['openFile'],
      filters: process.platform === 'win32'
        ? [{ name: 'Executable', extensions: ['exe', 'bat', 'cmd'] }, { name: 'All Files', extensions: ['*'] }]
        : [{ name: 'All Files', extensions: ['*'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { ok: false, error: 'USER_CANCELLED' } }
    }
    return { ok: true, data: { ok: true, path: result.filePaths[0] } }
  } catch (error) {
    return nativeError(error)
  }
}

async function saveNativeFile(file: NativeFilePayload): Promise<NativeResult<string>> {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: safeFileName(file.name),
      filters: [{ name: 'All Files', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, error: 'USER_CANCELLED' }
    await fs.writeFile(result.filePath, Buffer.from(file.data))
    return { ok: true, data: result.filePath }
  } catch (error) {
    return nativeError(error)
  }
}

async function saveNativeExportFiles(
  files: NativeFilePayload[],
  archiveName: string,
  options: NativeSaveExportOptions,
): Promise<NativeResult<'folder'>> {
  if (options.destination !== 'folder') {
    return { ok: false, error: 'Only folder export is supported by this IPC channel.' }
  }
  try {
    const result = await dialog.showOpenDialog({
      title: `Export ${archiveName || 'manga'}`,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'USER_CANCELLED' }
    const targetDir = result.filePaths[0]
    for (const file of files) {
      await fs.writeFile(path.join(targetDir, safeFileName(file.name)), Buffer.from(file.data))
    }
    return { ok: true, data: 'folder' }
  } catch (error) {
    return nativeError(error)
  }
}

async function saveProjectDraft(payload: NativeProjectDraftPayload): Promise<NativeResult<void>> {
  try {
    const draftDir = getDraftDir()
    const assetsDir = path.join(draftDir, ASSETS_DIR)
    await fs.rm(draftDir, { recursive: true, force: true })
    await fs.mkdir(assetsDir, { recursive: true })
    await fs.writeFile(path.join(draftDir, MANIFEST_FILE), JSON.stringify(payload.manifest, null, 2), 'utf8')

    const meta: StoredAssetMeta[] = []
    for (const asset of payload.assets) {
      const fileName = `${safeAssetId(asset.id)}.bin`
      await fs.writeFile(path.join(assetsDir, fileName), Buffer.from(asset.data))
      meta.push({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        fileName,
      })
    }
    await fs.writeFile(path.join(draftDir, ASSET_META_FILE), JSON.stringify(meta, null, 2), 'utf8')
    return { ok: true }
  } catch (error) {
    return nativeError(error)
  }
}

async function loadProjectDraft(): Promise<NativeResult<NativeProjectDraftPayload | null>> {
  try {
    const draftDir = getDraftDir()
    const manifestPath = path.join(draftDir, MANIFEST_FILE)
    try {
      await fs.access(manifestPath)
    } catch {
      return { ok: true, data: null }
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown
    const metaPath = path.join(draftDir, ASSET_META_FILE)
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as StoredAssetMeta[]
    const assets = await Promise.all(meta.map(async (asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      data: toArrayBuffer(await fs.readFile(path.join(draftDir, ASSETS_DIR, asset.fileName))),
    })))

    return { ok: true, data: { manifest, assets } }
  } catch (error) {
    return nativeError(error)
  }
}

async function clearProjectDraft(): Promise<NativeResult<void>> {
  try {
    await fs.rm(getDraftDir(), { recursive: true, force: true })
    return { ok: true }
  } catch (error) {
    return nativeError(error)
  }
}

function nativeError(error: unknown): NativeResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

async function nativeActionResult<T>(action: () => Promise<T>): Promise<NativeResult<T>> {
  try {
    return { ok: true, data: await action() }
  } catch (error) {
    return nativeError(error)
  }
}

function safeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 120) || 'manga'
}

function safeAssetId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'asset'
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function getSenderWindow(sender: WebContents): BrowserWindow {
  const win = BrowserWindow.fromWebContents(sender)
  if (!win) throw new Error('Window controls are not available for this renderer.')
  return win
}

function getWindowState(win: BrowserWindow): { isMaximized: boolean } {
  return { isMaximized: win.isMaximized() }
}

async function openNativePath(targetPath: string): Promise<{ ok: boolean; error?: string }> {
  await fs.mkdir(targetPath, { recursive: true })
  const error = await shell.openPath(targetPath)
  if (error) return { ok: false, error }
  return { ok: true }
}
