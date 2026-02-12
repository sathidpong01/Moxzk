<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19.2">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/daisyUI-5-5A0EF8?style=for-the-badge&logo=daisyui&logoColor=white" alt="daisyUI 5">
  <img src="https://img.shields.io/badge/Gemini-2.5-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini 2.5">
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

### 🤖 Multimodal Translation (Gemini 2.5)

- ส่ง **รูปต้นฉบับเต็ม** ให้ AI เห็นภาพจริง
- AI อ่านอารมณ์ตัวละคร (สีหน้า, ท่าทาง, speech bubble style)
- แปลเป็นภาษาไทยพร้อม **mood detection** (ตะโกน, กระซิบ, ตลก, บรรยาย)
- แนะนำ **font ที่เหมาะกับอารมณ์** อัตโนมัติ

### 🎨 Canvas Editor (Fabric.js)

- ลาก, ย้าย, resize, rotate text boxes บน canvas
- Zoom & Pan เพื่อดูรายละเอียด
- ปรับ font, ขนาด, สี, ตำแหน่งได้อิสระ
- เห็น original text + translated text คู่กัน

### 🔤 Font Mood System

- 6 ฟอนต์ไทยในตัว: Sarabun, Kanit, K2D, Prompt, Bai Jamjuree, Mitr
- AI แนะนำฟอนต์ตามอารมณ์: `normal`, `shouting`, `whisper`, `comedy`, `narration`, `sfx`
- **Font Config Page** — ปรับ mood→font mapping ได้ตามใจ
- อัพโหลด **custom font** (.ttf/.otf/.woff2) จากเครื่อง

### ↔️ Before/After Comparison

- Slider แบ่งซ้าย/ขวา เปรียบเทียบต้นฉบับกับฉบับแปล
- Side-by-side view
- Overlay toggle

### 📤 Export

- บันทึกผลลัพธ์เป็น **PNG / JPG / WebP**
- รักษาความละเอียดต้นฉบับ

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│         Frontend (React 19.2 + Vite + TypeScript)    │
│                     port 5173                        │
│                                                      │
│   Upload → Processing → Canvas Editor → Export       │
│              │                                       │
└──────────────┼───────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌────────────────┐  ┌─────────────────────┐
│  manga-image-  │  │  Gemini 2.5 API     │
│  translator    │  │  (Multimodal)       │
│  Docker :5003  │  │                     │
│                │  │  รูปต้นฉบับ            │
│  Detection     │  │  + OCR text         │
│  OCR           │  │  + Bounding boxes   │
│  Inpainting    │  │  ───────────────►   │
│                │  │  คำแปลไทย           │
│  translator:   │  │  + mood             │
│  "none"        │  │  + font suggestion  │
└────────────────┘  └─────────────────────┘
```

### Split Pipeline

โปรเจคนี้ใช้แนวทาง **Split Pipeline** — แยก detection/cleaning กับ translation:

1. **manga-image-translator** (`translator: "none"`)
   - รับรูปมังงะ → ส่งกลับ bounding boxes, OCR text, cleaned image
   - ใช้ Docker ไม่ต้องติดตั้ง Python/models เอง

2. **Gemini 2.5** (Multimodal)
   - รับ **รูปต้นฉบับ** + OCR text + bounding boxes
   - AI เห็นภาพจริง → อ่านอารมณ์, บริบท, ลักษณะ bubble
   - ส่งกลับ: คำแปลไทย + mood + font suggestion

3. **Frontend**
   - รวม cleaned image + translated text ลง canvas
   - ผู้ใช้แก้ไข/ปรับแต่งได้ทั้งหมดก่อน export

---

## 🛠️ Tech Stack

| Layer              | Technology                   | Version          |
| ------------------ | ---------------------------- | ---------------- |
| **Frontend**       | React + Vite + TypeScript    | 19.2 / 6.x / 5.x |
| **Canvas Editor**  | Fabric.js                    | Latest           |
| **Backend Engine** | manga-image-translator       | Docker image     |
| **Translation AI** | Gemini 2.5 (`@google/genai`) | Latest           |
| **Styling**        | Tailwind CSS 4 + daisyUI 5   | 4.x / 5.5.x      |
| **Container**      | Docker Compose               | —                |

---

## 📁 Project Structure

```
d:\MG_Translater\
├── docker-compose.yml              # manga-image-translator service
├── package.json                     # React 19.2 + Vite + deps
├── vite.config.ts                   # API proxy → :5003
├── .env.local                       # GEMINI_API_KEY
├── app.css                          # Tailwind CSS 4 + daisyUI 5 imports
├── README.md
│
├── src/
│   ├── App.tsx                      # 4-step workflow (Upload→Process→Edit→Export)
│   ├── index.css                    # Dark theme, design system
│   ├── types/
│   │   └── index.ts                 # TextRegion, TranslatorConfig, FontMoodMap
│   ├── config/
│   │   └── fonts.ts                 # Mood→Font mapping, registerCustomFont()
│   ├── services/
│   │   ├── translator-api.ts        # manga-image-translator API client
│   │   ├── gemini.ts                # Gemini multimodal translation
│   │   └── exporter.ts              # PNG/JPG/WebP export
│   └── components/
│       ├── Upload/
│       │   └── ImageUploader.tsx     # Drag & drop, paste, multi-image
│       ├── Processing/
│       │   └── ProcessingView.tsx    # Real-time stream progress
│       ├── Editor/
│       │   ├── CanvasEditor.tsx      # Fabric.js canvas
│       │   ├── PropertiesPanel.tsx   # Text/font/size/color controls
│       │   └── FontSelector.tsx      # Font picker + AI badge
│       ├── Comparison/
│       │   └── SplitView.tsx         # Before/After comparison
│       └── Settings/
│           ├── SettingsPanel.tsx     # API key, server URL
│           └── FontConfigPage.tsx   # Mood→Font config + custom upload
│
└── .agent/
    ├── skills/                      # AI development skills
    │   ├── manga-translator/        # 🎯 Project architecture & rules
    │   ├── ai-engineer/             # 🤖 LLM/multimodal patterns
    │   ├── prompt-engineering/      # 📝 Prompt design
    │   ├── typescript-expert/       # 🔷 TypeScript best practices
    │   ├── ui-ux-pro-max/           # 🎨 Design system intelligence
    │   ├── systematic-debugging/    # 🔍 4-phase debugging
    │   ├── web-design-guidelines/   # 🌐 Web standards
    │   ├── webapp-testing/          # 🧪 Playwright testing
    │   └── computer-vision-expert/  # 👁️ CV reference
    └── workflows/
        ├── dev.md                   # /dev — start dev environment
        └── skills.md                # /skills — use skills guide
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

---

## 📖 Usage

### Workflow (4 ขั้นตอน)

```
1. Upload    →  ลากรูปมังงะมาวาง หรือเลือกไฟล์
2. Process   →  AI ตรวจจับข้อความ, OCR, ลบข้อความ, แปล
3. Edit      →  แก้ไขคำแปล, ย้าย/resize ข้อความ, เปลี่ยนฟอนต์
4. Export    →  บันทึกเป็น PNG / JPG / WebP
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

โปรเจคนี้มี AI skills 9 ตัวใน `.agent/skills/` สำหรับช่วย development:

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
- [ ] Project setup (Docker, Vite, React 19.2)
- [ ] Backend communication (translator-api, gemini)
- [ ] UI components (uploader, processing, editor)
- [ ] Canvas editor (Fabric.js)
- [ ] Font config page
- [ ] Before/After comparison
- [ ] Export (PNG/JPG/WebP)
- [ ] End-to-end testing

---

## 📝 License

MIT

---

<p align="center">
  Made with ❤️ for manga fans who want to read in Thai
</p>
