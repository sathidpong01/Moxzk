# Moxzk Wiki

Moxzk คือแอป Windows สำหรับคลีนภาพมังงะ แปลไทย และจัดข้อความกลับบนภาพใน workspace เดียว AI ช่วยคลีน, OCR, และแปล แต่ผู้ใช้ยังตรวจงาน แก้ region, ปรับ font/layout และ export เองได้

หน้านี้เป็นหน้าเริ่มต้นของ wiki และเป็น source of truth สำหรับเนื้อหาหน้า download/landing ใน Magga

## Download

- ดาวน์โหลดจาก GitHub Releases เท่านั้น: https://github.com/sathidpong01/Moxzk/releases/latest
- รองรับ Windows เป็นเป้าหมายหลักของแอป
- ตอนนี้เป็น unsigned indie build Windows อาจแสดง SmartScreen warning ตอนเปิด installer
- ถ้ามี `SHA256SUMS.txt` ใน release ให้ใช้ตรวจ checksum ก่อนติดตั้ง
- อัปเดตแอปผ่านตัวแจ้งเตือนใน Moxzk หรือดาวน์โหลด installer ใหม่จาก GitHub Releases

## Quick Start

1. ดาวน์โหลด installer จาก GitHub Releases
2. เปิด Moxzk และทำ first-run setup ตามหน้าจอ
3. ติดตั้งหรือตรวจ Python, PanelCleaner, Ollama และโมเดลแปลภาพ
4. เพิ่มรูปหรือเปิดไฟล์งาน `.moxzk`
5. กด clean/translate แล้วตรวจ region บน editor
6. บันทึกงานหรือ export ออกเป็นรูป/ZIP/folder

อ่านละเอียดที่ [Install Windows](install-windows.md) และ [First Run Setup](first-run-setup.md)

## What Moxzk Does

- คลีนข้อความเดิมออกจากภาพมังงะด้วย PanelCleaner ที่รันในเครื่อง
- ใช้ Ollama vision/chat model เพื่อช่วยอ่านข้อความและแปลไทย
- เปิดหลายหน้าใน canvas/workspace เดียว
- ให้ผู้ใช้แก้ text region, font, สี, stroke, rotation และ layout mode เองได้
- ทำ batch clean/translate หลายหน้าโดยรักษา story context ข้ามหน้า
- บันทึกงานเป็น local project file หรือบันทึกเข้า album เมื่อ login
- export เป็นภาพหลายหน้า, ZIP, หรือ folder ผ่าน Windows desktop shell

## How To

- [Core Workflows](core-workflows.md): อัปโหลด, คลีน, แปล, ตรวจ, บันทึก, export
- [Albums And Sync](albums-and-sync.md): บัญชี, cloud album, local project file, การย้ายเครื่อง
- [Troubleshooting](troubleshooting.md): PanelCleaner, Ollama, auth, export, update, draft
- [FAQ](faq.md): คำถามที่ควรอยู่บน landing page

## For Developers And Agents

- [Developer Guide](developer-guide.md): setup, commands, runtime boundary, tests, release links
- [Landing Page Content](landing-page-content.md): copy canonical สำหรับ `D:\magga\app\Moxzk`
- [Konva Docs](../llm/konva.md): entrypoint สำหรับ canvas/editor work
- [Release Workflow](../electron/release-and-updates.md): build, checksum, publish, SmartScreen note
- [Desktop Smoke Test](../electron/desktop-smoke-test.md): Windows acceptance checklist

## Maintenance Rules

- เก็บ user-facing copy เป็นภาษาไทยที่คนทั่วไปอ่านรู้เรื่อง
- หลีกเลี่ยงคำ implementation เช่น D1, R2, metadata, object key, token hash ในหน้า public
- อย่า claim สิ่งที่ยังพิสูจน์ไม่ได้ เช่น จำนวนผู้ใช้, accuracy, privacy absolute
- ถ้าแก้ landing copy ใน Magga ให้ sync กลับมาที่ [Landing Page Content](landing-page-content.md)
- ถ้าเพิ่มหรือย้ายไฟล์ wiki ให้รัน `npm run context:refresh`
