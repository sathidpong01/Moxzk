# Electron IPC Contract

MG_Translater must add Electron behind the existing `AppRuntime` boundary. The renderer stays a browser-style React app and must not gain direct Node access.

## Security Defaults

Electron windows must use these defaults:

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

ห้าม expose raw ipcRenderer to the renderer. Preload must expose only typed functions that map to `AppRuntime` capabilities.

## Allowed IPC Surface

IPC channels should be grouped by runtime capability:

- `files.saveFile`
- `files.saveExportFiles`
- `projectDraft.save`
- `projectDraft.load`
- `projectDraft.clear`
- `localServices.startOllama`
- `localServices.startPanelCleanerBridge`
- `secureStore.getSecret`
- `secureStore.setSecret`
- `secureStore.deleteSecret`
- `customProtocolAuth.getCallbackUrl`

All channels should use request/response calls and return serializable results. Main/preload may perform native work; renderer components must continue to call `AppRuntime`.

## Error Shape

Native IPC handlers should return a result object instead of raw thrown errors when possible:

```ts
type NativeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
```

This preserves error context across IPC and keeps renderer handling predictable.
