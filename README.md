<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19.2">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 7">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.9">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/daisyUI-5-5A0EF8?style=for-the-badge&logo=daisyui&logoColor=white" alt="daisyUI 5">
  <img src="https://img.shields.io/badge/Konva-10-0D83CD?style=for-the-badge&logoColor=white" alt="Konva 10">
  <img src="https://img.shields.io/badge/Gemini-2.5-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini 2.5">
  <img src="https://img.shields.io/badge/Supabase-Auth-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Docker-Engine-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

# 📖 MG_Translater

**AI-Powered Manga Translation Web App** — แปลมังงะจาก ญี่ปุ่น/จีน/อังกฤษ เป็นไทย ด้วย AI ที่เข้าใจอารมณ์ตัวละคร

แอปเว็บสำหรับแปลมังงะอัตโนมัติ ใช้ **manga-image-translator** เป็น engine หลักสำหรับ detection, OCR, และ inpainting ร่วมกับ **Gemini 2.5** (Multimodal AI) ที่รับรูปต้นฉบับเพื่อวิเคราะห์อารมณ์ตัวละครและบริบทฉาก → ส่งกลับคำแปลที่แม่นยำพร้อมฟอนต์ที่เหมาะสม

---

## ✨ Features

### 🔍 AI Detection & OCR

- ตรวจจับ text regions อัตโนมัติด้วย CTD detector
- OCR อ่านข้อความจากมังงะ (JP/CN/EN) ด้วย 48px model
- Inpainting ลบข้อความต้นฉบับด้วย LaMa Large
- **OCR Correction** — ตรวจสอบ/แก้ไข OCR ก่อนส่งแปล

### 🤖 Multi-Engine Translation

- **Gemini 2.5** (Multimodal) — ส่ง **รูปต้นฉบับเต็ม** ให้ AI เห็นภาพจริง + mood detection + font suggestion
- **Ollama** (Local LLM) — ใช้ model เช่น typhoon2:8b แปลแบบ offline
- **LibreTranslate** — self-hosted translation API
- ผู้ใช้เลือก engine ได้จากหน้า Settings

### 🎨 Canvas Editor (Konva)

- ลาก, ย้าย, resize, rotate text boxes บน canvas
- Zoom & Pan เพื่อดูรายละเอียด
- **Brush & Eraser** — วาด/ลบบน canvas ด้วยมือ
- ปรับ font, ขนาด, สี, ตำแหน่งได้อิสระ
- เห็น original text + translated text คู่กัน
- **Floating panels** — ลากย้ายได้ (Properties, Brush, Quota, Logs, Resource)

### 🔤 Font Mood System

- 6 ฟอนต์ไทยในตัว: Sarabun, Kanit, K2D, Prompt, Bai Jamjuree, Mitr
- AI แนะนำฟอนต์ตามอารมณ์: `normal`, `shouting`, `whisper`, `comedy`, `narration`, `sfx`
- **Font Config Page** — ปรับ mood→font mapping ได้ตามใจ
- อัพโหลด **custom font** (.ttf/.otf/.woff2) จากเครื่อง (เก็บใน IndexedDB)

### 🔐 Authentication (Supabase)

- Login / Register ผ่าน Supabase Auth
- User menu + avatar
- Auto-save ผลงานไปยัง Supabase Storage

### 📚 Albums

- จัดกลุ่มรูปมังงะเป็น Albums
- จัดการ (สร้าง/ลบ/แก้ไข) Albums
- ดูผลงานที่แปลแล้วในรูปแบบ grid

### 🖼️ Multi-Image Support

- อัพโหลดหลายรูปพร้อมกัน
- Image strip แสดงรูปทั้งหมด, สลับไปมาได้
- แปลแต่ละรูปอิสระ

### ↔️ Before/After Comparison

- Slider แบ่งซ้าย/ขวา เปรียบเทียบต้นฉบับกับฉบับแปล
- Side-by-side view
- Overlay toggle

### 📤 Export

- บันทึกผลลัพธ์เป็น **PNG / JPG / WebP**
- รักษาความละเอียดต้นฉบับ
- Export ผ่าน Konva stage rendering

### ⌨️ Keyboard Shortcuts

- ทางลัดคีย์บอร์ดสำหรับเครื่องมือต่างๆ
- Undo/Redo brush strokes

### 📊 Resource Monitor & Quota

- Resource Monitor — ติดตามการใช้ CPU/memory
- Gemini Quota Bar — ติดตามจำนวน API calls ที่ใช้

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│         Frontend (React 19.2 + Vite 7 + TypeScript)      │
│                     port 5173                             │
│                                                           │
│   Upload → Processing → Canvas Editor (Konva) → Export    │
│              │                                            │
│   Auth (Supabase) ─── Albums ─── Multi-image              │
└──────────────┼────────────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌────────────────┐  ┌─────────────────────┐
│  manga-image-  │  │  Translation Engines │
│  translator    │  │                     │
│  Docker :5003  │  │  1. Gemini 2.5 API  │
│                │  │     (Multimodal)    │
│  Detection     │  │  2. Ollama (local)  │
│  OCR           │  │  3. LibreTranslate  │
│  Inpainting    │  │                     │
│  translator:   │  │  รูปต้นฉบับ + OCR    │
│  "none"        │  │  → แปลไทย + mood    │
└────────────────┘  └─────────────────────┘
```

### Split Pipeline

โปรเจคนี้ใช้แนวทาง **Split Pipeline** — แยก detection/cleaning กับ translation:

1. **manga-image-translator** (`translator: "none"`)
   - รับรูปมังงะ → ส่งกลับ bounding boxes, OCR text, cleaned image
   - ใช้ Docker ไม่ต้องติดตั้ง Python/models เอง

2. **Translation Engine** (เลือกได้)
   - **Gemini 2.5** — รับ **รูปต้นฉบับ** + OCR text → วิเคราะห์อารมณ์, บริบท → คำแปลไทย + mood + font
   - **Ollama** — ใช้ local LLM เช่น typhoon2:8b
   - **LibreTranslate** — self-hosted translation

3. **Frontend**
   - รวม cleaned image + translated text ลง Konva canvas
   - ผู้ใช้แก้ไข/ปรับแต่งได้ทั้งหมดก่อน export

---

## 🛠️ Tech Stack

| Layer              | Technology                   | Version          |
| ------------------ | ---------------------------- | ---------------- |
| **Frontend**       | React + Vite + TypeScript    | 19.2 / 7.x / 5.9 |
| **Canvas Editor**  | Konva + react-konva          | 10.x / 19.x      |
| **State**          | Zustand                      | 5.x              |
| **Auth & Storage** | Supabase                     | 2.x              |
| **Backend Engine** | manga-image-translator       | Docker image     |
| **Translation AI** | Gemini 2.5 (`@google/genai`) | 1.x              |
| **Styling**        | Tailwind CSS 4 + daisyUI 5   | 4.x / 5.x        |
| **Toast**          | sonner                       | 2.x              |
| **Export**         | file-saver + jszip           | —                |
| **Container**      | Docker Compose               | —                |

---

## 📁 Project Structure

```
MG_Translater/
├── docker-compose.yml              # manga-image-translator service
├── package.json                     # React 19.2 + Vite 7 + deps
├── vite.config.ts                   # API proxy → :5003 + manualChunks
├── README.md
│
├── src/
│   ├── App.tsx                      # Shell: Navbar + Step routing + Modals
│   ├── main.tsx                     # Entry point
│   ├── index.css                    # Dark theme, Tailwind + daisyUI
│   ├── types/
│   │   └── index.ts                 # TextRegion, AppSettings, ImageEntry, etc.
│   ├── config/
│   │   └── fonts.ts                 # Mood→Font mapping, FONT_ID_MAP
│   ├── store/
│   │   ├── appStore.ts              # Zustand store (全 app state)
│   │   ├── authStore.ts             # Supabase auth state
│   │   └── albumStore.ts            # Album management state
│   ├── hooks/
│   │   ├── useAutoSave.ts           # Auto-save to Supabase
│   │   ├── useEditorActions.ts      # Editor callbacks (export, AI, save)
│   │   ├── useFloatingPanel.ts      # Draggable floating panels
│   │   └── useKeyboardShortcuts.ts  # Keyboard shortcuts
│   ├── lib/
│   │   └── supabase.ts              # Supabase client init
│   ├── utils/
│   │   ├── fileValidation.ts        # File type/size validation
│   │   └── parseApiError.ts         # API error parsing
│   ├── services/
│   │   ├── translator-api.ts        # manga-image-translator API client
│   │   ├── gemini.ts                # Gemini multimodal translation
│   │   ├── localLLM.ts              # Ollama / LibreTranslate client
│   │   ├── exporter.ts              # PNG/JPG/WebP export via Konva
│   │   ├── fontStorage.ts           # IndexedDB font persistence
│   │   ├── imageCache.ts            # Image caching
│   │   ├── translationMemory.ts     # Translation memory/cache
│   │   ├── geminiQuota.ts           # Gemini API quota tracking
│   │   ├── settingsStorage.ts       # Settings persistence
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
│       │   └── ResourceMonitor.tsx   # CPU/memory monitor
│       ├── Editor/
│       │   ├── CanvasEditor.tsx      # Konva canvas editor
│       │   ├── PropertiesPanel.tsx   # Text/font/size/color controls
│       │   ├── FloatingProperties.tsx # ★ Draggable properties wrapper
│       │   ├── FontSelector.tsx      # Font picker + AI badge
│       │   ├── BrushToolbar.tsx      # Brush/eraser tools
│       │   ├── ImageStrip.tsx        # Multi-image navigator
│       │   └── OcrCorrectionModal.tsx # OCR correction before translate
│       ├── Comparison/
│       │   └── SplitView.tsx         # Before/After comparison
│       ├── Settings/
│       │   ├── SettingsPanel.tsx      # API keys, URLs, engine select
│       │   └── FontConfigPage.tsx     # Mood→Font config + custom upload
│       ├── Auth/
│       │   ├── AuthModal.tsx          # Login/Register (Supabase)
│       │   └── UserMenu.tsx           # User avatar + menu
│       ├── Albums/
│       │   ├── AlbumCard.tsx          # Album card
│       │   ├── AlbumListModal.tsx     # Album management
│       │   ├── AlbumPageGrid.tsx      # Album page grid
│       │   └── ConfirmModal.tsx       # Confirm dialog
│       └── Layout/
│           ├── FloatingQuotaBar.tsx   # Floating Gemini quota display
│           ├── LogPanel.tsx           # ★ Log display panel
│           └── PanelToggleBar.tsx     # ★ Bottom panel toggle bar
│
└── .agents/
    ├── skills/                       # AI development skills
    │   ├── manga-translator/         # 🎯 Project architecture & rules
    │   ├── ai-engineer/              # 🤖 LLM/multimodal patterns
    │   ├── prompt-engineering/       # 📝 Prompt design
    │   ├── typescript-expert/        # 🔷 TypeScript best practices
    │   ├── ui-ux-pro-max/            # 🎨 Design system intelligence
    │   ├── systematic-debugging/     # 🔍 4-phase debugging
    │   ├── web-design-guidelines/    # 🌐 Web standards
    │   ├── webapp-testing/           # 🧪 Playwright testing
    │   └── computer-vision-expert/   # 👁️ CV reference
    └── workflows/
        ├── dev.md                    # /dev — start dev environment
        └── skills.md                 # /skills — use skills guide
```

---

## 🚀 Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (สำหรับ manga-image-translator backend)
- [Node.js 20+](https://nodejs.org/) (สำหรับ frontend)
- [Gemini API Key](https://aistudio.google.com/apikey) (สำหรับ translation)
- GPU (NVIDIA) — แนะนำ แต่ไม่บังคับ (CPU ก็ทำงานได้ แค่ช้า)

### 1. Clone Repository

```bash
git clone https://github.com/sathidpong01/MG_Translater.git
cd MG_Translater
```

### 2. Configure Environment

สร้างไฟล์ `.env.local`:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_TRANSLATOR_API_URL=http://localhost:5003
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start Backend (Docker)

```bash
docker compose up -d
```

> ⚠️ ครั้งแรกจะดาวน์โหลด models (~15GB) อาจใช้เวลาสักพัก

### 4. Install & Run Frontend

```bash
npm install
npm run dev
```

เปิด http://localhost:5173

### 5. (Optional) Local Translation Engines

```bash
# Ollama — ใช้ local LLM
ollama serve
ollama pull typhoon2:8b

# LibreTranslate — self-hosted translation
docker run -d -p 5004:5000 libretranslate/libretranslate
```

---

## 📖 Usage

### Workflow (3 ขั้นตอน)

```
1. Upload    →  ลากรูปมังงะมาวาง หรือเลือกไฟล์ (รองรับหลายรูป)
2. Edit      →  AI ตรวจจับ, OCR, ลบข้อความ, แปล → แก้ไขบน Konva canvas
3. Export    →  บันทึกเป็น PNG / JPG / WebP
```

### Font Mood Mapping (ค่าเริ่มต้น)

| Mood        | ฟอนต์             | ใช้เมื่อ            |
| ----------- | ----------------- | ------------------- |
| `normal`    | Sarabun           | สนทนาทั่วไป         |
| `shouting`  | Kanit Bold        | ตะโกน / โกรธ        |
| `whisper`   | Prompt Light      | กระซิบ / นุ่มนวล    |
| `comedy`    | K2D               | ตลก / สนุกสนาน      |
| `narration` | Sarabun Italic    | บรรยาย / เล่าเรื่อง |
| `sfx`       | Bai Jamjuree Bold | เสียงเอฟเฟกต์       |

> 💡 ปรับ mapping ได้ผ่าน Font Config Page + อัพโหลด custom font จากเครื่อง

---

## 🔧 API Reference

### manga-image-translator Endpoints

| Method | Endpoint                            | Description                        |
| ------ | ----------------------------------- | ---------------------------------- |
| `POST` | `/translate/with-form/json/stream`  | Stream JSON (bboxes, OCR, regions) |
| `POST` | `/translate/with-form/image/stream` | Stream cleaned image               |
| `GET`  | `/queue-size`                       | Current queue length               |
| `GET`  | `/result/{folder}/final.png`        | Saved result image                 |

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

Binary stream: `1 byte status` + `4 bytes size` + `N bytes data`

| Status Code | Meaning                         |
| ----------- | ------------------------------- |
| `0`         | Result data                     |
| `1`         | Progress report                 |
| `2`         | Error                           |
| `3`         | Queue position                  |
| `4`         | Waiting for translator instance |

---

## 🧠 AI Skills (Development)

โปรเจคนี้มี AI skills 9 ตัวใน `.agents/skills/` สำหรับช่วย development:

| Skill                    | ใช้เมื่อ                                    |
| ------------------------ | ------------------------------------------- |
| `manga-translator`       | อ่านก่อนเริ่มทำงาน — architecture, pipeline |
| `ui-ux-pro-max`          | ออกแบบ UI, เลือกสี, font, style             |
| `prompt-engineering`     | ออกแบบ prompt สำหรับ Gemini                 |
| `typescript-expert`      | TypeScript best practices, types            |
| `ai-engineer`            | Gemini integration, streaming               |
| `systematic-debugging`   | Debug ปัญหาทุกชนิด (4 phases)               |
| `web-design-guidelines`  | ตรวจสอบ UI ตาม web standards                |
| `webapp-testing`         | ทดสอบด้วย Playwright                        |
| `computer-vision-expert` | CV reference (YOLO, SAM)                    |

### Workflows

| Command   | Description                                  |
| --------- | -------------------------------------------- |
| `/dev`    | เริ่ม development environment (Docker + npm) |
| `/skills` | เลือกและใช้ skill ที่เหมาะกับงาน             |

---

## 🗺️ Roadmap

- [x] วางแผน architecture & split pipeline
- [x] สร้าง project skill & workflows
- [x] Project setup (Docker, Vite, React 19.2)
- [x] Backend communication (translator-api, gemini)
- [x] UI components (uploader, processing, editor)
- [x] Canvas editor (Konva + react-konva)
- [x] Font config page
- [x] Before/After comparison
- [x] Export (PNG/JPG/WebP)
- [x] Multi-image support
- [x] Brush & Eraser tools
- [x] Supabase Auth + Albums
- [x] OCR Correction Modal
- [x] Multiple translation engines (Gemini/Ollama/LibreTranslate)
- [x] Resource Monitor & Gemini Quota tracking
- [x] Keyboard shortcuts
- [x] Translation Memory & Image Cache
- [x] Refactor App.tsx → Steps, Hooks, Components
- [ ] End-to-end testing
- [ ] Batch export (JSZip)
- [ ] Mobile responsive optimization

---

## 📝 License

MIT

---

<p align="center">
  Made with ❤️ for manga fans who want to read in Thai
</p>
