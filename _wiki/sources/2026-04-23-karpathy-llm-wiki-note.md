# Karpathy LLM Wiki Note

## Summary

This source captures the Karpathy-style LLM wiki pattern as a local, Markdown-first knowledge base maintained by an agent.

The key shift is from query-time retrieval to compilation. Instead of repeatedly searching raw documents from scratch, the agent incrementally turns source material into maintained wiki pages, indexes, links, and saved outputs.

## Key Points

- raw sources stay immutable
- the wiki is the maintained synthesis layer
- a schema file tells the agent how to ingest, query, and lint
- Obsidian is the reading surface while the agent does the maintenance work
- answers can be saved back into the wiki so knowledge compounds over time
- a short digest file such as `podcast.md` can reduce repeated context loading

## Codex Adaptation

The note describes Cross Code as the main operator, but the pattern does not depend on Cross Code specifically.

In this repo the adaptation is:

- Codex = primary wiki maintainer
- `_wiki/AGENTS.md` = schema and operating rules
- `_wiki/` = knowledge base
- `_codex/` = short operational handoff layer
- `.agents/` = durable repo engineering context

## Links

- [[_wiki/concepts/codex-first-llm-wiki|Codex-First LLM Wiki]]

## Sources

- Local note: `D:\MG_Translater\สรุปแนวคิด LLM Wiki สไตล์ Andrej Karpathy.md`
- Karpathy gist: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
