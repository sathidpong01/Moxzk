---
name: manga-translator
description: Manga Translation Web App — ใช้ manga-image-translator (Docker) เป็น engine หลัก + Gemini 2.5 / Ollama / LibreTranslate สำหรับแปลภาษา + React 19.2 + Konva frontend
---

# Manga Translator Skill

**Project**: MG_Translater

## Architecture

เป็นแอปเว็บแปลมังงะ (JP/CN/EN → TH) ที่ใช้สถาปัตยกรรม **Service + Custom Frontend**:

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React 19.2 + Vite 7 + TypeScript 5.9)        │
│  port 5173                                               │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Upload   │→│Processing│→│ Editor │→│ Export       │  │
│  │          │ │          │ │(Konva) │ │ PNG/JPG/WebP │  │
│  └──────────┘ └──────────┘ └────────┘ └──────────────┘  │
│       ┌──── Auth (Supabase) ────┐                        │
│       │  Albums │ Multi-image   │                        │
│       └─────────────────────────┘                        │
└──────────┬───────────────────┬───────────────────────────┘
           │                   │
           ▼                   ▼
┌──────────────────┐  ┌──────────────────────┐
│ manga-image-     │  │ Translation Engines   │
│ translator       │  │                      │
│ Docker :5003     │  │ 1. Gemini 2.5 API    │
│ detect+OCR+inpnt │  │    (Multimodal)      │
│ translator: none │  │ 2. Ollama (local)    │
└──────────────────┘  │ 3. LibreTranslate    │
                      └──────────────────────┘
```

## Tech Stack

| Layer            | Technology                           |
| ---------------- | ------------------------------------ |
| Frontend         | React 19.2, Vite 7, TypeScript 5.9   |
| Canvas Editor    | Konva + react-konva                  |
| State Management | Zustand                              |
| Auth             | Supabase                             |
| Backend Engine   | manga-image-translator (Docker)      |
| Translation AI   | Gemini 2.5 / Ollama / LibreTranslate |
| Styling          | Tailwind CSS 4 + daisyUI 5           |
| Toast            | sonner                               |
| Export           | file-saver + jszip                   |

### daisyUI Components ที่ใช้

| Component                  | ใช้ใน                                         |
| -------------------------- | --------------------------------------------- |
| `card`                     | Upload area, image preview                    |
| `file-input`               | เลือกไฟล์, อัพโหลด font                       |
| `btn`                      | ปุ่มทั้งหมด                                   |
| `progress`, `loading`      | Processing view                               |
| `input`, `select`, `range` | Properties panel, Settings                    |
| `dropdown`, `badge`        | Font selector + AI suggestion                 |
| `table`                    | Font mood mapping                             |
| `modal`                    | Settings, Auth, OCR correction, confirmations |
| `tabs`                     | Before/After toggle                           |
| `drawer`                   | Albums sidebar                                |

## Split Pipeline

สำคัญ: ใช้แนวทาง **Split Pipeline** — แยก detection/cleaning กับ translation ออกจากกัน

1. **manga-image-translator** (`translator: "none"`)
   - Input: รูปมังงะ
   - Output: bounding boxes, OCR text, cleaned/inpainted image
   - API: `POST /translate/with-form/json/stream`

2. **Translation Engine** (เลือกได้ 3 ตัว)
   - **Gemini 2.5** (Multimodal) — ส่ง รูปต้นฉบับ + OCR text → แปล + mood + font
   - **Ollama** (Local LLM) — ใช้ model เช่น typhoon2:8b
   - **LibreTranslate** — self-hosted translation API

3. **Frontend** รวม cleaned image + translated text → Konva Canvas Editor

## Key API Endpoints (manga-image-translator)

```
POST /translate/with-form/json/stream   → JSON (bboxes, OCR, regions)
POST /translate/with-form/image/stream  → Cleaned image
POST /queue-size                        → Queue length
GET  /result/{folder}/final.png         → Saved result
```

### Config ที่ใช้

```json
{
  "translator": { "translator": "none" },
  "detector": { "detector": "ctd", "detection_size": 2048 },
  "inpainter": { "inpainter": "lama_large", "inpainting_size": 2048 },
  "ocr": { "ocr": "48px" }
}
```

### Stream Response Format

Binary stream: `1B status + 4B size + nB data`

- 0 = result data
- 1 = progress report
- 2 = error
- 3 = queue position
- 4 = waiting for translator instance

## Font Mood System

| Mood        | Default Font      | Usage             |
| ----------- | ----------------- | ----------------- |
| `normal`    | Sarabun           | สนทนาทั่วไป       |
| `shouting`  | Kanit Bold        | ตะโกน/โกรธ        |
| `whisper`   | Prompt Light      | กระซิบ/นุ่มนวล    |
| `comedy`    | K2D               | ตลก/สนุกสนาน      |
| `narration` | Sarabun Italic    | บรรยาย/เล่าเรื่อง |
| `sfx`       | Bai Jamjuree Bold | เสียงเอฟเฟกต์     |

- ผู้ใช้ปรับ mapping ได้ผ่าน Font Config Page
- อัพโหลด custom font (.ttf/.otf/.woff2) ได้
- Font เก็บใน IndexedDB ผ่าน `fontStorage.ts`

## File Structure

```
MG_Translater/
├── docker-compose.yml              # manga-image-translator service
├── package.json                     # React 19.2 + Vite 7 + deps
├── vite.config.ts                   # API proxy to :5003, envPrefix, manualChunks
├── src/
│   ├── App.tsx                      # Shell: Navbar + Step routing + Modals
│   ├── main.tsx                     # Entry point
│   ├── index.css                    # Tailwind CSS 4 + daisyUI 5
│   ├── vite-env.d.ts                # Env type declarations
│   ├── types/index.ts               # TextRegion, AppSettings, ImageEntry, etc.
│   ├── config/fonts.ts              # Mood → Font mapping, FONT_ID_MAP
│   ├── store/
│   │   ├── appStore.ts              # Zustand store (panels, regions, brush, multi-image)
│   │   ├── authStore.ts             # Supabase auth state
│   │   └── albumStore.ts            # Album management state
│   ├── hooks/
│   │   ├── useAutoSave.ts           # Auto-save to Supabase
│   │   ├── useEditorActions.ts      # Editor callbacks (export, AI, save)
│   │   ├── useFloatingPanel.ts      # Draggable floating panels
│   │   └── useKeyboardShortcuts.ts  # Keyboard shortcuts
│   ├── lib/
│   │   └── supabase.ts              # Supabase client
│   ├── utils/
│   │   ├── fileValidation.ts        # File type/size validation
│   │   └── parseApiError.ts         # API error parsing
│   ├── services/
│   │   ├── translator-api.ts        # manga-image-translator client
│   │   ├── gemini.ts                # Gemini multimodal translation
│   │   ├── localLLM.ts              # Ollama / LibreTranslate client
│   │   ├── exporter.ts              # PNG/JPG/WebP export via Konva
│   │   ├── fontStorage.ts           # IndexedDB font persistence
│   │   ├── imageCache.ts            # Image caching
│   │   ├── translationMemory.ts     # Translation memory/cache
│   │   ├── geminiQuota.ts           # Gemini API quota tracking
│   │   ├── settingsStorage.ts       # Settings persistence (localStorage)
│   │   └── storageService.ts        # Supabase storage service
│   └── components/
│       ├── Steps/                    # ★ Step views (refactored from App.tsx)
│       │   ├── UploadStep.tsx        # Upload step — drag & drop images
│       │   ├── EditStep.tsx          # Edit step — canvas, toolbar, panels
│       │   └── ExportStep.tsx        # Export step — format, quality, download
│       ├── Upload/
│       │   └── ImageUploader.tsx     # Drag & drop, paste, multi-image
│       ├── Processing/
│       │   ├── ProcessingView.tsx    # Real-time stream progress
│       │   └── ResourceMonitor.tsx   # CPU/memory monitoring
│       ├── Editor/
│       │   ├── CanvasEditor.tsx      # Konva canvas (zoom, pan, brush, text)
│       │   ├── PropertiesPanel.tsx   # Text/font/size/color controls
│       │   ├── FloatingProperties.tsx # ★ Draggable properties wrapper
│       │   ├── FontSelector.tsx      # Font picker + AI badge
│       │   ├── BrushToolbar.tsx      # Brush/eraser tools
│       │   ├── ImageStrip.tsx        # Multi-image strip
│       │   └── OcrCorrectionModal.tsx # OCR text correction before translate
│       ├── Comparison/
│       │   └── SplitView.tsx         # Before/After comparison slider
│       ├── Settings/
│       │   ├── SettingsPanel.tsx      # API keys, server URLs, engine select
│       │   └── FontConfigPage.tsx     # Mood→Font config + custom upload
│       ├── Auth/
│       │   ├── AuthModal.tsx          # Login/Register modal (Supabase)
│       │   └── UserMenu.tsx           # User avatar + menu
│       ├── Albums/
│       │   ├── AlbumCard.tsx          # Album card component
│       │   ├── AlbumListModal.tsx     # Album list/management modal
│       │   ├── AlbumPageGrid.tsx      # Album page grid view
│       │   └── ConfirmModal.tsx       # Confirm dialog
│       └── Layout/
│           ├── FloatingQuotaBar.tsx   # Floating Gemini quota display
│           ├── LogPanel.tsx           # ★ Log display panel
│           └── PanelToggleBar.tsx     # ★ Bottom panel toggle bar
```

## Development Commands

```bash
# Start backend (manga-image-translator)
docker compose up -d

# Start frontend
npm run dev

# Build production
npm run build

# Type check
npx tsc --noEmit
```

## Key Rules

1. **ไม่ fork** manga-image-translator — ใช้เป็น Docker service เท่านั้น
2. **ส่งรูปต้นฉบับ** ให้ Gemini เสมอ เพื่อ visual context
3. **translator: "none"** ใน config เพื่อให้ manga-image-translator ไม่แปลเอง
4. **Konva + react-konva** สำหรับ canvas editor — ลาก/resize/rotate text boxes, brush/eraser
5. **Zustand** สำหรับ state management — ใช้ `useAppStore` hook
6. **Supabase** สำหรับ auth และ storage — ไม่เก็บ credentials ใน client
7. **daisyUI 5** เป็น component library หลัก + Tailwind CSS 4 utilities
8. **Dark theme** (daisyUI `dark` / `abyss` theme) เป็นค่าเริ่มต้น
9. **Export** รองรับ PNG, JPG, WebP ผ่าน Konva stage rendering
10. **Font config** ให้ผู้ใช้ตั้งค่า mood→font mapping + upload custom font
11. **3 Translation Engines** — ผู้ใช้เลือกได้: Gemini (multimodal), Ollama (local), LibreTranslate
12. **sonner** สำหรับ toast notifications
