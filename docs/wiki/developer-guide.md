# Developer Guide

หน้านี้สรุปเส้นทางสำหรับ dev และ agent เอกสารสำหรับผู้ใช้ทั่วไปอยู่ที่ [README](README.md), [FAQ](faq.md), และ [Landing Page Content](landing-page-content.md)

## Project Shape

- React 19 + Vite 8 + TypeScript renderer
- Windows Electron desktop shell เป็น target หลัก
- Konva/react-konva เป็น editor canvas
- PanelCleaner bridge เป็น local cleanup path
- Ollama เป็น OCR/translation/vision path
- Cloudflare Worker + D1/R2 เป็น album/auth persistence path
- Drizzle migrations เป็น source of truth ของ D1 schema

## Commands

```bash
npm install
npm run dev
npm run electron:dev
npm run build
npm test
npm run test:settings
npm run test:runtime
npm run test:editor
npm run test:export
npm run test:album
npm run test:cleanup
npm run test:cache
npm run worker:check
npm run context:refresh
```

## Runtime Boundary

Renderer code should call `AppRuntime` capability surfaces instead of importing Electron APIs directly

Important runtime areas:

- `ollama`: status and model listing
- `panelCleaner`: status and service helpers
- `files`: save/export surfaces
- `projectDraft`: draft persistence
- `projectFile`: portable `.moxzk` file save/open
- `windowControls`: frameless Windows controls
- `updates`: GitHub Releases update state

## Testing Policy

- Use focused tests while editing
- Run `npm run build` when TypeScript, runtime contracts, React shared interfaces, or app shell behavior changes
- Run `npm test` before commit/push or broad refactors
- Run `npm run worker:check` only when Worker/Cloudflare files are touched
- For Electron UX changes, verify Windows desktop behavior, not only browser fallback

## Docs To Read By Task

- Canvas/editor: `docs/llm/konva.md`
- Electron IPC: `docs/electron/ipc-contract.md`
- Desktop smoke: `docs/electron/desktop-smoke-test.md`
- Release/update: `docs/electron/release-and-updates.md`
- Auth/profile security: `docs/auth-profile-security.md`
- Cloud schema: `docs/cloudflare-d1-schema.md`

## Landing Sync

`docs/wiki/landing-page-content.md` is the canonical copy source for the Magga Moxzk landing page

When editing `D:\magga\app\Moxzk`, keep these rules:

- Thai-first public copy
- No fake metrics or unsupported claims
- No public implementation jargon
- Mention Windows-only, SmartScreen, GitHub Releases, checksum, and local vs cloud boundary
- Keep Moxzk product/design direction separate from Magga reader design language
