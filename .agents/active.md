# Active Project Context

Updated: 2026-04-17
Branch: master
Project type: node, react, vite, typescript, cloudflare-worker, drizzle-d1

## Current Focus

Create an agent-context-kit style context layer for this repository without disturbing the existing `.agents/skills` and `.agents/workflows` directories.

## Current State

- The project already has extensive local agent skills under `.agents/skills`.
- The project now has the missing durable context folders: `index`, `sessions`, `topics`, and `private`.
- `scripts/update_repo_context.py` can refresh `.agents/index/repo-tree.md`.
- `.agents/private/` is local-only and should stay ignored.

## Next Action

Keep `.agents/active.md` current during future work. Add focused session notes under `.agents/sessions/` for long-running tasks, and refresh the repo tree after structural changes.

## Known Constraints

- Thai text must remain valid UTF-8.
- PanelCleaner is an external dependency and must not be vendored.
- Cloudflare Worker, D1, R2, and auth behavior need focused verification before deployment.
- Local env files and `.dev.vars*` must stay out of git.
