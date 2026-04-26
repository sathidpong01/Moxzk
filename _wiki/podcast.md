# Podcast

This file is the short recent-context digest for `_wiki/`.

Current state:

- `_wiki/` is now the Codex-first knowledge base layer for this repo
- `_codex/` still handles active task intake and handoff
- `.agents/` still holds durable repo engineering context
- The first ingested source is the local Karpathy-style LLM Wiki summary note
- `Clippings/` is now treated as the local Obsidian Web Clipper inbox and raw source snapshots should stay unedited there
- The Konva drag-image clipping established the pattern: compile durable implementation notes into `_wiki/sources/` and `_wiki/concepts/`
- Konva official AI resources are now wired into the project via `llms.txt`, `docs/llm/konva.md`, and Codex MCP config `konva_documentation`

Next useful step:

- continue clipping source pages into `Clippings/`
- ask Codex to ingest relevant clippings into `_wiki/`
- keep raw clippings local-only unless there is a specific reason to commit one
- restart Codex before expecting the new Konva MCP server to appear in tool lists
