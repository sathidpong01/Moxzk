# MG_Translater Agent Guide

This file is the entry point for AI coding agents working in this repository.
For the fuller project context layer, read `.agents/AGENTS.md` first, then load only the topic or session notes relevant to the task.

## Priority Context

1. `CLAUDE.md` contains the historical project-wide operating notes.
2. `.agents/AGENTS.md` contains the current agent workflow policy.
3. `.agents/active.md` records the current project state and next action.
4. `.agents/index/repo-tree.md` is generated and should be refreshed after major structure changes.
5. `.agents/topics/` contains durable notes for specific areas.

## Basic Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Tests: `npm test`
- Focused tests:
  - Settings/runtime: `npm run test:settings`
  - Runtime/Electron seams: `npm run test:runtime`
  - Editor/canvas/text: `npm run test:editor`
  - Export: `npm run test:export`
  - Album flow: `npm run test:album`
  - Cleanup/batch processing: `npm run test:cleanup`
  - Cache/context services: `npm run test:cache`
- Worker dry run: `npm run worker:check`
- Refresh agent repo tree: `npm run context:refresh`

## Test Selection Policy

- During implementation, run the smallest relevant focused test group first.
- Run `npm run build` when TypeScript, React, runtime contracts, or shared interfaces change.
- Run full `npm test` before commit/push, large refactors, or shared cross-cutting changes.
- Run `npm run worker:check` only when Worker/Cloudflare files are touched.

## Boundaries

- Do not commit `.env*`, `.dev.vars*`, `.wrangler/`, `output/`, generated builds, or `.agents/private/`.
- Treat PanelCleaner as an external CLI dependency. Do not vendor GPLv3 PanelCleaner code into this repo.
- Keep Cloudflare D1 schema changes in Drizzle migrations and run the relevant checks before shipping.
- Preserve Thai text as UTF-8. Check for replacement characters (`U+FFFD`) after editing Thai content.
- Desktop/Electron is the primary acceptance target. Keep desktop workflows stable first and do not spend implementation effort on small-screen/mobile layouts unless the user explicitly asks for it.
