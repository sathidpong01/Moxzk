# Troubleshooting

ใช้หน้านี้เมื่อ workflow หลักไม่ทำงาน ก่อนแก้ code ให้แยกว่าเป็นปัญหา app, dependency, model, auth, หรือไฟล์งาน

## PanelCleaner Not Ready

เช็ค:

- Settings > Cleanup แสดงสถานะอะไร
- Python ติดตั้งและมองเห็นจาก Windows หรือไม่
- กดติดตั้งหรือซ่อม PanelCleaner แล้ว log แจ้งอะไร
- bridge/service ถูกเปิดจาก Electron ได้หรือไม่

ทางแก้ทั่วไป:

1. กดตรวจสถานะใหม่
2. กดซ่อม PanelCleaner
3. ปิดเปิด Moxzk ใหม่
4. ถ้ายังไม่ผ่าน ให้ดู log/error ใน Settings แล้วแนบตอน report issue

## Ollama Not Ready

เช็ค:

- Ollama เปิดอยู่หรือไม่
- endpoint ใน Settings ถูกต้องหรือไม่
- model ที่เลือกมีอยู่จริงหรือไม่
- network/proxy ของเครื่องบล็อก endpoint หรือไม่

ทางแก้ทั่วไป:

1. เปิด Settings > AI / Models
2. กดเริ่ม Ollama หรือดูวิธีติดตั้ง
3. ตรวจ model list
4. ลองงาน 1 หน้า ก่อน batch

## Translation Is Wrong Or Inconsistent

AI output ยังต้อง review โดยผู้ใช้

- ตรวจ source text ใน region
- แก้คำแปลบน canvas โดยตรง
- ใช้ story context กับงานหลายหน้า
- ถ้าข้อความยาวเกิน bubble ให้แก้ copy หรือ layout mode

## Export Fails

เช็ค:

- มี active project และหน้าให้ export หรือไม่
- destination folder เขียนไฟล์ได้หรือไม่
- ถ้า export จาก album รูปต้นทางถูกโหลดครบหรือไม่
- ลอง export ZIP ก่อน export folder

## Login Or Album Fails

เช็ค:

- internet ใช้งานได้หรือไม่
- session หมดอายุหรือไม่
- Google OAuth เปิดใน system browser แล้วกลับเข้าแอปหรือไม่
- album เป็นของบัญชีที่ login อยู่หรือไม่

ถ้า login ใช้งานไม่ได้ ให้ลอง sign out แล้ว sign in ใหม่

## Draft Restore Looks Wrong

Autosave draft มีไว้กู้คืนหลังปิดแอป ไม่ใช่ไฟล์งานหลัก

ถ้างานสำคัญ:

- save เป็น `.moxzk`
- หรือ save เข้า album
- ถ้า draft เก่าเกินไปหรือเสีย ให้ลบทิ้งจาก prompt กู้คืน แล้วเปิดไฟล์งานที่ save ไว้แทน

## Update Problems

- ถ้า auto-update ดาวน์โหลดไม่สำเร็จ ให้ใช้ GitHub Releases manual installer
- ถ้า Windows เตือน SmartScreen ให้ตรวจว่าไฟล์มาจาก release จริงและ checksum ตรง
- ถ้าเปิดแอปไม่ได้หลัง update ให้ติดตั้ง installer ล่าสุดทับ
