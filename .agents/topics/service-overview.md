# Service Overview

MG_Translater is a web-first manga image cleanup and Thai translation tool.

## Frontend

- React 19, Vite 7, TypeScript, Tailwind CSS 4.
- Konva/react-konva powers the multi-page artboard editor.
- Zustand stores app, album, and auth state.
- UI is organized under `src/components/` with editor, processing, settings, auth, album, and step-based workflow areas.

## Local Processing

- `scripts/panelcleaner-bridge.mjs` exposes local cleanup endpoints for the frontend.
- PanelCleaner is invoked as an external CLI.
- Ollama is used for OCR, translation, and vision-model JSON responses.
- Batch processing queues cleanup and translation to reduce model and VRAM contention.

## Cloudflare Backend

- Worker entrypoint: `src/worker/index.ts`.
- Auth, album metadata, page metadata, storage, and HTTP helpers are split under `src/worker/`.
- D1 schema source of truth: `src/worker/db/schema.ts`.
- Drizzle migrations live in `drizzle/`.
- R2 stores image objects while D1 stores album/page metadata.

## Persistence

- Translation memory and settings are stored client-side where appropriate.
- Albums and pages are persisted through the Cloudflare Worker API.
- Local/private notes belong in `.agents/private/`, not source files.

## Verification Targets

- `npm test` for script-level behavior.
- `npm run build` for TypeScript and Vite production output.
- `npm run worker:check` for Cloudflare Worker dry-run validation.
- Browser verification for editor, canvas, auth, upload, cleanup, translation, and export flows.
