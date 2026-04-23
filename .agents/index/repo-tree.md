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
|   `-- AGENTS.md
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
|   |   `-- package.json
|   |-- current-task.md
|   |-- dashboard.md
|   |-- decisions.md
|   |-- handoff.md
|   |-- inbox.md
|   `-- README.md
|-- _wiki/
|   |-- concepts/
|   |   |-- .gitkeep
|   |   `-- codex-first-llm-wiki.md
|   |-- entities/
|   |   `-- .gitkeep
|   |-- outputs/
|   |   `-- .gitkeep
|   |-- raw/
|   |   `-- .gitkeep
|   |-- sources/
|   |   |-- .gitkeep
|   |   `-- 2026-04-23-karpathy-llm-wiki-note.md
|   |-- AGENTS.md
|   |-- index.md
|   |-- log.md
|   |-- podcast.md
|   `-- README.md
|-- docs/
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
|-- public/
|   `-- vite.svg
|-- scripts/
|   |-- album-open.test.mjs
|   |-- album-save-plan.test.mjs
|   |-- batch-processing.test.mjs
|   |-- d1-schema.test.mjs
|   |-- editor-model.test.mjs
|   |-- export-preview.test.mjs
|   |-- exporter.test.mjs
|   |-- inline-text-editor.test.mjs
|   |-- ollama-prompt.test.mjs
|   |-- panelcleaner-bridge.mjs
|   |-- panelcleaner-csv.mjs
|   |-- panelcleaner-csv.test.mjs
|   |-- pre-electron-readiness.test.mjs
|   |-- story-context.test.mjs
|   |-- text-hud-position.test.mjs
|   |-- text-layout.test.mjs
|   |-- update_repo_context.py
|   |-- viewer-zoom.test.mjs
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
|   |   |-- exporter.ts
|   |   |-- exportPreview.ts
|   |   |-- exportRendering.ts
|   |   |-- fontStorage.ts
|   |   |-- imageCache.ts
|   |   |-- inlineTextEditor.ts
|   |   |-- keyboardShortcuts.ts
|   |   |-- konvaInteraction.ts
|   |   |-- ollama.ts
|   |   |-- panelcleaner-api.ts
|   |   |-- projectDraftStorage.ts
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
|-- supabase/
|   |-- functions/
|   |   |-- _shared/
|   |   |   `-- cors.ts
|   |   |-- r2-upload/
|   |   |   `-- index.ts
|   |   `-- r2-url/
|   |       `-- index.ts
|   `-- migrations/
|       `-- 001_initial_schema.sql
|-- .diff.txt
|-- .gitignore
|-- .store_new.ts
|-- .store_old.ts
|-- AGENTS.md
|-- app.css
|-- DESIGN.md
|-- drizzle.config.ts
|-- index.html
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
