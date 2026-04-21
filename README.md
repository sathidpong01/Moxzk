# MG_Translater

React/Vite image editor สำหรับคลีนภาพมังงะและแปลเป็นภาษาไทย โดยใช้ PanelCleaner, Ollama vision model และ Cloudflare Worker/D1/R2 เป็นแกนหลัก

โปรเจคนี้อยู่ในช่วง web app ก่อน ยังไม่เพิ่ม Electron dependency. งานที่ต้องแตะ native โดยตรง เช่นหา executable, start service, secure local storage, native folder export และย้าย bridge เข้า main process จะเป็น Electron phase ภายหลัง

## Current Direction

- Frontend: React 19 + Vite 7 + TypeScript
- UI: Tailwind CSS 4 + Headless UI primitives + custom studio-dark design system
- Editor: Konva/react-konva พร้อม multi-artboard workspace
- Cleanup: PanelCleaner external CLI ผ่าน local bridge
- AI: Ollama `/api/chat` สำหรับ OCR/translation/vision JSON
- Storage/Auth: Cloudflare Worker API + D1 + R2
- Schema: Drizzle เป็น source of truth สำหรับ Cloudflare D1
- Legacy backend ถูกถอดออกแล้ว เส้นทางหลักคือ PanelCleaner bridge เท่านั้น

## Features

- Upload หลายรูปแล้วเปิดเป็น artboard workspace แนวนอน
- แสดงหลายหน้าใน canvas เดียว พร้อมเลขหน้า, active page, status และ filmstrip ที่เปิด/ปิดได้
- Reorder page แบบล็อกตำแหน่งรูปภาพ ไม่ลากภาพอิสระจนชนกับ text regions
- แก้ text region บน Konva canvas: font, color, stroke, stroke corner, size, rotation, layout mode
- PanelCleaner clean ผ่าน local bridge และรองรับ native batch clean endpoint
- Batch AI queue: clean หลายหน้าก่อน แล้วแปลทีละหน้าเพื่อลดการแย่ง VRAM/โมเดล
- Story context across pages: ส่งบทพูดหน้าก่อนหน้าและ style guide เข้า Ollama เพื่อรักษาคำเรียก ความสัมพันธ์ และศัพท์ให้ต่อเนื่อง
- Translation memory ผ่าน IndexedDB
- Albums บน Cloudflare D1/R2 พร้อม Google OAuth, email/password, session cookie และ ownership checks
- Export หลายหน้า โดยเลือกทุกหน้าเป็นค่าเริ่มต้น หรือเลือกเฉพาะบางหน้า
- Export ผ่าน File System Access API เมื่อ browser รองรับ และ fallback เป็น ZIP

## Architecture

```text
React + Vite + TypeScript
        |
        | upload / edit / export
        v
Konva Multi-Artboard Editor
        |
        +--> PanelCleaner bridge :5055
        |       - spawn external pcleaner CLI
        |       - single clean and batch clean
        |       - optional OCR fallback CSV
        |
        +--> Ollama API
        |       - /api/chat for vision OCR/translation
        |       - /api/version health check
        |       - /api/tags model list
        |       - story context + style guide prompt layer
        |
        +--> Cloudflare Worker :8787
                - auth/session
                - albums/pages metadata in D1
                - image ownership and streaming through R2
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 7, TypeScript |
| Styling | Tailwind CSS 4, Headless UI, custom studio-dark tokens |
| Canvas | Konva, react-konva |
| State | Zustand |
| Cleanup | PanelCleaner external CLI through local bridge |
| OCR/Translation | Ollama vision/chat API |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 + Drizzle |
| Object Storage | Cloudflare R2 |
| Auth | Custom Worker auth, Google OAuth, email/password |
| Export | File System Access API, file-saver, jszip |

## Project Structure

```text
drizzle/
  0000_parallel_stranger.sql
  0001_artboard_layout.sql
docs/
  cloudflare-d1-schema.md
scripts/
  panelcleaner-bridge.mjs
  *.test.mjs
src/
  components/
    Albums/
    Auth/
    Editor/
    Processing/
    Settings/
    Steps/
    ui/
  runtime/
    webRuntime.ts
  services/
    batch-processing.ts
    cleanup-provider.ts
    cloudflareApi.ts
    exporter.ts
    ollama.ts
    panelcleaner-api.ts
    story-context.ts
    translationMemory.ts
  store/
    albumStore.ts
    appStore.ts
    authStore.ts
  worker/
    index.ts
    auth.ts
    albums.ts
    storage.ts
    db/schema.ts
  types/
    index.ts
    database.ts
```

## Prerequisites

- Node.js 20+
- Python environment ที่ติดตั้ง PanelCleaner CLI ได้
- Ollama local app หรือ Ollama Cloud account
- Vision-capable Ollama model เช่น `gemma4`
- Cloudflare account ที่มี Worker, D1 และ R2
- Wrangler authentication สำหรับ deploy Worker และ apply D1 migrations

## Install

```bash
npm install
pip install pcleaner-cli
```

PanelCleaner อาจดาวน์โหลด model data ครั้งแรกหลายร้อย MB. โปรเจคนี้ใช้ PanelCleaner เป็น external CLI เพื่อหลีกเลี่ยงการ vendor GPLv3 code เข้ามาใน repo

## Local Environment

สร้าง `.env.local` สำหรับ frontend override ถ้าต้องการ:

```env
VITE_CLOUDFLARE_API_URL=https://mg-translater-api.<your-subdomain>.workers.dev
VITE_PANELCLEANER_BRIDGE_URL=http://localhost:5055
VITE_TRANSLATOR_API_URL=http://localhost:5003
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=gemma4
```

ใน dev mode ค่า `VITE_CLOUDFLARE_API_URL` ใช้เป็น target ของ Vite proxy สำหรับ `/api` เพื่อให้ browser ยังเรียก same-origin `/api/...` และ session cookie ทำงานเหมือน app เดียวกัน. ถ้าไม่ตั้งค่านี้ proxy จะ fallback ไปที่ local Worker `http://localhost:8787` สำหรับ debug เฉพาะกรณี

ไม่ควรใส่ Ollama Cloud API key ใน `VITE_*` env เพราะค่าจะถูก bundle เข้า browser app. ให้ใส่ใน Settings ระหว่าง web phase

ตั้ง Worker secrets บน Cloudflare:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

สร้าง `.dev.vars` เฉพาะเมื่อต้อง debug ด้วย Wrangler local dev:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Resend ไม่จำเป็นใน build ปัจจุบัน เพราะ email verification/reset ถูกปิดไว้ และ email/password register ถูก mark verified ทันที ดูรายละเอียดใน [Cloudflare D1 Schema](docs/cloudflare-d1-schema.md)

## Run Locally

ก่อนใช้งาน backend remote ครั้งแรก ให้ apply migration และ deploy Worker:

```bash
npm run db:migrate:remote
npm run worker:deploy
```

เปิด Ollama:

```bash
ollama serve
ollama pull gemma4
```

เปิด PanelCleaner bridge:

```bash
npm run backend:panelcleaner
```

เปิด Vite frontend:

```bash
npm run dev
```

เปิด `http://localhost:5173`

Vite proxy จะส่ง `/api` ไปที่ `VITE_CLOUDFLARE_API_URL`. ถ้าไม่ได้ตั้งค่าไว้ จะ fallback ไป `http://localhost:8787` เพื่อให้ยังเปิด local Worker debug ได้ด้วย `npx wrangler dev --local --port 8787`

## Cloudflare Resources

ค่าใน `wrangler.jsonc`:

- Worker: `mg-translater-api`
- D1: `mg-translater-db`
- R2: `mg-translater-images`
- D1 binding: `DB`
- R2 binding: `IMAGES`

Generate migration:

```bash
npm run db:generate
```

Apply local migration:

```bash
npm run db:migrate:local
```

Apply remote migration:

```bash
npm run db:migrate:remote
```

Worker dry run:

```bash
npm run worker:check
```

Deploy Worker:

```bash
npm run worker:deploy
```

Required Worker secrets:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

Google OAuth authorized redirect URIs:

```text
http://localhost:5173/api/auth/google/callback
http://localhost:5174/api/auth/google/callback
https://mg-translater-api.<your-subdomain>.workers.dev/api/auth/google/callback
```

Local web dev uses the localhost callback through Vite proxy so the session cookie belongs to the local app. The workers.dev callback remains useful for direct Worker/API smoke tests and future hosted frontend flows.

## Usage Flow

```text
1. Upload manga images
2. Open editor as multi-artboard workspace
3. Run AI:
   - PanelCleaner batch clean
   - derive text boxes from cleanup diff
   - Ollama boxed vision translation
   - fallback to vision OCR/translation when needed
4. Edit text regions, font, stroke, layout and page order
5. Save pages to Cloudflare album
6. Export all pages or selected pages
```

## AI Translation Notes

The translation pipeline is intentionally not page-isolated anymore.

- `story-context.ts` collects previous translated lines during batch translation.
- `translationStyleGuide` in Settings controls relationships, pronouns, tone and recurring terms.
- The default guide covers broad relationships: family, siblings, partners, friends, rivals, hierarchy, workplace roles, school roles, customer/staff and strangers.
- If a relationship is established by earlier pages or image context, prompts tell Ollama to keep it consistent.
- If the relationship is uncertain, prompts prefer neutral Thai phrasing instead of forcing a wrong relationship.

Recommended workflow for better continuity:

```text
1. Sort pages correctly
2. Add project-specific glossary/style guide in Settings > Ollama
3. Run AI for all pages in order
4. Review OCR correction / text regions
5. Re-run specific pages only when needed
```

## PanelCleaner Bridge Notes

- Bridge รับรูปเป็น base64 JSON แล้วเขียน temp files ต่อ job
- Single endpoint: `/panelcleaner/process`
- Batch endpoint: `/panelcleaner/batch`
- Status endpoint: `/panelcleaner/status`
- เรียก `pcleaner` ด้วย `spawn(..., { shell: false })`
- จำกัด origin เฉพาะ local dev origins โดย default
- รองรับ `PANELCLEANER_BRIDGE_PORT`, `PANELCLEANER_MAX_BODY_BYTES`, `PANELCLEANER_ALLOWED_ORIGIN`
- ลบ temp directory หลังจบงาน เว้นแต่ตั้ง `PANELCLEANER_KEEP_TEMP=1`

## Auth And Albums

Worker API routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/albums`
- `POST /api/albums`
- `GET /api/albums/:albumId/pages`
- `POST /api/albums/:albumId/pages`
- `POST /api/albums/:albumId/pages/reorder`
- `PATCH /api/pages/:pageId`
- `DELETE /api/pages/:pageId`
- `POST /api/storage/upload`
- `GET /api/storage/object/:key`
- `DELETE /api/storage/object/:key`

R2 object access is checked through D1 `objects` metadata before download/delete. Album and page deletes are hard deletes.

## Verification

```bash
npm test
npm run build
npm run worker:check
npm run db:migrate:remote
npm run worker:deploy
```

Expected current test coverage includes:

- album save target behavior
- D1 migration/schema checks
- PanelCleaner CSV parser
- story context continuity rules
- text layout sizing

Manual smoke tests:

```text
upload 6 images -> editor opens -> 5 artboards in first row -> page 6 second row
run AI all pages -> clean status updates -> translation runs page by page
save to existing album -> no duplicate pages
open album -> pages load with consistent layout
delete page from album/canvas -> page disappears from editor state
export all pages -> folder export or ZIP fallback
```

## Skills

Installed skills that are relevant to this project:

| Skill | Use |
| --- | --- |
| `baoyu-comic` | comic/storyboard thinking and character continuity ideas |
| `context-extraction` | translator context, glossary and ambiguity handling |
| `thai-interpreter` | Thai wording, intent and encoding safety |
| `ocr` | OCR/PaddleOCR guidance |
| `ollama` | Ollama API and structured vision responses |
| `d1-drizzle-schema` | Cloudflare D1 schema design with Drizzle |
| `d1-migration` | D1 migration workflow |
| `cloudflare:workers-best-practices` | Worker code and deployment checks |
| `frontend-ui-engineering` | React UI implementation |
| `frontend-design` | visual direction and layout polish |
| `accessibility` | dialog/focus/keyboard checks |
| `webapp-testing` / `playwright` | browser smoke tests |

## Roadmap

- [x] Replace daisyUI with Headless UI + project primitives
- [x] Cloudflare Worker auth/session API
- [x] D1 schema with Drizzle migrations
- [x] R2 upload/download ownership checks
- [x] PanelCleaner bridge and batch clean endpoint
- [x] Multi-artboard editor workspace
- [x] Export all/selected pages
- [x] Story context prompt layer for batch translation
- [ ] Album-level story bible and glossary UI
- [ ] Translation review pass for pronoun/relationship consistency
- [x] OCR confidence review summary in correction flow
- [x] Remove legacy backend after PanelCleaner flow is verified
- [ ] Electron shell with secure typed IPC
- [ ] Native executable discovery/version/start service

## License

MIT
