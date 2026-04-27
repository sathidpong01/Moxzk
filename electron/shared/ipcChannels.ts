export const IPC_CHANNELS = {
  filesSaveFile: 'runtime:files.saveFile',
  filesSaveExportFiles: 'runtime:files.saveExportFiles',
  projectDraftSave: 'runtime:projectDraft.save',
  projectDraftLoad: 'runtime:projectDraft.load',
  projectDraftClear: 'runtime:projectDraft.clear',
  localServicesStartPanelCleanerBridge: 'runtime:localServices.startPanelCleanerBridge',
  localServicesStartOllama: 'runtime:localServices.startOllama',
  localServicesBeginUsage: 'runtime:localServices.beginUsage',
  localServicesEndUsage: 'runtime:localServices.endUsage',
  localServicesGetManagedStatus: 'runtime:localServices.getManagedStatus',
  localServicesStopOwnedServices: 'runtime:localServices.stopOwnedServices',
  authSignInWithGoogle: 'runtime:auth.signInWithGoogle',
} as const
