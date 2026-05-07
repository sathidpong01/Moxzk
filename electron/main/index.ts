import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerRuntimeIpcHandlers } from './ipc'
import { consumeDesktopProtocolCallback, registerDesktopProtocol } from './desktopAuth'
import { shutdownOwnedServices } from './localServices'
import { isUpdateQuitInProgress, scheduleUpdateChecks } from './updater'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import { APP_DISPLAY_NAME } from '../../src/config/appIdentity'

const mainFilePath = fileURLToPath(import.meta.url)
const mainDir = path.dirname(mainFilePath)

app.setName(APP_DISPLAY_NAME)
registerRuntimeIpcHandlers()

let isShuttingDownOwnedServices = false
let mainWindow: BrowserWindow | null = null

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', (_event, commandLine) => {
  handleProtocolLaunch(commandLine)
  focusMainWindow()
})

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

  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
}

void app.whenReady().then(() => {
  registerDesktopProtocol()
  createWindow()
  handleProtocolLaunch(process.argv)
  scheduleUpdateChecks()
})

app.on('before-quit', (event) => {
  if (isUpdateQuitInProgress()) return
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

function handleProtocolLaunch(argv: string[]): void {
  for (const arg of argv) {
    if (consumeDesktopProtocolCallback(arg)) {
      return
    }
  }
}

function focusMainWindow(): void {
  const win = mainWindow ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
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
