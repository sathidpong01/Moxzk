# Desktop Smoke Test

Use this checklist as the acceptance path for Electron V1 and later desktop phases. Desktop behavior is the target; browser-only success is not enough for this phase.

## V1 Acceptance

1. Launch the Electron development app with `npm run electron:dev`.
2. Open or create an editor project.
3. Export as ZIP and confirm a native save dialog writes the archive.
4. Export to folder and confirm individual images are written through the native folder picker.
5. Close and relaunch the app; confirm desktop draft restore returns the page list, active page, regions, brush strokes, and local image assets.
6. Confirm production Electron builds require `VITE_CLOUDFLARE_API_URL` for remote Worker API calls.
7. Confirm Google OAuth opens in the system browser, returns to the loopback callback, and Electron refreshes into a signed-in state.
8. Open Settings > Cleanup, click `เริ่ม PanelCleaner`, then confirm PanelCleaner status becomes ready or returns a clear external dependency error.
9. Open Settings > AI / Models with a localhost endpoint, click `เริ่ม Ollama`, then confirm Ollama status becomes ready or returns a clear install/PATH error.

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
- PanelCleaner bridge starts through Electron IPC or reports a clear external dependency error.
- Ollama starts through Electron IPC or reports a clear install/PATH error.
- Google OAuth never renders `accounts.google.com` inside the Electron window.
- Secure secrets are not stored in browser localStorage.
- The renderer never imports Electron modules or raw ipcRenderer.
