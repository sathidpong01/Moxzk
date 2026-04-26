# Wiki Agent Guide

Use this file when Codex is working on `_wiki/`.

## Purpose

Turn raw source material into a maintained Markdown knowledge base.

The goal is not one-off Q and A. The goal is to compile knowledge into durable pages that stay useful across sessions.

## Read Order

Balanced default:

- For research, ongoing strategy, repeated questions, or any task that likely depends on accumulated knowledge, read in this order:
  1. `podcast.md`
  2. `index.md`
  3. relevant pages in `sources/`, `concepts/`, `entities/`, or `outputs/`
  4. raw source files in `raw/` or `../Clippings/` only when needed
- For narrow coding work that is clearly local to a few repo files, skip `_wiki/` unless the user asks for historical or research context.
- Do not read the entire wiki by default.

## Directory Rules

- Never edit files inside `raw/`
- Never edit files inside `../Clippings/`; treat them as Web Clipper source snapshots
- Prefer updating an existing page over creating a near-duplicate
- Keep pages linkable and easy to scan
- Preserve Thai text as UTF-8

## Operations

### Ingest

When the user asks to ingest a source:

1. Read the raw file
2. Create or update a page under `sources/` if the source deserves its own durable summary
3. Update affected pages under `concepts/` and `entities/`
4. Update `index.md`
5. Refresh `podcast.md` with the newest high-value context in 300 to 500 words
6. Append an entry to `log.md`

Clipping convention:

- Obsidian Web Clipper output normally lands in `../Clippings/`
- Keep those files as raw inputs
- Capture the original `source`, `created`, `description`, and useful tags from frontmatter when creating `_wiki/sources/` pages
- If the clipping is about this codebase's implementation patterns, also update a concept page under `concepts/`

### Query

When the user asks a question against the wiki:

1. Read `index.md` first
2. Read only the relevant pages
3. Answer from the maintained pages, not by re-reading every raw source unless required
4. If the answer is durable and the user wants to keep it, save it under `outputs/` and update `index.md` plus `log.md`

### Task Closeout

When non-trivial work finishes, decide whether the result belongs in `_wiki/`.

Write back to the wiki by default when the task produced:

- a reusable explanation
- a stable workflow or rule
- research findings likely to matter again
- a comparison, tradeoff, or decision summary

Usually skip wiki writes for:

- one-off mechanical edits
- trivial bug fixes with no durable lesson
- temporary status updates that belong only in `_codex/` or chat

If writing back:

1. update or create the most relevant page
2. update `index.md` if navigation changed
3. refresh `podcast.md`
4. append `log.md`

### Lint

When the user asks to lint or clean the wiki:

- find contradictions
- find stale claims
- find orphan pages
- find duplicate or overlapping pages
- find concepts mentioned often but missing their own page
- suggest missing sources or follow-up questions

## Page Shape

Use simple Markdown. Prefer this structure when useful:

- `# Title`
- `## Summary`
- `## Key Points`
- `## Links`
- `## Sources`
- `## Open Questions`

## Naming

- source pages: `sources/YYYY-MM-DD-short-title.md` when date is known
- output pages: `outputs/YYYY-MM-DD-short-title.md`
- concept or entity pages: stable readable names

## Prompt Starters

- `Read _wiki/AGENTS.md and ingest _wiki/raw/<file>`
- `Read _wiki/AGENTS.md and ingest Clippings/<file>`
- `Answer from the wiki only, then tell me which pages you used`
- `Lint _wiki and propose the next 3 missing pages`
- `Save this answer into _wiki/outputs/ and update the index`
