# Agent Team

This file defines the default specialist team for MG_Translater. Use it to route work quickly without loading unrelated project context.

## Why This Team

MG_Translater has several high-risk seams: Konva canvas editing, Ollama OCR/translation, PanelCleaner cleanup, Cloudflare D1/R2 album storage, and the future Electron runtime boundary. The team is split around those seams so future sessions can load only the context and tests that matter for the requested work.

## Operating Model

- One agent owns coordination for the session. Specialist agents own narrow, disjoint file areas.
- Do not spawn multiple agents into the same files unless the coordinator has an explicit merge plan.
- Start with the smallest relevant read set: `AGENTS.md`, `.agents/AGENTS.md`, `.agents/active.md`, this file, then the role-specific files below.
- Prefer focused tests first. Run full `npm test` only for broad shared changes, pre-commit/pre-push checks, or when multiple areas interact.
- Keep `.agents/private/`, `.env*`, `.dev.vars*`, `.wrangler/`, `output/`, and generated builds out of git.

## Team Roster

| Role | Use For | Primary Ownership | Must Read | Verify With |
| --- | --- | --- | --- | --- |
| Coordinator | task routing, scope control, conflict resolution, final integration | `.agents/*`, root docs, cross-area diffs | `AGENTS.md`, `.agents/AGENTS.md`, `.agents/active.md`, `.agents/team.md` | relevant focused tests, `npm run build` when contracts change |
| Product UX Lead | editor workflow, product shape, copy, panel/drawer ergonomics | `src/components/**`, `src/index.css`, user-facing docs | `DESIGN.md`, `.agents/topics/service-overview.md` | browser check, `npm run test:editor` when editor behavior changes |
| Canvas/Konva Engineer | artboard, selection, transforms, text regions, export rendering previews | `src/components/Editor/**`, `src/utils/textLayout.ts`, canvas-related tests | `docs/llm/konva.md`, `llms.txt`, relevant `_wiki/concepts/konva-*.md` | `npm run test:editor`, browser canvas check |
| AI Pipeline Engineer | Ollama OCR/translation, prompt behavior, story context, model settings | `src/services/ollama.ts`, `src/services/story-context.ts`, `src/services/settingsStorage.ts`, related tests | `.agents/workflows/skills.md`, `.agents/skills/ollama/SKILL.md`, prompt-related tests | `npm run test:settings`, `npm run test:cache` |
| Cleanup Pipeline Engineer | PanelCleaner bridge, cleanup queue, local processing, batch behavior | `scripts/panelcleaner-bridge.mjs`, `src/services/panelcleaner-api.ts`, `src/services/batch-processing.ts` | `.agents/active.md`, `.agents/topics/service-overview.md` | `npm run test:cleanup` |
| Runtime/Electron Engineer | AppRuntime seams, future desktop shell, native action boundaries | `src/runtime/**`, runtime-related services, desktop-readiness tests | `.agents/active.md`, `.agents/skills/electron-best-practices/SKILL.md` | `npm run test:runtime`, `npm run build` |
| Cloudflare Data Engineer | Worker API, auth, D1/R2 albums, migrations, deployment config | `src/worker/**`, `drizzle/**`, `wrangler.jsonc`, `docs/cloudflare-d1-schema.md` | `.agents/topics/service-overview.md`, current Worker config | relevant worker/API tests, `npm run worker:check` |
| Verification Engineer | regression tests, browser checks, build/test triage | `scripts/*.test.mjs`, test helpers, verification notes | package scripts in `package.json`, `.agents/AGENTS.md` test policy | smallest focused test, then `npm test` when warranted |
| Knowledge Steward | durable wiki/topic notes, context refresh, handoff docs | `_wiki/**`, `.agents/topics/**`, `.agents/index/repo-tree.md`, `_codex/**` | `_wiki/AGENTS.md`, `_wiki/podcast.md`, `_wiki/index.md` only when relevant | `npm run context:refresh` after major structure changes |
| Release Steward | branch status, staging, commit/push safety, release notes | git state, `README.md`, changelog/release docs if added | `AGENTS.md` boundaries, `.agents/AGENTS.md`, current `git status --short` | `git diff --cached --check`, `npm test`/build as appropriate |

## Routing Rules

- Editor or canvas work: start with Canvas/Konva Engineer. Add Product UX Lead when the question is about perceived app quality, layout, or workflow.
- OCR, translation, prompt, model, or settings behavior: start with AI Pipeline Engineer. Add Verification Engineer for tests that protect prompt/model regressions.
- Cleanup or PanelCleaner work: start with Cleanup Pipeline Engineer. Do not edit or vendor PanelCleaner internals.
- Album storage, auth, D1, R2, or Worker routes: start with Cloudflare Data Engineer. Run `npm run worker:check` only when Worker/Cloudflare files changed.
- Runtime boundary or Electron preparation: start with Runtime/Electron Engineer and keep desktop acceptance ahead of mobile polish.
- Large cross-cutting work: Coordinator creates the split first, then assigns specialists by non-overlapping ownership.
- Documentation, repeated decisions, or source ingestion: Knowledge Steward updates durable context after the code or decision is settled.
- Commit/push/release requests: Release Steward verifies dirty state and staging scope before committing.

## Specialist Prompt Template

Use this template when assigning a specialist:

```text
You are the [Role] for MG_Translater.
Goal: [one concrete outcome]
Ownership: [files/directories this agent may edit]
Read first: AGENTS.md, .agents/AGENTS.md, .agents/active.md, .agents/team.md, then [role-specific files]
Constraints: preserve Thai UTF-8, keep private/env/generated files out of git, follow existing patterns.
Verification: run [focused command] or explain why it is not applicable.
Do not touch files outside ownership unless you report the need first.
Return: changed files, verification result, risks or follow-ups.
```

## Integration Checklist

- Confirm no specialist edited outside its declared ownership.
- Review overlapping imports/types when multiple roles touched shared contracts.
- Run the narrowest tests that cover each touched area.
- Run `npm run build` when TypeScript, React contracts, runtime contracts, or shared interfaces changed.
- Update `.agents/active.md`, `.agents/topics/`, or `_wiki/` only when the outcome creates reusable context.
- Refresh `.agents/index/repo-tree.md` after adding, moving, or deleting major files.
