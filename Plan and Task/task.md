# MG_Translater – Manga Translation Web App

## Planning

- [x] Research GitHub projects (PanelCleaner, manga-image-translator)
- [x] Review existing project state & skills
- [x] Write implementation plan
- [/] Get user approval on plan

## Project Setup

- [ ] Create `docker-compose.yml` (manga-image-translator backend)
- [ ] Initialize Vite + React 19.2 + TypeScript + Tailwind CSS 4 + daisyUI 5
- [ ] Set up dark theme (daisyUI theme config)
- [ ] Create project skill

## Backend Communication

- [ ] `translator-api.ts` — manga-image-translator API (stream parsing)
- [ ] `gemini.ts` — ส่งรูปต้นฉบับ + OCR text → แปล + mood + font suggestion

## Frontend Components

- [ ] Image uploader (drag & drop, multi-image, preview)
- [ ] Processing view (stream progress, parallel calls)
- [ ] Canvas editor (Fabric.js, draggable text boxes, zoom/pan)
- [ ] Properties panel (text, font, size, color)
- [ ] Font selector (built-in + AI suggestion badge)
- [ ] Before/After split view (slider, side-by-side, overlay)
- [ ] Font config page (mood→font mapping, custom font upload)
- [ ] Settings panel (API key, language, server URL)

## Export

- [ ] Export PNG / JPG / WebP (original resolution)

## Verification

- [ ] Docker backend + frontend dev server running
- [ ] End-to-end: upload → detect → translate → edit → export
- [ ] Browser-based UI testing
