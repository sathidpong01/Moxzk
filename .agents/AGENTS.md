# Agent Context Policy

This directory is a durable context layer for humans and AI agents working on Moxzk.
Use it to keep project state close to the codebase instead of burying it in chat history.

## How To Use This Directory

- Start each coding session by reading `AGENTS.md`, `.agents/active.md`, and the relevant topic note.
- For multi-agent or specialist work, read `.agents/team.md` and assign ownership before editing.
- Use `.agents/index/repo-tree.md` for quick orientation, but treat it as generated context.
- Store resumable task checkpoints in `.agents/sessions/`.
- Store durable project notes in `.agents/topics/`.
- Store local-only notes in `.agents/private/`; this path must remain ignored by git.

## Project Shape

Moxzk is a Windows-only Electron desktop application for manga cleanup and Thai translation. React 19 + Vite 8 + TypeScript runs as the renderer inside the Windows Electron shell; Electron V1 is the primary acceptance target and Linux/macOS are not planned targets.
The app combines a Konva multi-artboard editor, local PanelCleaner bridge, Ollama OCR/translation, and a Cloudflare Worker backed by D1/R2. The web runtime remains available as a fallback and for CI.

## Working Rules

- Read before editing. Load the file to change, nearby tests, and one similar existing pattern.
- Prefer existing local services, stores, and UI primitives over new abstractions.
- Keep changes scoped to the requested behavior.
- Use `.agents/topics/` for durable project notes that should survive across sessions.
- For Konva/react-konva canvas work, read `docs/llm/konva.md` and prefer official Konva MCP or LLM-readable docs for API details.
- For browser-facing work, verify layout and runtime behavior in a real browser when practical. For Electron work, verify the Windows desktop shell; Linux/macOS behavior is out of scope unless explicitly requested.
- For Worker, D1, auth, storage, and export behavior, add or update focused tests.
- During implementation, run the smallest relevant focused test group first; reserve full `npm test` for pre-commit/pre-push, broad refactors, and shared cross-cutting changes.
- Run `npm run build` when TypeScript, React, runtime contracts, or shared interfaces change.
- Run `npm run worker:check` only when Worker/Cloudflare files are touched.
- Do not add secrets, local sample images, generated output, or private notes to git.
- Preserve Thai text and project copy as UTF-8.

## Useful Commands

- `npm run dev`
- `npm run build`
- `npm test`
- `npm run test:settings`
- `npm run test:runtime`
- `npm run test:editor`
- `npm run test:export`
- `npm run test:album`
- `npm run test:cleanup`
- `npm run test:cache`
- `npm run worker:check`
- `npm run context:refresh`

## Context Maintenance

Run `npm run context:refresh` after adding, moving, or deleting major files.
Update `.agents/active.md` when the active task, blockers, or next action changes.
Add durable findings to `.agents/topics/` when they will help future sessions.
