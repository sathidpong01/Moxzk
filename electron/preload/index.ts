import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type {
  MgRuntimeBridge,
  NativeFilePayload,
  NativeProjectDraftPayload,
  NativeSaveExportOptions,
} from '../../src/runtime/electronBridge'

const bridge: MgRuntimeBridge = {
  files: {
    saveFile: (file: NativeFilePayload) => ipcRenderer.invoke(IPC_CHANNELS.filesSaveFile, file),
    saveExportFiles: (
      files: NativeFilePayload[],
      archiveName: string,
      options?: NativeSaveExportOptions,
    ) => ipcRenderer.invoke(IPC_CHANNELS.filesSaveExportFiles, files, archiveName, options),
  },
  projectDraft: {
    save: (payload: NativeProjectDraftPayload) => ipcRenderer.invoke(IPC_CHANNELS.projectDraftSave, payload),
    load: () => ipcRenderer.invoke(IPC_CHANNELS.projectDraftLoad),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.projectDraftClear),
  },
  localServices: {
    startPanelCleanerBridge: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStartPanelCleanerBridge),
    startOllama: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStartOllama),
  },
  auth: {
    signInWithGoogle: () => ipcRenderer.invoke(IPC_CHANNELS.authSignInWithGoogle),
  },
}

contextBridge.exposeInMainWorld('mgRuntime', bridge)
