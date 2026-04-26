# Repository Tree

Root: `MG_Translater`

```text
.
|-- .agents/
|   |-- index/
|   |   `-- repo-tree.md
|   |-- private/
|   |   `-- .gitkeep
|   |-- sessions/
|   |   `-- .gitkeep
|   |-- topics/
|   |   |-- codex-llm-wiki.md
|   |   `-- service-overview.md
|   |-- workflows/
|   |   |-- dev.md
|   |   `-- skills.md
|   |-- active.md
|   |-- AGENTS.md
|   `-- team.md
|-- .claude/
|-- .cursor/
|   `-- rules/
|       `-- mg-translater-skills.mdc
|-- .obsidian/
|   |-- app.json
|   |-- appearance.json
|   |-- bookmarks.json
|   |-- core-plugins.json
|   `-- workspace.json
|-- .windsurf/
|   `-- workflows/
|       |-- dev.md
|       |-- review.md
|       `-- skills.md
|-- _codex/
|   |-- browser-check/
|   |   |-- artifacts/
|   |   |   |-- bubble-layout-check/
|   |   |   |   |-- trial-100.png
|   |   |   |   |-- verify-zoom-100.png
|   |   |   |   |-- verify-zoom-150.png
|   |   |   |   |-- verify-zoom-35.png
|   |   |   |   |-- zoom-100-selected.png
|   |   |   |   |-- zoom-150-selected.png
|   |   |   |   `-- zoom-35.png
|   |   |   |-- bubble-layout-polish/
|   |   |   |   |-- hud-closed.png
|   |   |   |   |-- hud-menu-open-polished.png
|   |   |   |   `-- hud-menu-open.png
|   |   |   `-- expand-box-fix/
|   |   |       |-- after-expand.png
|   |   |       `-- before-expand.png
|   |   |-- export-destination-check.png
|   |   |-- package.json
|   |   `-- sample-export.png
|   |-- browser-smoke/
|   |   |-- downloads/
|   |   |   |-- failure-1777189648539.png
|   |   |   |-- failure-1777189791456.png
|   |   |   |-- failure-1777189968306.png
|   |   |   |-- failure-1777190113397.png
|   |   |   `-- page-1.zip
|   |   `-- sample-page.png
|   |-- artistic-frame-browser-check.png
|   |-- artistic-frame-resize-browser-check.png
|   |-- artistic-free-browser-check.png
|   |-- current-task.md
|   |-- dashboard.md
|   |-- decisions.md
|   |-- handoff.md
|   |-- inbox.md
|   |-- inline-font-measure-after-fix.png
|   |-- inline-font-measure-before-fix.png
|   `-- README.md
|-- _wiki/
|   |-- concepts/
|   |   |-- .gitkeep
|   |   |-- codex-first-llm-wiki.md
|   |   |-- konva-ai-documentation.md
|   |   `-- konva-image-dragging.md
|   |-- entities/
|   |   `-- .gitkeep
|   |-- outputs/
|   |   `-- .gitkeep
|   |-- raw/
|   |   |-- .gitkeep
|   |   `-- Getting Started with Konva — HTML5 Canvas 2D Framework  Konva - JavaScript Canvas 2d Library.md
|   |-- sources/
|   |   |-- .gitkeep
|   |   |-- 2026-04-23-karpathy-llm-wiki-note.md
|   |   |-- 2026-04-25-konva-ai-tools.md
|   |   `-- 2026-04-25-konva-drag-image.md
|   |-- AGENTS.md
|   |-- index.md
|   |-- log.md
|   |-- podcast.md
|   `-- README.md
|-- Clippings/
|   |-- How to use portals in react-konva  Konva - JavaScript Canvas 2d Library.md
|   |-- HTML5 Canvas All Konva performance tips list  Konva - JavaScript Canvas 2d Library.md
|   |-- HTML5 Canvas Drag and Drop an Image  Konva - JavaScript Canvas 2d Library.md
|   |-- HTML5 Canvas Drag and Drop Tutorial  Konva - JavaScript Canvas 2d Library.md
|   |-- HTML5 Canvas Optimize Strokes Performance Tip  Konva - JavaScript Canvas 2d Library.md
|   |-- HTML5 Canvas Set Shape Opacity Tutorial  Konva - JavaScript Canvas 2d Library.md
|   `-- HTML5 Canvas Set Shape Stroke Color and Width Tutorial  Konva - JavaScript Canvas 2d Library.md
|-- docs/
|   |-- electron/
|   |   |-- desktop-smoke-test.md
|   |   `-- ipc-contract.md
|   |-- llm/
|   |   `-- konva.md
|   `-- cloudflare-d1-schema.md
|-- drizzle/
|   |-- meta/
|   |   |-- 0000_snapshot.json
|   |   |-- 0001_snapshot.json
|   |   |-- 0002_snapshot.json
|   |   `-- _journal.json
|   |-- 0000_parallel_stranger.sql
|   |-- 0001_artboard_layout.sql
|   `-- 0002_bizarre_zodiak.sql
|-- electron/
|   |-- main/
|   |   |-- index.ts
|   |   |-- ipc.ts
|   |   `-- localServices.ts
|   |-- preload/
|   |   `-- index.ts
|   `-- shared/
|       `-- ipcChannels.ts
|-- out/
|   |-- main/
|   |   `-- index.js
|   |-- preload/
|   |   `-- index.js
|   `-- renderer/
|       |-- assets/
|       |   |-- index-BiyCKkVR.css
|       |   `-- index-DvPUwxYu.js
|       |-- index.html
|       `-- vite.svg
|-- public/
|   `-- vite.svg
|-- scripts/
|   |-- album-open.test.mjs
|   |-- album-save-plan.test.mjs
|   |-- auth-smoke-user.mjs
|   |-- auth-smoke-user.test.mjs
|   |-- batch-processing.test.mjs
|   |-- browser-smoke.mjs
|   |-- browser-smoke.test.mjs
|   |-- cache-services.test.mjs
|   |-- d1-schema.test.mjs
|   |-- editor-history-service.test.mjs
|   |-- editor-model.test.mjs
|   |-- editor-processing-ui.test.mjs
|   |-- export-drawer.test.mjs
|   |-- export-preview-cache.test.mjs
|   |-- export-preview-viewport.test.mjs
|   |-- export-preview.test.mjs
|   |-- exporter.test.mjs
|   |-- inline-text-editor.test.mjs
|   |-- ollama-prompt.test.mjs
|   |-- oop-boundaries.test.mjs
|   |-- panelcleaner-bridge.mjs
|   |-- panelcleaner-csv.mjs
|   |-- panelcleaner-csv.test.mjs
|   |-- pre-electron-readiness.test.mjs
|   |-- settings-model-guide.test.mjs
|   |-- smoke-env.mjs
|   |-- story-context.test.mjs
|   |-- text-hud-position.test.mjs
|   |-- text-layout.test.mjs
|   |-- update_repo_context.py
|   |-- viewer-zoom.test.mjs
|   |-- worker-smoke.mjs
|   |-- worker-smoke.test.mjs
|   `-- workspace-viewport.test.mjs
|-- src/
|   |-- components/
|   |   |-- Albums/
|   |   |   |-- AlbumCard.tsx
|   |   |   |-- AlbumListModal.tsx
|   |   |   |-- AlbumPageGrid.tsx
|   |   |   `-- ConfirmModal.tsx
|   |   |-- Auth/
|   |   |   |-- AuthModal.tsx
|   |   |   `-- UserMenu.tsx
|   |   |-- Comparison/
|   |   |   `-- SplitView.tsx
|   |   |-- Editor/
|   |   |   |-- ArtboardWorkspace.tsx
|   |   |   |-- CanvasEditor.tsx
|   |   |   |-- ContextualTextHud.tsx
|   |   |   |-- ExportDrawer.tsx
|   |   |   |-- FloatingInspector.tsx
|   |   |   |-- FontSelector.tsx
|   |   |   |-- ImageStrip.tsx
|   |   |   |-- InlineTextEditor.tsx
|   |   |   |-- OcrCorrectionModal.tsx
|   |   |   |-- OversetTextBadge.tsx
|   |   |   |-- PageOverviewGrid.tsx
|   |   |   |-- PropertiesPanel.tsx
|   |   |   `-- StrokeJoinPreview.tsx
|   |   |-- Layout/
|   |   |   |-- LogPanel.tsx
|   |   |   |-- PanelToggleBar.tsx
|   |   |   `-- WorkspaceBackdrop.tsx
|   |   |-- Processing/
|   |   |   |-- ProcessingView.tsx
|   |   |   `-- ResourceMonitor.tsx
|   |   |-- Settings/
|   |   |   |-- FontConfigPage.tsx
|   |   |   `-- SettingsPanel.tsx
|   |   |-- Steps/
|   |   |   |-- EditStep.tsx
|   |   |   `-- UploadStep.tsx
|   |   |-- ui/
|   |   |   `-- primitives.tsx
|   |   `-- Upload/
|   |       `-- ImageUploader.tsx
|   |-- config/
|   |   `-- fonts.ts
|   |-- hooks/
|   |   |-- useAutoSave.ts
|   |   |-- useEditorActions.ts
|   |   |-- useFloatingPanel.ts
|   |   `-- useKeyboardShortcuts.ts
|   |-- lib/
|   |-- runtime/
|   |   |-- desktopDraftCodec.ts
|   |   |-- electronBridge.ts
|   |   |-- electronRuntime.ts
|   |   |-- index.ts
|   |   |-- types.ts
|   |   `-- webRuntime.ts
|   |-- services/
|   |   |-- albumImageUrls.ts
|   |   |-- albumOpen.ts
|   |   |-- albumSavePlan.ts
|   |   |-- batch-processing.ts
|   |   |-- brushStrokes.ts
|   |   |-- cleanup-diff-bboxes.ts
|   |   |-- cleanup-provider.ts
|   |   |-- cloudflareApi.ts
|   |   |-- editorCursor.ts
|   |   |-- editorHistory.ts
|   |   |-- exportDrawer.ts
|   |   |-- exporter.ts
|   |   |-- exportPreview.ts
|   |   |-- exportPreviewCache.ts
|   |   |-- exportPreviewViewport.ts
|   |   |-- exportRendering.ts
|   |   |-- fontStorage.ts
|   |   |-- imageCache.ts
|   |   |-- inlineTextEditor.ts
|   |   |-- keyboardShortcuts.ts
|   |   |-- konvaInteraction.ts
|   |   |-- ollama.ts
|   |   |-- panelcleaner-api.ts
|   |   |-- projectDraftStorage.ts
|   |   |-- request-timeout.ts
|   |   |-- settingsStorage.ts
|   |   |-- sourceLanguage.ts
|   |   |-- storageService.ts
|   |   |-- story-context.ts
|   |   |-- textHudPosition.ts
|   |   |-- textRegionMode.ts
|   |   |-- translationMemory.ts
|   |   |-- translationReview.ts
|   |   |-- translator-api.ts
|   |   |-- viewerZoom.ts
|   |   `-- workspaceViewport.ts
|   |-- store/
|   |   |-- albumStore.ts
|   |   |-- appStore.ts
|   |   `-- authStore.ts
|   |-- types/
|   |   |-- database.ts
|   |   `-- index.ts
|   |-- utils/
|   |   |-- fileValidation.ts
|   |   |-- parseApiError.ts
|   |   `-- textLayout.ts
|   |-- worker/
|   |   |-- db/
|   |   |   `-- schema.ts
|   |   |-- albums.ts
|   |   |-- auth.ts
|   |   |-- crypto.ts
|   |   |-- env-secrets.d.ts
|   |   |-- env.d.ts
|   |   |-- http.ts
|   |   |-- index.ts
|   |   |-- storage.ts
|   |   `-- types.ts
|   |-- App.tsx
|   |-- index.css
|   |-- main.tsx
|   `-- vite-env.d.ts
|-- .diff.txt
|-- .gitignore
|-- .npmrc
|-- .store_new.ts
|-- .store_old.ts
|-- AGENTS.md
|-- app.css
|-- DESIGN.md
|-- drizzle.config.ts
|-- electron.vite.config.ts
|-- index.html
|-- llms.txt
|-- new.md
|-- package.json
|-- README.md
|-- skills-lock.json
|-- tsconfig.app.json
|-- tsconfig.json
|-- tsconfig.node.json
|-- tsconfig.worker.json
|-- vite.config.ts
|-- wrangler.jsonc
|-- Wrong sauna 01.jpg
|-- Wrong sauna 02.jpg
`-- สรุปแนวคิด LLM Wiki สไตล์ Andrej Karpathy.md
```

Generated by `scripts/update_repo_context.py`.
