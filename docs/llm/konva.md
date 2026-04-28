# Konva AI Documentation

Use this file before changing Moxzk canvas, editor interaction, selection, transform, drag, export, or Konva-related rendering behavior.

## Detected Stack

- `konva`: `^10.2.5`
- `react-konva`: `^19.2.3`
- `react-konva-utils`: `^2.0.0`
- React: `^19.2.5`

Source: `package.json`.

## Official AI Resources

Konva publishes machine-readable documentation and an MCP server for AI coding tools.

- AI tools page: <https://konvajs.org/docs/ai_tools.html>
- LLM summary: <https://konvajs.org/llms.txt>
- Full API text: <https://konvajs.org/llms-full.txt>
- AI plugin identity: <https://konvajs.org/.well-known/ai-plugin.json>

## MCP

Codex machine config includes the Konva documentation MCP server:

```toml
[mcp_servers.konva_documentation]
command = "npx"
args = ["crawl-chat-mcp", "--id=67d221efb4b9de65095a2579", "--name=konva_documentation"]
```

The MCP server is available after restarting the Codex session/tooling.

Generic command from Konva:

```powershell
npx crawl-chat-mcp --id=67d221efb4b9de65095a2579 --name=konva_documentation
```

## Local Usage Rules

- Mention `Konva` or `react-konva` explicitly when asking agents for canvas changes.
- Prefer official Konva docs and MCP results over memory for API details.
- Use `docs/llm/konva.md` as the local entrypoint, then fetch a specific official page or MCP answer for the exact API.
- Keep Moxzk canvas behavior consistent with existing editor stores, viewport services, and selection/transform flows.
- Verify visible canvas interaction changes in a real browser when practical.

## Repo-Specific Pointers

- `src/components/Editor/CanvasEditor.tsx`: main React Konva editor surface
- `src/services/konvaInteraction.ts`: small interaction predicates for Konva targets
- `src/services/workspaceViewport.ts`: stage/workspace viewport sizing and positioning
- `src/services/exporter.ts`: stage export behavior
- `_wiki/concepts/konva-image-dragging.md`: local distilled guidance from Konva drag docs

## Official Konva Patterns To Remember

- Konva uses a `Stage -> Layer -> Group -> Shape` hierarchy.
- Drag behavior is usually enabled per node with `draggable: true` or `draggable()`.
- Each `Layer` is its own canvas; this matters for rendering and performance.
- `Transformer` handles interactive resize/rotate of selected nodes.
- `toDataURL`, `toBlob`, and related APIs are the documented export path.
- For large canvas/editor changes, verify performance guidance against <https://konvajs.org/docs/performance/All_Performance_Tips.html>.
