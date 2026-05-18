import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type {
  MoxzkRuntimeBridge,
  NativeFilePayload,
  NativeProjectDraftPayload,
  NativeSaveExportOptions,
  NativeUpdateStatus,
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
    getPanelCleanerDependencyStatus: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesPanelCleanerDependencyStatus),
    installPython: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesInstallPython),
    installOllama: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesInstallOllama),
    getOllamaInstallStatus: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesOllamaInstallStatus),
    installPanelCleaner: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesInstallPanelCleaner),
    repairPanelCleaner: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesRepairPanelCleaner),
    pickPanelCleanerExecutable: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesPickPanelCleanerExecutable),
    stopOwnedServices: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStopOwnedServices),
    startPanelCleanerBridge: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStartPanelCleanerBridge),
    startOllama: () => ipcRenderer.invoke(IPC_CHANNELS.localServicesStartOllama),
  },
  auth: {
    signInWithGoogle: () => ipcRenderer.invoke(IPC_CHANNELS.authSignInWithGoogle),
  },
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appGetVersion),
    openLogs: () => ipcRenderer.invoke(IPC_CHANNELS.appOpenLogs),
    openSettingsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.appOpenSettingsFolder),
    openDraftsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.appOpenDraftsFolder),
  },
  updates: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.updatesGetStatus),
    checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.updatesCheckForUpdates),
    installDownloadedUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updatesInstallDownloaded),
    openReleases: () => ipcRenderer.invoke(IPC_CHANNELS.updatesOpenReleases),
    onStatusChange: (callback) => {
      const handler = (_event: IpcRendererEvent, status: NativeUpdateStatus) => {
        callback(status)
      }
      ipcRenderer.on(IPC_CHANNELS.updatesStatusChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.updatesStatusChanged, handler)
      }
    },
  },
  secureStore: {
    getSecret: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.secureStoreGetSecret, key),
    setSecret: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.secureStoreSetSecret, key, value),
    deleteSecret: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.secureStoreDeleteSecret, key),
  },
  customProtocolAuth: {
    getCallbackUrl: (callbackPath: string) => ipcRenderer.invoke(IPC_CHANNELS.customProtocolAuthGetCallbackUrl, callbackPath),
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
