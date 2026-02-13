---
name: manga-translator
description: Manga Translation Web App — ใช้ manga-image-translator (Docker) เป็น engine หลัก + Gemini 2.5 สำหรับแปลภาษา + React 19.2 custom frontend
---

# Manga Translator Skill

**Project**: MG_Translater (`d:\MG_Translater`)

## Architecture

เป็นแอปเว็บแปลมังงะ (JP/CN/EN → TH) ที่ใช้สถาปัตยกรรม **Service + Custom Frontend**:

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React 19.2 + Vite + TypeScript)              │
│  port 5173                                              │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐ │
│  │ Upload   │→│Processing│→│ Editor │→│ Export       │ │
│  │          │ │          │ │(Fabric)│ │ PNG/JPG/WebP │ │
│  └──────────┘ └──────────┘ └────────┘ └──────────────┘ │
└──────────┬───────────────────┬──────────────────────────┘
           │                   │
           ▼                   ▼
┌──────────────────┐  ┌──────────────────────┐
│ manga-image-     │  │ Gemini 2.5 API       │
│ translator       │  │ (Multimodal)         │
│ Docker :5003     │  │                      │
│ detect+OCR+inpnt │  │ รูปต้นฉบับ + OCR text │
│ translator: none │  │ → แปล + mood + font  │
└──────────────────┘  └──────────────────────┘
```

## Tech Stack

| Layer          | Technology                      |
| -------------- | ------------------------------- |
| Frontend       | React 19.2, Vite, TypeScript    |
| Canvas Editor  | Fabric.js                       |
| Backend Engine | manga-image-translator (Docker) |
| Translation AI | Gemini 2.5 (`@google/genai`)    |
| Styling        | Tailwind CSS 4 + daisyUI 5      |

### daisyUI Components ที่ใช้

| Component                  | ใช้ใน                         |
| -------------------------- | ----------------------------- |
| `steps`                    | Workflow 4 ขั้นตอน            |
| `card`                     | Upload area, image preview    |
| `file-input`               | เลือกไฟล์, อัพโหลด font       |
| `btn`                      | ปุ่มทั้งหมด                   |
| `progress`, `loading`      | Processing view               |
| `input`, `select`, `range` | Properties panel              |
| `dropdown`, `badge`        | Font selector + AI suggestion |
| `table`                    | Font mood mapping             |
| `modal`                    | Settings, confirmations       |
| `tabs`                     | Before/After toggle           |
| `toast`, `alert`           | Notifications, errors         |

## Split Pipeline

สำคัญ: ใช้แนวทาง **Split Pipeline** — แยก detection/cleaning กับ translation ออกจากกัน

1. **manga-image-translator** (`translator: "none"`)
   - Input: รูปมังงะ
   - Output: bounding boxes, OCR text, cleaned/inpainted image
   - API: `POST /translate/with-form/json/stream`

2. **Gemini 2.5** (Multimodal)
   - Input: **รูปต้นฉบับ** + OCR text + bounding boxes
   - Output: คำแปลไทย, mood (normal/shouting/whisper/comedy/narration/sfx), suggestedFont
   - AI เห็นภาพจริง → อ่านอารมณ์ตัวละคร, bubble style, context ได้แม่นยำ

3. **Frontend** รวม cleaned image + translated text → Canvas Editor

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

## File Structure

```
d:\MG_Translater\
├── docker-compose.yml              # manga-image-translator service
├── package.json                     # React 19.2 + Vite + daisyUI
├── vite.config.ts                   # API proxy to :5003
├── .env.local                       # GEMINI_API_KEY
├── app.css                          # Tailwind CSS 4 + daisyUI 5
├── src/
│   ├── App.tsx                      # 4-step workflow (daisyUI steps)
│   ├── types/index.ts               # TextRegion, Config types
│   ├── config/fonts.ts              # Mood → Font mapping
│   ├── services/
│   │   ├── translator-api.ts        # manga-image-translator client
│   │   ├── gemini.ts                # Gemini multimodal translation
│   │   └── exporter.ts              # PNG/JPG/WebP export
│   └── components/
│       ├── Upload/ImageUploader.tsx
│       ├── Processing/ProcessingView.tsx
│       ├── Editor/
│       │   ├── CanvasEditor.tsx      # Fabric.js canvas
│       │   ├── PropertiesPanel.tsx
│       │   └── FontSelector.tsx
│       ├── Comparison/SplitView.tsx  # Before/After
│       └── Settings/
│           ├── SettingsPanel.tsx
│           └── FontConfigPage.tsx    # Mood→Font config
```

## Development Commands

```bash
# Start backend (manga-image-translator)
docker compose up -d

# Start frontend
npm run dev

# Build production
npm run build
```

## Key Rules

1. **ไม่ fork** manga-image-translator — ใช้เป็น Docker service เท่านั้น
2. **ส่งรูปต้นฉบับ** ให้ Gemini เสมอ เพื่อ visual context
3. **translator: "none"** ใน config เพื่อให้ manga-image-translator ไม่แปลเอง
4. **Fabric.js** สำหรับ canvas editor — ลาก/resize/rotate text boxes
5. **daisyUI 5** เป็น component library หลัก + Tailwind CSS 4 utilities
6. **Dark theme** (daisyUI `dark` / `abyss` theme) เป็นค่าเริ่มต้น
7. **Export** รองรับ PNG, JPG, WebP
8. **Font config** ให้ผู้ใช้ตั้งค่า mood→font mapping + upload custom font
