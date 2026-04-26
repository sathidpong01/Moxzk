import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerRuntimeIpcHandlers } from './ipc'

const mainFilePath = fileURLToPath(import.meta.url)
const mainDir = path.dirname(mainFilePath)

registerRuntimeIpcHandlers()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(mainDir, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

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
