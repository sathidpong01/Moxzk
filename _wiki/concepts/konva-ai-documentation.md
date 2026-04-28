# Konva AI Documentation

## Summary

Konva now has AI-readable documentation endpoints and an MCP server. Moxzk should use them as the official source layer for canvas/editor changes.

## Local Entry Points

- `llms.txt`: project-level LLM entrypoint
- `docs/llm/konva.md`: Konva-specific local guide
- `_wiki/sources/2026-04-25-konva-ai-tools.md`: source summary for Konva AI tools

## MCP

Codex config includes:

```toml
[mcp_servers.konva_documentation]
command = "npx"
args = ["crawl-chat-mcp", "--id=67d221efb4b9de65095a2579", "--name=konva_documentation"]
```

This requires a Codex restart before the MCP server is available in a new session.

## Usage Rule

Before non-trivial Konva changes:

1. Read `docs/llm/konva.md`
2. Use Konva MCP or official docs for the specific API
3. Match existing Moxzk editor state and viewport patterns
4. Verify browser behavior when visible canvas interaction changes
