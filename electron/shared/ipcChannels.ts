export const IPC_CHANNELS = {
  filesSaveFile: 'runtime:files.saveFile',
  filesSaveExportFiles: 'runtime:files.saveExportFiles',
  projectDraftSave: 'runtime:projectDraft.save',
  projectDraftLoad: 'runtime:projectDraft.load',
  projectDraftClear: 'runtime:projectDraft.clear',
  localServicesStartPanelCleanerBridge: 'runtime:localServices.startPanelCleanerBridge',
  localServicesStartOllama: 'runtime:localServices.startOllama',
  authSignInWithGoogle: 'runtime:auth.signInWithGoogle',
} as const
