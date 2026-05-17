# Moxzk Release And Update Workflow

Moxzk production distribution uses GitHub Releases as the update source for the Windows Electron app.

## Update Policy

- Target: Windows desktop only.
- Packaging: `electron-builder` with the **Squirrel.Windows** target.
- Update runtime: Electron's built-in `autoUpdater` (the Squirrel client) in the main process.
- Update server: the free hosted service `update.electronjs.org`, which serves the `RELEASES` manifest and `.nupkg` packages from the latest GitHub release of this public repo.
- User experience: Moxzk checks for updates shortly after startup, Squirrel downloads in the background, then the app asks the user to restart. Installing applies the new version into its own per-user folder — no installer wizard, no elevation prompt.
- Renderer boundary: React talks through `AppRuntime.updates`; renderer code must not import Electron or updater internals directly.
- Release channel: stable releases only.

## How Squirrel Updates Work

- Squirrel installs Moxzk per-user under `%LocalAppData%\Moxzk`.
- Each version lives in its own `app-<version>` folder; a small launcher stub at the root points to the current version.
- An update extracts the new version into a new `app-<version>` folder and repoints the stub, then removes the old version. There is no file-by-file patch and no wizard.
- `electron-squirrel-startup` handles the `--squirrel-install` / `--squirrel-updated` / `--squirrel-uninstall` / `--squirrel-obsolete` launch flags (shortcut creation and removal) and exits immediately for those runs.
- The `.moxzk` file association is registered by `electron/main/squirrelSetup.ts` during the same install/update/uninstall events (per-user HKCU registry writes — Squirrel does not register associations itself).
- Delta packages: `squirrelWindows.remoteReleases` points the build at the GitHub repo so each build diffs against the previously published `-full.nupkg` and emits a `-delta.nupkg`. The first release after this cutover ships full-only; deltas appear from the next release onward.
- The built-in `autoUpdater` reports no granular download progress — only `update-downloaded`. The `downloading` UI state therefore shows no percentage.

## Build Commands

```bash
npm run electron:build
npm run release:build
npm run release:checksums
```

Publish to GitHub Releases with `gh` CLI credentials:

```bash
npm run release:publish
```

`release:publish` builds the Electron app, creates the Squirrel installer plus the `RELEASES` manifest and `.nupkg` package(s), and publishes those artifacts to the GitHub release.

## Release Checklist

1. Update all version surfaces that ship with the app.
2. Run focused tests for the changed area.
3. Run `npm run test:runtime`.
4. Run `npm run build`.
5. Run `npm run release:build`.
6. Run `npm run release:checksums` and attach `output/electron/SHA256SUMS.txt`.
7. Create or publish the GitHub release. The release **must** include `RELEASES`, the `.nupkg` package(s), and the Setup `.exe`.
8. Put the checksum list and user-facing changelog in the release notes.
9. Download the installer from GitHub Releases on a clean Windows machine and smoke test startup, editor restore, settings, and update status.

## Unsigned Indie Build Note

Moxzk is currently an unsigned indie Windows app. Windows SmartScreen may warn users when they open the installer or updated app.

Release notes must include:

- A short SmartScreen note in plain user language.
- SHA256 checksums for every published installer/update artifact.
- A manual download fallback link to the installer.
- A reminder that PanelCleaner and Ollama remain external tools and are not bundled into the app.

## Migration From NSIS Builds

Earlier Moxzk builds used the NSIS installer (installed into `Program Files`). NSIS and Squirrel installs do not share a location and do not auto-migrate. Existing NSIS users keep their old install and will not receive Squirrel updates until they download the new Setup `.exe` once. Announce this in the cutover release notes.

## Failure Model

- If update checking fails, the app keeps working and offers a GitHub Releases link.
- If a download is still running, the editor must remain usable.
- If an update has downloaded, the app asks for restart instead of forcing it.
- If cleanup, translation, export, or another long-running action is active, the restart prompt recommends waiting.
- If install is requested, Electron shuts down app-owned local services before calling `quitAndInstall()`.

## Implementation Boundaries

- Updater ownership: `electron/main/updater.ts`.
- Squirrel launch-flag handling: `electron/main/index.ts`.
- IPC registration: `electron/main/ipc.ts`.
- Preload bridge: `electron/preload/index.ts`.
- Renderer runtime contract: `src/runtime/types.ts`, `src/runtime/electronBridge.ts`, `src/runtime/electronRuntime.ts`.
- UI prompt: `src/components/Layout/UpdateRestartPrompt.tsx`.
- Settings/About status: `src/components/Settings/SettingsPanel.tsx`.
