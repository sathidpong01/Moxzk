# Agent Context Policy

This directory is a durable context layer for humans and AI agents working on MG_Translater.
Use it to keep project state close to the codebase instead of burying it in chat history.

## How To Use This Directory

- Start each coding session by reading `AGENTS.md`, `.agents/active.md`, and the relevant topic note.
- Use `.agents/index/repo-tree.md` for quick orientation, but treat it as generated context.
- Store resumable task checkpoints in `.agents/sessions/`.
- Store durable project notes in `.agents/topics/`.
- Store local-only notes in `.agents/private/`; this path must remain ignored by git.

## Project Shape

MG_Translater is a React 19 + Vite 7 + TypeScript image editor for manga cleanup and Thai translation.
The app combines a Konva multi-artboard editor, local PanelCleaner bridge, Ollama OCR/translation, and a Cloudflare Worker backed by D1/R2.

## Working Rules

- Read before editing. Load the file to change, nearby tests, and one similar existing pattern.
- Prefer existing local services, stores, and UI primitives over new abstractions.
- Keep changes scoped to the requested behavior.
- Use the `_wiki/` layer with balanced defaults:
  - For research, repeated questions, architecture direction, or work that likely depends on accumulated knowledge, read `_wiki/podcast.md` first, then `_wiki/index.md`, then only the relevant pages.
  - For narrow implementation work, targeted bug fixes, or obvious local code edits, do not load `_wiki/` by default.
  - Do not read the entire wiki at session start unless the task explicitly requires a broad wiki audit.
- When a completed task produces durable knowledge worth reusing, update `_wiki/` without waiting for a separate save request:
  - save or update the relevant page
  - refresh `_wiki/podcast.md`
  - update `_wiki/index.md` when navigation changes
  - append `_wiki/log.md`
- For browser-facing work, verify layout and runtime behavior in a real browser when practical.
- For Worker, D1, auth, storage, and export behavior, add or update focused tests.
- Do not add secrets, local sample images, generated output, or private notes to git.
- Preserve Thai text and project copy as UTF-8.

## Useful Commands

- `npm run dev`
- `npm run build`
- `npm test`
- `npm run worker:check`
- `npm run context:refresh`

## Context Maintenance

Run `npm run context:refresh` after adding, moving, or deleting major files.
Update `.agents/active.md` when the active task, blockers, or next action changes.
Add durable findings to `.agents/topics/` when they will help future sessions.
