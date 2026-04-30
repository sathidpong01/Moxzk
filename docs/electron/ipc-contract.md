# Electron IPC Contract

Moxzk is a Windows-only Electron app behind the existing `AppRuntime` boundary. The renderer stays a browser-style React app and must not gain direct Node access. Linux/macOS are not planned targets for this project.

## Security Defaults

Electron windows must use these defaults:

```ts
frame: false,
thickFrame: true,
roundedCorners: true,
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

ห้าม expose raw ipcRenderer to the renderer. Preload must expose only typed functions that map to `AppRuntime` capabilities.

## Allowed IPC Surface

Electron V1 IPC stays intentionally narrow. The renderer may call only runtime-shaped native capabilities:

- `files.saveFile`
- `files.saveExportFiles`
- `projectDraft.save`
- `projectDraft.load`
- `projectDraft.clear`
- `localServices.startPanelCleanerBridge`
- `localServices.startOllama`
- `auth.signInWithGoogle`
- `app.getVersion`
- `app.openLogs`
- `app.openSettingsFolder`
- `app.openDraftsFolder`
- `secureStore.getSecret`
- `secureStore.setSecret`
- `secureStore.deleteSecret`
- `customProtocolAuth.getCallbackUrl`
- `windowControls.minimize`
- `windowControls.toggleMaximize`
- `windowControls.close`
- `windowControls.getState`
- `windowControls.stateChanged`

All channels should use request/response calls and return serializable results. Main/preload may perform native work; renderer components must continue to call `AppRuntime`.

`localServices.*` may only start/check local loopback services. PanelCleaner remains an external CLI dependency and Ollama remains an external local app; Electron starts helper processes but does not vendor or bundle either service.

`auth.signInWithGoogle` must open Google OAuth in the system browser. Electron should prefer `moxzk://auth/callback` when protocol registration succeeds, and fall back to a one-time desktop ticket on a loopback callback when it does not. Electron main claims that ticket with the Worker and sets the session cookie in Electron's session. The renderer must not receive a raw session token.

`secureStore.*` may only expose typed secret read/write/delete operations backed by Electron `safeStorage`. Secrets must remain outside the renderer's plain-text settings payload.

`app.*` exists only for narrow diagnostics such as app version plus opening logs/settings/drafts folders. It must not turn into a generic filesystem bridge.

`windowControls.*` may only control the current `BrowserWindow` derived from the calling renderer's `webContents`. It exists to support the Windows-only frameless title bar and must not expose raw `BrowserWindow`, `ipcRenderer`, or arbitrary window APIs to the renderer.

## Error Shape

Native IPC handlers should return a result object instead of raw thrown errors when possible:

```ts
type NativeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
```

This preserves error context across IPC and keeps renderer handling predictable.
