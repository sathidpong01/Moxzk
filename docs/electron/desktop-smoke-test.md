# Desktop Smoke Test

Use this checklist as the first acceptance path after adding the Electron shell. Desktop behavior is the target; browser-only success is not enough for this phase.

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
- PanelCleaner bridge can be started or reports a clear unsupported/error state.
- Ollama can be started or reports a clear unsupported/error state.
- Secure secrets are not stored in browser localStorage.
- The renderer never imports Electron modules or raw ipcRenderer.
