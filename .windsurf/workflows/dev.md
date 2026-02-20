---
description: วิธีเริ่มต้น development environment สำหรับ MG_Translater
---

# Development Workflow

## Prerequisites

- Docker Desktop ติดตั้งและทำงานอยู่
- Node.js 20+ ติดตั้งอยู่
- Gemini API Key ตั้งค่าใน `.env.local`

## Steps

1. Start manga-image-translator backend via Docker
   // turbo

```bash
docker compose up -d
```

2. Install frontend dependencies (ถ้ายังไม่ได้ install)
   // turbo

```bash
npm install
```

3. Start frontend dev server

```bash
npm run dev
```

4. Open browser at http://localhost:5173

## Notes

- Backend API อยู่ที่ `http://localhost:5003`
- Vite proxy จะ forward `/api` → backend อัตโนมัติ
- ครั้งแรกที่รัน Docker จะดาวน์โหลด models (~15GB)
- ถ้าใช้ Ollama ต้องรัน `ollama serve` แยกที่ port 11434
- ถ้าใช้ LibreTranslate ต้องรัน container แยกที่ port 5004
