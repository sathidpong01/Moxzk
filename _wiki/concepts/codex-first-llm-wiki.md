# Codex-First LLM Wiki

## Summary

This concept adapts Karpathy's LLM wiki pattern to the existing MG_Translater workspace without replacing the repo's current agent context system.

The important design choice is to add a knowledge layer, not to collapse everything into one folder.

## Structure

- `_wiki/raw/` holds raw source material
- `_wiki/sources/`, `_wiki/concepts/`, and `_wiki/entities/` hold maintained pages
- `_wiki/index.md` is the catalog
- `_wiki/log.md` is the append-only timeline
- `_wiki/podcast.md` is the short recent-context digest
- `_wiki/AGENTS.md` tells Codex how to operate the wiki

## Repo-Specific Split

- `_codex/` stays short and operational
- `_wiki/` stores compounding knowledge
- `.agents/` keeps durable engineering context close to the codebase
- source code, tests, and docs remain the product truth

## Why This Fit Is Better Than Copying The Video 1:1

- it keeps your existing Obsidian plus Codex flow intact
- it uses Codex directly instead of introducing another editor agent
- it avoids mixing research memory with active implementation notes
- it makes future source ingestion explicit and repeatable

## Practical Prompts

- `Read _wiki/AGENTS.md and ingest _wiki/raw/<file>`
- `Answer from the wiki, then save the result if it is worth keeping`
- `Lint _wiki for duplicates, contradictions, and missing pages`

## Links

- [[_wiki/sources/2026-04-23-karpathy-llm-wiki-note|Karpathy LLM Wiki Note]]

## Sources

- `D:\MG_Translater\สรุปแนวคิด LLM Wiki สไตล์ Andrej Karpathy.md`
- <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
