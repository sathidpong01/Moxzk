# Desktop Smoke Test

Use this Windows-only checklist as the acceptance path for Electron V1 and later desktop phases. Windows desktop behavior is the target; browser-only success is not enough for this phase. Linux/macOS are out of scope unless explicitly requested.

## V1 Acceptance

1. Launch the Electron development app with `npm run electron:dev`.
2. Confirm the Windows native title bar is absent and the React frameless title bar is visible.
3. Drag the window from the title bar and confirm toolbar buttons do not start dragging.
4. Resize from the window edges and confirm Windows shadow/resize behavior remains intact.
5. Use minimize, maximize/restore, and close controls in the custom title bar.
6. Open or create an editor project.
7. Export as ZIP and confirm a native save dialog writes the archive.
8. Export to folder and confirm individual images are written through the native folder picker.
9. Close and relaunch the app; confirm desktop draft restore returns the page list, active page, regions, brush strokes, and local image assets.
10. Confirm Electron dev/build uses the default remote Worker, or respects `VITE_CLOUDFLARE_API_URL` when overriding it.
11. Confirm Google OAuth opens in the system browser, returns to the loopback callback, and Electron refreshes into a signed-in state.
12. Open Settings > Cleanup, click `เริ่ม PanelCleaner`, then confirm PanelCleaner status becomes ready or returns a clear external dependency error.
13. Open Settings > AI / Models with a localhost endpoint, click `เริ่ม Ollama`, then confirm Ollama status becomes ready or returns a clear install/PATH error.

## Core Workflow

1. Launch the packaged or development Electron app.
2. เปิด album from the library and confirm it enters the editor directly.
3. Run cleanup/OCR/translate on one page.
4. Run cleanup/OCR/translate as a batch on multiple pages.
5. Edit at least one text region and one brush stroke on the canvas.
6. Confirm autosave/restore returns to the same page list, active page, regions, and brush strokes.
7. Export with ZIP destination.
8. Export with folder destination.
9. Save changes back to the album.
10. Complete auth callback flow through the desktop callback path.

## Native Capability Checks

- Native folder export writes individual image files without a Chrome permission prompt.
- The Windows frameless title bar can drag the app, and custom window controls work.
- Toolbar, Settings, Export drawer, modals, and editor canvas do not overlap the title bar.
- PanelCleaner bridge starts through Electron IPC or reports a clear external dependency error.
- Ollama starts through Electron IPC or reports a clear install/PATH error.
- Google OAuth never renders `accounts.google.com` inside the Electron window.
- Secure secrets are not stored in browser localStorage.
- The renderer never imports Electron modules or raw ipcRenderer.
