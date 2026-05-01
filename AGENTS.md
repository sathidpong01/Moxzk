# Moxzk Agent Guide

This file is the entry point for AI coding agents working in this repository.
For the fuller project context layer, read `.agents/AGENTS.md` first, then load only the topic or session notes relevant to the task.

## Priority Context

1. `CLAUDE.md` contains the historical project-wide operating notes.
2. `.agents/AGENTS.md` contains the current agent workflow policy.
3. `.agents/active.md` records the current project state and next action.
4. `.agents/team.md` defines the specialist agent roster, routing rules, and ownership boundaries.
5. `.agents/index/repo-tree.md` is generated and should be refreshed after major structure changes.
6. `.agents/topics/` contains durable notes for specific areas.
7. `llms.txt` is the LLM-readable project entrypoint.
8. `docs/llm/konva.md` is the Konva/react-konva documentation entrypoint for canvas editor work.
9. `docs/codex-cloud-environment.md` contains the Codex cloud setup script, environment variables, and cloud verification limits.

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
- Codex cloud setup script: `bash scripts/codex-cloud-setup.sh`

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
- Windows desktop/Electron is the only supported app target. Keep Windows desktop workflows stable first and do not spend implementation effort on Linux/macOS or small-screen/mobile layouts unless the user explicitly asks for it.

## Product Language

Moxzk is being shaped as a product for ordinary users, not as a developer-facing tool. In user-facing UI, avoid implementation terms such as R2, D1, metadata, Worker, object key, token hash, or session internals unless the screen is explicitly a developer diagnostic view. Explain actions in plain user language, for example "รูปภาพและงานที่บันทึกไว้" instead of storage implementation details. Thai copy should read naturally for a non-technical user.

## graphify

This project is configured to use a graphify knowledge graph at graphify-out/ once generated.
In Codex Desktop, invoke it with `$graphify .` from this repo after starting a fresh session.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
