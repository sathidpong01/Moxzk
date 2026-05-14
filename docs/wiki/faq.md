# FAQ

## ใช้ Windows เท่านั้นไหม?

ใช่ ตอนนี้ Moxzk วาง Windows Electron desktop เป็น target หลัก Linux และ macOS ไม่ใช่ planned target ของเฟสนี้

## ต้องสมัครบัญชีไหม?

ไม่จำเป็นสำหรับงาน local ผู้ใช้สามารถเพิ่มรูป คลีน/แปล แก้ region และ export ได้โดยไม่ต้อง login

ต้อง login เมื่ออยากใช้ album cloud, เปิดงานที่บันทึกกับบัญชี, หรือ sync งานผ่าน library

## ต้องติดตั้ง Ollama หรือ PanelCleaner ไหม?

ต้องมี dependency เหล่านี้สำหรับ workflow หลัก:

- PanelCleaner ใช้ลบข้อความเดิมออกจากภาพ
- Ollama และ model ที่รองรับภาพใช้ช่วย OCR/translation

Moxzk มี Settings และ first-run setup ช่วยตรวจ ติดตั้ง หรือแนะนำขั้นตอน

## รูปภาพออกจากเครื่องไหม?

งาน clean และ translation รันจากเครื่องผู้ใช้เป็นหลักเมื่อใช้ local PanelCleaner/Ollama

ถ้าผู้ใช้เลือกบันทึกเข้า album cloud รูปภาพและข้อมูลงานที่เกี่ยวข้องจะถูกอัปโหลดไปยังบริการของโปรเจคเพื่อให้เปิดกลับจากบัญชีได้

## Cloud album คืออะไร?

Cloud album คือพื้นที่บันทึกงานที่ผูกกับบัญชี ใช้เปิดงานกลับจาก library และจัดการหลายหน้าได้สะดวกกว่าไฟล์ local อย่างเดียว

ถ้าไม่ต้องการ cloud ให้ใช้ไฟล์ `.moxzk` และ export local แทน

## ทำไม Windows เตือนตอนติดตั้ง?

Moxzk ยังเป็น unsigned indie build Windows SmartScreen อาจเตือนเพราะไฟล์ยังไม่มี code signing reputation

ให้ดาวน์โหลดจาก GitHub Releases ของโปรเจคเท่านั้น และตรวจ SHA256 checksum ถ้า release มีให้

## อัปเดตแอปยังไง?

แอปเช็ค update จาก GitHub Releases หลังเปิดโปรแกรม เมื่อดาวน์โหลดเสร็จจะถามก่อน restart เพื่อติดตั้ง

ถ้า auto-update ไม่ทำงาน ให้ดาวน์โหลด installer ล่าสุดจาก GitHub Releases แล้วติดตั้งทับ

## เปิดไฟล์งานเดิมหรือย้ายเครื่องได้ไหม?

ได้ผ่านไฟล์ `.moxzk` และ album workflow

สำหรับย้ายเครื่องแบบไม่พึ่งบัญชี ให้ save เป็น `.moxzk`, ย้ายไฟล์, ติดตั้ง dependency บนเครื่องใหม่ แล้วเปิดไฟล์อีกครั้ง

## ถ้าแปลหรือคลีนไม่ทำงานต้องเช็คอะไร?

เช็ค Settings ก่อน:

- Cleanup: PanelCleaner พร้อมหรือไม่
- AI / Models: Ollama เปิดอยู่ไหม และ model ถูกต้องไหม
- ลองงาน 1 หน้า ก่อน batch
- ถ้า error ยังอยู่ ให้แนบ log/error ตอน report issue

## ใช้ฟรีไหม?

Moxzk เปิดให้ดาวน์โหลดผ่าน GitHub Releases ของโปรเจค ตอนใช้บริการภายนอกหรือ cloud path อาจมีต้นทุนหรือข้อจำกัดตามบริการนั้น ๆ
