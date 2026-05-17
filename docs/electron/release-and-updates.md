# Moxzk Release And Update Workflow

Moxzk production distribution uses GitHub Releases as the update source for the Windows Electron app.

## Update Policy

- Target: Windows desktop only.
- Packaging: `electron-builder` with the NSIS target.
- Update runtime: `electron-updater` in the Electron main process.
- User experience: Moxzk checks for updates after startup, downloads in the background, then asks the user to restart.
- Renderer boundary: React talks through `AppRuntime.updates`; renderer code must not import Electron or `electron-updater` directly.
- Release channel: stable releases only. Do not use prerelease channels until there is a separate beta policy.

## Build Commands

```bash
npm run electron:build
npm run release:build
npm run release:checksums
```

Publish to GitHub Releases with a configured `GH_TOKEN`:

```bash
npm run release:publish
```

`release:publish` builds the Electron app, creates the Windows NSIS installer, creates update metadata such as `latest.yml`, and publishes the artifacts to the GitHub release.

## Release Checklist

1. Update all version surfaces that ship with the app.
2. Run focused tests for the changed area.
3. Run `npm run test:runtime`.
4. Run `npm run build`.
5. Run `npm run release:build`.
6. Run `npm run release:checksums` and attach `output/electron/SHA256SUMS.txt`.
7. Create or publish the GitHub release.
8. Put the checksum list and user-facing changelog in the release notes.
9. Download the installer from GitHub Releases on a clean Windows machine and smoke test startup, editor restore, settings, and update status.

## Unsigned Indie Build Note

Moxzk is currently an unsigned indie Windows app. Windows SmartScreen may warn users when they open the installer or updated app.

Release notes must include:

- A short SmartScreen note in plain user language.
- SHA256 checksums for every published installer/update artifact.
- A manual download fallback link to the installer.
- A reminder that PanelCleaner and Ollama remain external tools and are not bundled into the app.

## Failure Model

- If update checking fails, the app keeps working and offers a GitHub Releases link.
- If a download is still running, the editor must remain usable.
- If an update has downloaded, the app asks for restart instead of forcing it.
- If cleanup, translation, export, or another long-running action is active, the restart prompt recommends waiting.
- If install is requested, Electron shuts down app-owned local services before calling `quitAndInstall()`.

## Implementation Boundaries

- Updater ownership: `electron/main/updater.ts`.
- IPC registration: `electron/main/ipc.ts`.
- Preload bridge: `electron/preload/index.ts`.
- Renderer runtime contract: `src/runtime/types.ts`, `src/runtime/electronBridge.ts`, `src/runtime/electronRuntime.ts`.
- UI prompt: `src/components/Layout/UpdateRestartPrompt.tsx`.
- Settings/About status: `src/components/Settings/SettingsPanel.tsx`.
