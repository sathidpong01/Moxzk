# Konva AI Tools

## Summary

Konva provides AI-oriented documentation surfaces for coding agents: an MCP server, a concise `llms.txt`, a full text API reference, and an AI plugin identity file.

For MG_Translater, these resources should be used whenever canvas/editor work depends on Konva or react-konva API details.

## Key Points

- Konva's MCP server is powered by CrawlChat
- the generic MCP command is `npx crawl-chat-mcp --id=67d221efb4b9de65095a2579 --name=konva_documentation`
- Konva publishes `https://konvajs.org/llms.txt` as a concise AI summary
- Konva publishes `https://konvajs.org/llms-full.txt` as full plain-text API reference
- Konva publishes `https://konvajs.org/.well-known/ai-plugin.json` as machine-readable identity/capability metadata
- Konva recommends asking about one Konva task at a time and verifying generated code against the docs/API reference

## MG_Translater Decision

Use both layers:

- MCP in Codex config for live documentation lookup after restart
- local `llms.txt` and `docs/llm/konva.md` as stable repo-readable entrypoints

## Links

- [[_wiki/concepts/konva-ai-documentation|Konva AI Documentation]]
- [[_wiki/concepts/konva-image-dragging|Konva Image Dragging]]

## Sources

- <https://konvajs.org/docs/ai_tools.html>
- <https://konvajs.org/llms.txt>
- <https://konvajs.org/.well-known/ai-plugin.json>
