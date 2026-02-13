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
cd d:\MG_Translater && docker compose up -d
```

2. Install frontend dependencies (ถ้ายังไม่ได้ install)
   // turbo

```bash
cd d:\MG_Translater && npm install
```

3. Start frontend dev server

```bash
cd d:\MG_Translater && npm run dev
```

4. Open browser at http://localhost:5173

## Notes

- Backend API อยู่ที่ `http://localhost:5003`
- Vite proxy จะ forward `/api` → backend อัตโนมัติ
- ครั้งแรกที่รัน Docker จะดาวน์โหลด models (~15GB)
