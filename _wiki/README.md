# Codex-First LLM Wiki

This folder is a local, Markdown-first knowledge base that Codex can maintain over time.

Use it for external sources, research notes, product references, and durable analyses that should compound instead of disappearing into chat history.

## Layer Split

- `_codex/` = short task intake, active work, handoff
- `_wiki/` = source ingestion, synthesis, saved outputs
- `.agents/` = durable repo engineering context and rules
- repo files = source of truth for the product itself

## Directory Map

- `raw/` = immutable source material
- `sources/` = one page per ingested source when needed
- `concepts/` = synthesized topic pages
- `entities/` = people, tools, projects, companies
- `outputs/` = saved query results, comparisons, briefs
- `index.md` = catalog of pages
- `log.md` = append-only operations timeline
- `podcast.md` = short recent-context digest
- `AGENTS.md` = Codex instructions for maintaining the wiki

## Recommended Workflow

1. Put a source file into `raw/`
2. Ask Codex to read `_wiki/AGENTS.md` and ingest the source
3. Review changes in `index.md`, `podcast.md`, and touched pages
4. Ask follow-up questions against the wiki
5. Save any durable answers into `outputs/`

## Good Fit

- article or video summaries
- competitor or tool research
- architecture notes that should stay queryable
- repeated questions that should accumulate answers over time

## Not The Right Place

- transient coding todo items
- private scratch notes better kept in `.agents/private/`
- product truth that belongs in source code, tests, or docs
