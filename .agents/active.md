# Active Project Context

Updated: 2026-04-20
Branch: master
Project type: node, react, vite, typescript, cloudflare-worker, drizzle-d1

## Current Focus

Implement Electron V1 as a desktop dev shell behind the existing `AppRuntime` boundary.

## Current State

- The app is still React/Vite web-first, with Electron V1 added as a desktop dev shell.
- Runtime seams now cover Ollama status/model listing, PanelCleaner status, export file saving, and project draft storage.
- Electron V1 IPC covers native export and desktop draft persistence only.
- Autosave now snapshots the full multi-page project draft instead of only active-page fragments.
- OCR review now has a summary helper and sorts review-risk regions first in the correction modal.
- Export can resolve R2-backed album image keys before rendering exported files.
- Legacy `manga-image-translator` Docker fallback has been removed; PanelCleaner bridge is the single cleanup path.

## Next Action

Next Electron phase should add service launching, secure secret storage, and custom protocol auth behind the existing `AppRuntime` contract.

## Known Constraints

- Thai text must remain valid UTF-8.
- PanelCleaner is an external dependency and must not be vendored.
- Cloudflare Worker, D1, R2, and auth behavior need focused verification before deployment.
- Local env files and `.dev.vars*` must stay out of git.
