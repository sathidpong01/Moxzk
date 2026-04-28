# Wiki Log

Keep this file append-only.

Recommended heading shape:

`## [YYYY-MM-DD] action | title`

## [2026-04-23] scaffold | initialize codex-first wiki

- Created `_wiki/` as a Codex-first knowledge layer
- Added `README.md`, `AGENTS.md`, `index.md`, `log.md`, and `podcast.md`
- Added empty folders for `raw/`, `sources/`, `concepts/`, `entities/`, and `outputs/`
- Linked the wiki from `_codex/dashboard.md` and `_codex/README.md`

## [2026-04-23] ingest | karpathy llm wiki note

- Ingested the local note `สรุปแนวคิด LLM Wiki สไตล์ Andrej Karpathy.md`
- Created a source page for the note and a concept page for the repo-specific Codex adaptation
- Kept the adaptation aligned with the existing `_codex/` plus `.agents/` split

## [2026-04-25] ingest | konva drag image clipping

- Treated `Clippings/` as the Obsidian Web Clipper source inbox
- Ingested the Konva drag-image clipping into `_wiki/sources/`
- Added a concept page for Konva image dragging patterns relevant to Moxzk
- Added `/Clippings/` to `.gitignore` so raw clipped source snapshots stay local-only by default

## [2026-04-25] docs | konva ai documentation

- Added project-level `llms.txt`
- Added `docs/llm/konva.md` as the local Konva/react-konva AI documentation entrypoint
- Added Konva MCP server config to Codex machine config
- Ingested Konva AI Tools into `_wiki/sources/` and `_wiki/concepts/`
