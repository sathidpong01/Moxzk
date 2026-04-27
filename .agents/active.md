# Active Project Context

Updated: 2026-04-26
Branch: master
Project type: node, react, vite, typescript, cloudflare-worker, drizzle-d1

## Current Focus

Implement Electron V1 follow-up phases behind the existing `AppRuntime` boundary.

## Current State

- The app is a desktop-first Electron application. React/Vite runs as the renderer inside the Electron shell. Electron V1 is the primary acceptance target.
- Runtime seams now cover Ollama status/model listing, PanelCleaner status, export file saving, project draft storage, and Google auth.
- Electron IPC covers native export, desktop draft persistence, local service start helpers for PanelCleaner/Ollama, and system-browser Google login.
- Autosave now snapshots the full multi-page project draft instead of only active-page fragments.
- OCR review now has a summary helper and sorts review-risk regions first in the correction modal.
- Export can resolve R2-backed album image keys before rendering exported files.
- Legacy `manga-image-translator` Docker fallback has been removed; PanelCleaner bridge is the single cleanup path.

## Next Action

Next Electron phase should add secure secret storage and optional custom protocol auth behind the existing `AppRuntime` contract.

## Known Constraints

- Thai text must remain valid UTF-8.
- PanelCleaner is an external dependency and must not be vendored.
- Electron can start the local bridge/helper, but PanelCleaner and Ollama remain external machine dependencies.
- Cloudflare Worker, D1, R2, and auth behavior need focused verification before deployment.
- Local env files and `.dev.vars*` must stay out of git.
