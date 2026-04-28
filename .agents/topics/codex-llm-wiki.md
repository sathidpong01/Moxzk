# Codex-First LLM Wiki

Use `_wiki/` for source-heavy knowledge that should compound over time.

## Layer Split

- `_codex/` = short operational notes and handoff
- `_wiki/` = maintained knowledge base
- `.agents/` = durable repo engineering context

## Working Rules

- raw source files go under `_wiki/raw/` and stay immutable
- Obsidian Web Clipper files usually land in `Clippings/`; treat that folder as a local-only raw source inbox
- Codex should read `_wiki/AGENTS.md` before ingesting or querying the wiki
- `podcast.md` is the first fast context file to read
- `index.md` is the catalog for navigation
- durable answers can be saved under `_wiki/outputs/`
- use balanced defaults:
  - read `_wiki/podcast.md` first only when the task likely needs accumulated knowledge
  - then read `index.md` and only the relevant pages
  - do not load the whole wiki for narrow local code edits
- when work finishes and produces reusable knowledge, Codex should write it back into `_wiki/` without needing a separate user prompt
- raw clipped files should normally stay out of git; commit the compiled `_wiki/` summary instead
- Konva/react-konva work now has a dedicated local entrypoint at `docs/llm/konva.md` and a project `llms.txt`

## Why This Exists

This adapts the Karpathy-style LLM wiki pattern to Moxzk without replacing the repo's existing agent context structure.

The repo already had:

- `.agents/` for engineering context
- `_codex/` for Obsidian handoff

The missing layer was a dedicated Codex-maintained knowledge base for research and persistent synthesis.
