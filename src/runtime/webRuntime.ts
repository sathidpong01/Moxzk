import {
  getOllamaStatus,
  listOllamaModels,
} from '../services/ollama'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { getPanelCleanerStatus } from '../services/panelcleaner-api'
import { clearProjectDraft, loadProjectDraft, saveProjectDraft } from '../services/projectDraftStorage'
import type { AppRuntime, RuntimeExportFile } from './types'

export const webRuntime: AppRuntime = {
  kind: 'web',
  capabilities: {
    canStartLocalServices: false,
    canPickNativeFolders: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    canSecureStoreSecrets: false,
    canUseCustomProtocolAuth: false,
  },
  ollama: {
    getServerStatus: getOllamaStatus,
    listModels: listOllamaModels,
  },
  panelCleaner: {
    getStatus: getPanelCleanerStatus,
  },
  files: {
    saveFile,
    saveExportFiles,
  },
  projectDraft: {
    save: saveProjectDraft,
    load: loadProjectDraft,
    clear: clearProjectDraft,
  },
}

type DirectoryPicker = () => Promise<{
  getFileHandle: (name: string, options: { create: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}>

async function saveFile(file: RuntimeExportFile): Promise<void> {
  saveAs(file.blob, file.name)
}

async function saveExportFiles(files: RuntimeExportFile[], archiveName: string): Promise<'folder' | 'zip'> {
  if (files.length === 0) throw new Error('ไม่มีไฟล์สำหรับ export')

  const directoryPicker = getDirectoryPicker()
  if (directoryPicker) {
    try {
      const dir = await directoryPicker()
      for (const file of files) {
        const handle = await dir.getFileHandle(file.name, { create: true })
        const writable = await handle.createWritable()
        await writable.write(file.blob)
        await writable.close()
      }
      return 'folder'
    } catch (error) {
      if (isAbortError(error)) throw error
      console.warn('[runtime:web] folder export failed, falling back to zip:', error)
    }
  }

  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${safeArchiveName(archiveName)}.zip`)
  return 'zip'
}

function getDirectoryPicker(): DirectoryPicker | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  return typeof candidate === 'function' ? candidate.bind(window) : null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function safeArchiveName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'manga'
}
