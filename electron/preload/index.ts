import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type {
  MoxzkRuntimeBridge,
  NativeFilePayload,
  NativeProjectDraftPayload,
  NativeSaveExportOptions,
} from '../../src/runtime/electronBridge'

const bridge: MoxzkRuntimeBridge = {
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
    beginUsage: (service) => ipcRenderer.invoke(IPC_CHANNELS.localServicesBeginUsage, service),
    endUsage: (service) => ipcRenderer.invoke(IPC_CHANNELS.localServicesEndUsage, service),
    getManagedStatus: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesGetManagedStatus),
    stopOwnedServices: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStopOwnedServices),
    startPanelCleanerBridge: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStartPanelCleanerBridge),
    startOllama: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStartOllama),
  },
  auth: {
    signInWithGoogle: () => ipcRenderer.invoke(IPC_CHANNELS.authSignInWithGoogle),
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowControlsMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowControlsToggleMaximize),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.windowControlsClose),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.windowControlsGetState),
    onStateChange: (callback) => {
      const handler = (_event: IpcRendererEvent, state: { isMaximized: boolean }) => {
        callback(state)
      }
      ipcRenderer.on(IPC_CHANNELS.windowControlsStateChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.windowControlsStateChanged, handler)
      }
    },
  },
}

contextBridge.exposeInMainWorld('moxzkRuntime', bridge)
contextBridge.exposeInMainWorld('mgRuntime', bridge)
