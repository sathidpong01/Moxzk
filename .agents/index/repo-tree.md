# Repository Tree

Root: `Moxzk`

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
|   |   `-- service-overview.md
|   |-- workflows/
|   |   |-- dev.md
|   |   `-- skills.md
|   |-- active.md
|   |-- AGENTS.md
|   `-- team.md
|-- .claude/
|-- .codex/
|   |-- config.toml
|   `-- hooks.json
|-- .cursor/
|   `-- rules/
|       `-- moxzk-skills.mdc
|-- .windsurf/
|   `-- workflows/
|       |-- dev.md
|       |-- review.md
|       `-- skills.md
|-- docs/
|   |-- electron/
|   |   |-- desktop-smoke-test.md
|   |   `-- ipc-contract.md
|   |-- llm/
|   |   `-- konva.md
|   |-- cloudflare-d1-schema.md
|   `-- codex-cloud-environment.md
|-- drizzle/
|   |-- meta/
|   |   |-- 0000_snapshot.json
|   |   |-- 0001_snapshot.json
|   |   |-- 0002_snapshot.json
|   |   |-- 0003_snapshot.json
|   |   `-- _journal.json
|   |-- 0000_parallel_stranger.sql
|   |-- 0001_artboard_layout.sql
|   |-- 0002_bizarre_zodiak.sql
|   `-- 0003_gray_lucky_pierre.sql
|-- electron/
|   |-- main/
|   |   |-- appPaths.ts
|   |   |-- desktopAuth.ts
|   |   |-- index.ts
|   |   |-- ipc.ts
|   |   |-- localServices.ts
|   |   |-- panelCleanerDependency.ts
|   |   |-- secureStore.ts
|   |   `-- secureStoreCore.ts
|   |-- preload/
|   |   `-- index.ts
|   `-- shared/
|       `-- ipcChannels.ts
|-- out/
|   |-- main/
|   |   `-- index.js
|   |-- preload/
|   |   `-- index.cjs
|   `-- renderer/
|       |-- assets/
|       |   |-- index-BQl9r3Nx.css
|       |   `-- index-InHCoBtk.js
|       |-- index.html
|       `-- vite.svg
|-- public/
|   `-- vite.svg
|-- scripts/
|   |-- album-modal.test.mjs
|   |-- album-open.test.mjs
|   |-- album-save-plan.test.mjs
|   |-- auth-smoke-user.mjs
|   |-- auth-smoke-user.test.mjs
|   |-- batch-processing.test.mjs
|   |-- browser-smoke.mjs
|   |-- browser-smoke.test.mjs
|   |-- cache-services.test.mjs
|   |-- codex-cloud-setup.sh
|   |-- d1-schema.test.mjs
|   |-- desktop-oauth.test.mjs
|   |-- desktop-secure-store.test.mjs
|   |-- editor-history-service.test.mjs
|   |-- editor-model.test.mjs
|   |-- editor-processing-ui.test.mjs
|   |-- electron-dev.mjs
|   |-- export-drawer.test.mjs
|   |-- export-preview-cache.test.mjs
|   |-- export-preview-viewport.test.mjs
|   |-- export-preview.test.mjs
|   |-- exporter.test.mjs
|   |-- inline-text-editor.test.mjs
|   |-- local-service-autostart.test.mjs
|   |-- local-services-manager.test.mjs
|   |-- ollama-prompt.test.mjs
|   |-- oop-boundaries.test.mjs
|   |-- panelcleaner-bridge.mjs
|   |-- panelcleaner-csv.mjs
|   |-- panelcleaner-csv.test.mjs
|   |-- pre-electron-readiness.test.mjs
|   |-- rename-compat.test.mjs
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
|   |   |   |-- AppChromeBar.tsx
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
|   |   |-- appIdentity.ts
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
|   |   |-- albumEditorSave.ts
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
|   |   |-- localServiceAutoStart.ts
|   |   |-- localServiceUsage.ts
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
|-- .graphifyignore
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
|-- Wrong sauna 01.png
|-- Wrong sauna 02.jpg
`-- สรุปแนวคิด LLM Wiki สไตล์ Andrej Karpathy.md
```

Generated by `scripts/update_repo_context.py`.
