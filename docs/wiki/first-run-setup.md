# First Run Setup

Moxzk ใช้เครื่องมือในเครื่องผู้ใช้เพื่อคลีนภาพและแปลภาพ หลังติดตั้งครั้งแรก แอปจะพาเช็คสิ่งจำเป็นทีละอย่าง

## Required Pieces

- Python 3: ใช้สร้าง environment สำหรับ PanelCleaner
- PanelCleaner: ใช้ลบข้อความเดิมออกจากภาพ
- Ollama: ใช้รันโมเดล vision/chat สำหรับ OCR และแปล
- Vision-capable model: ใช้กับรูปมังงะ เช่น model ที่ตั้งไว้ใน Settings
- Translation settings: ภาษาและ prompt behavior สำหรับงานแปล

## Setup Flow

1. เปิด Moxzk
2. ทำตาม first-run setup modal
3. กดติดตั้งหรือตรวจ Python ถ้าแอปแจ้งว่ายังไม่พร้อม
4. เปิด Settings > Cleanup แล้วติดตั้งหรือซ่อม PanelCleaner
5. เปิด Settings > AI / Models แล้วติดตั้งหรือเริ่ม Ollama
6. เลือก model ที่ต้องการใช้กับงานแปลภาพ
7. ทดสอบด้วยรูปเดียวก่อนทำ batch หลายหน้า

## PanelCleaner

PanelCleaner เป็น dependency ภายนอก ไม่ถูก vendor เข้ามาใน repo หรือ bundle เป็น source code ของ Moxzk

ใน Electron app ผู้ใช้สามารถติดตั้งจาก Settings > Cleanup ได้ แอปจะสร้าง managed environment ใน user profile ของ Moxzk และติดตั้ง CLI ที่จำเป็นให้

ถ้าติดตั้งไม่ผ่าน ให้ดู error ใน Settings ก่อน แล้วค่อยใช้ [Troubleshooting](troubleshooting.md)

## Ollama

Ollama ต้องพร้อมก่อนงาน OCR/translation จะทำงานได้

- ถ้าใช้ local model ให้เปิด Ollama และดึง model ไว้ในเครื่อง
- ถ้าใช้ endpoint หรือบัญชีแบบ cloud ให้ใส่ค่าใน Settings
- API key หรือ secret ควรถูกเก็บผ่าน Settings ของแอป ไม่ใส่ลง `.env` หรือไฟล์ public

## First Test

หลัง setup เสร็จ ให้ทดสอบด้วย 1 หน้า:

1. เพิ่มรูป
2. กดคลีนและแปล
3. ตรวจว่ามี region ถูกสร้างหรือไม่
4. แก้ text region เล็กน้อย
5. export เป็นไฟล์ภาพหรือ ZIP

ถ้าขั้นนี้ผ่าน ค่อยเริ่ม workflow หลายหน้า
