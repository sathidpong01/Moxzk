# Active Project Context

Updated: 2026-04-20
Branch: master
Project type: node, react, vite, typescript, cloudflare-worker, drizzle-d1

## Current Focus

Prepare MG_Translater for a future Electron shell by hardening the web-first runtime boundary and core manga translation workflow first.

## Current State

- The app is still React/Vite web-first and does not include Electron dependencies yet.
- Runtime seams now cover Ollama status/model listing, PanelCleaner status, export file saving, and project draft storage.
- Autosave now snapshots the full multi-page project draft instead of only active-page fragments.
- OCR review now has a summary helper and sorts review-risk regions first in the correction modal.
- Export can resolve R2-backed album image keys before rendering exported files.
- Legacy `manga-image-translator` Docker fallback has been removed; PanelCleaner bridge is the single cleanup path.

## Next Action

Next Electron phase should add a secure typed IPC implementation behind the existing `AppRuntime` contract: no renderer Node access, no raw `ipcRenderer`, and native actions only in main/preload.

## Known Constraints

- Thai text must remain valid UTF-8.
- PanelCleaner is an external dependency and must not be vendored.
- Cloudflare Worker, D1, R2, and auth behavior need focused verification before deployment.
- Local env files and `.dev.vars*` must stay out of git.
