<img src="assets/icon.png" alt="" height="44"> **Moxzk**

แอปพลิเคชัน Windows สำหรับทำความสะอาดบอลลูนมังงะและแปลเป็นภาษาไทย — ด้วย PanelCleaner, Ollama และ Cloudflare

[![Download](https://img.shields.io/badge/Download-Windows%20Installer-14b8a6?style=for-the-badge)](https://github.com/sathidpong01/Moxzk/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-grey?style=flat-square)](./LICENSE)
[![CI](https://github.com/sathidpong01/Moxzk/actions/workflows/ci.yml/badge.svg)](https://github.com/sathidpong01/Moxzk/actions/workflows/ci.yml)

---

## ทำอะไรได้บ้าง

- **ทำความสะอาดบอลลูน** ด้วย PanelCleaner — รัน local ไม่ส่งข้อมูลออกนอกเครื่อง
- **OCR + แปลภาษา** ด้วย Ollama vision model บนเครื่องคุณ
- **แก้ไข text region** บน canvas — font, สี, stroke, ขนาด, rotation
- **Batch pipeline** — clean → OCR → แปล หลายหน้าพร้อมกันในคลิกเดียว
- **Story context** รักษาคำเรียก ความสัมพันธ์ และศัพท์ให้ต่อเนื่องระหว่างหน้า
- **Cloud sync** บน Cloudflare D1/R2 (optional)
- **Export** เป็นไฟล์ทีละหน้าหรือ ZIP

## ต้องมีอะไรบ้าง

| สิ่งที่ต้องการ | หมายเหตุ |
|---|---|
| Windows 10/11 x64 | เป้าหมายเดียวของ app |
| [Ollama](https://ollama.com) | OCR + แปลภาษา — ติดตั้งแยก |
| Vision model | เช่น `ollama pull gemma4` |
| Python 3 | PanelCleaner ต้องการ — app ติดตั้ง venv ให้เอง |

## ดาวน์โหลด

ไปที่ **[Releases](https://github.com/sathidpong01/Moxzk/releases/latest)** แล้วดาวน์โหลด `Moxzk-*.exe`

> **หมายเหตุ SmartScreen:** Windows จะแจ้งเตือนเพราะ installer ไม่ได้ sign — เลือก "More info → Run anyway" ได้เลย ตรวจสอบ SHA256 checksum ในหน้า release ก่อนติดตั้ง

## เริ่มใช้งาน

1. เปิดแอป → ติดตั้ง PanelCleaner จาก **Settings > Cleanup**
2. ตั้ง Ollama URL + model จาก **Settings > AI / Models**
3. Upload ภาพมังงะ → กด **Clean All** → กด **Translate All**
4. แก้ text region ตามต้องการ → **Export**

---

## สำหรับนักพัฒนา

### ติดตั้ง

```bash
npm install
```

> repo นี้ใช้ `legacy-peer-deps=true` เพราะ `electron-vite@5` ยังประกาศ peer range ถึง Vite 7 แต่โปรเจคใช้ Vite 8

### รัน / Build

```bash
npm run electron:dev    # เปิด Electron dev shell
npm run dev             # เปิด Vite renderer อย่างเดียว (http://localhost:5173)
npm run electron:build  # build Electron
npm run release:build   # build Windows installer
npm run release:publish # publish ไป GitHub Releases (ต้องมี GH_TOKEN)
```

### Test

```bash
npm test
npx tsc --noEmit
npm run worker:check
```

### Environment

สร้าง `.env.local` สำหรับ dev:

```env
VITE_CLOUDFLARE_API_URL=https://moxzk-api.<your-subdomain>.workers.dev
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=gemma4
```

Electron dev ใช้ remote Worker หลัก `https://moxzk-api.sathidpong01.workers.dev` เป็นค่า default

### Cloudflare Worker

```bash
npm run db:migrate:remote   # apply D1 migration
npm run worker:deploy       # deploy Worker
```

Worker secrets ที่ต้องตั้ง:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

ดูรายละเอียดเพิ่มเติมที่ [docs/wiki](docs/wiki/README.md)

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron + electron-vite |
| Frontend | React 19, Vite 8, TypeScript |
| Styling | Tailwind CSS 4, Headless UI |
| Canvas | Konva, react-konva |
| State | Zustand |
| Cleanup | PanelCleaner (external GPLv3 CLI) |
| OCR/Translation | Ollama vision/chat API |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 + Drizzle |
| Storage | Cloudflare R2 |
| Auth | Custom Worker auth, Google OAuth, email/password |

## Roadmap

- [x] Electron shell (V1) — native IPC, frameless window, GitHub Releases updater
- [x] Multi-artboard editor workspace
- [x] PanelCleaner bridge + batch clean endpoint
- [x] Batch translation pipeline with story context
- [x] Export all/selected pages
- [x] OCR confidence review summary
- [ ] Album-level story bible + glossary UI
- [ ] Translation review pass for pronoun/relationship consistency

## License

MIT — ดู [LICENSE](./LICENSE) และ [NOTICE.md](./NOTICE.md)

PanelCleaner เป็น GPLv3 external CLI — ไม่ถูก bundle เข้าแอป
