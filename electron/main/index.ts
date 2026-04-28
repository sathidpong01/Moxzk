import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerRuntimeIpcHandlers } from './ipc'
import { shutdownOwnedServices } from './localServices'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import { APP_DISPLAY_NAME } from '../../src/config/appIdentity'

const mainFilePath = fileURLToPath(import.meta.url)
const mainDir = path.dirname(mainFilePath)

registerRuntimeIpcHandlers()

let isShuttingDownOwnedServices = false

function createWindow(): void {
  const win = new BrowserWindow({
    title: APP_DISPLAY_NAME,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    frame: false,
    thickFrame: true,
    roundedCorners: true,
    show: false,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(mainDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    sendWindowState(win)
  })

  win.on('maximize', () => sendWindowState(win))
  win.on('unmaximize', () => sendWindowState(win))
  win.on('restore', () => sendWindowState(win))

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (shouldOpenExternally(url, win.webContents.getURL())) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(mainDir, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  createWindow()
})

app.on('before-quit', (event) => {
  if (isShuttingDownOwnedServices) return
  isShuttingDownOwnedServices = true
  event.preventDefault()
  void shutdownOwnedServices().finally(() => {
    app.quit()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

function sendWindowState(win: BrowserWindow): void {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return
  win.webContents.send(IPC_CHANNELS.windowControlsStateChanged, {
    isMaximized: win.isMaximized(),
  })
}

function shouldOpenExternally(targetUrl: string, currentUrl: string): boolean {
  try {
    const target = new URL(targetUrl)
    if (target.protocol === 'file:') return false
    const current = currentUrl ? new URL(currentUrl) : null
    return Boolean(current && target.origin !== current.origin)
  } catch {
    return true
  }
}
