# Core Workflows

Moxzk ออกแบบเป็น editor-first workflow: เปิดรูปหลายหน้า ทำงานใน workspace เดียว ตรวจงานเอง แล้วค่อย save/export

## Start A Project

เริ่มงานได้ 3 ทาง:

- เพิ่มรูปจากเครื่อง
- เปิด album ที่เคยบันทึกไว้หลัง login
- เปิดไฟล์งาน `.moxzk`

เมื่อเข้า editor แล้ว หน้าทั้งหมดจะอยู่ใน multi-artboard workspace ผู้ใช้เลือก active page เพื่อแก้รายละเอียด แต่ยังเห็นภาพรวมของหลายหน้าได้

## Clean And Translate One Page

1. เลือกหน้าที่ต้องการ
2. เลือกโหมด `คลีน+แปล` หรือ `คลีนอย่างเดียว`
3. เริ่ม AI action
4. รอ PanelCleaner ลบข้อความเดิมและ Ollama ช่วยอ่าน/แปล
5. ตรวจ region ที่ได้
6. แก้ข้อความ, font, color, stroke, rotation หรือ layout mode ตามต้องการ

## Batch Processing

ใช้กับงานหลายหน้าเมื่อ setup พร้อมแล้ว

1. เพิ่มหรือเปิดหลายหน้า
2. เริ่ม batch
3. ระบบจะ clean หลายหน้าก่อน แล้วค่อย OCR/translate ทีละส่วน
4. ตรวจผลลัพธ์ใน editor
5. แก้หน้าที่มีความเสี่ยงหรือข้อความล้น

Batch workflow มีเป้าหมายให้ลดงานซ้ำ แต่ไม่แทนการ review ของผู้ใช้

## Text Editing

Text region คือสิ่งที่ผู้ใช้ควบคุมได้หลัง AI ช่วยสร้าง draft

- `balloon_fit`: ค่า default สำหรับ bubble ทั่วไป
- `artistic`: ใช้กับการวางตัวอักษรที่ต้องการ shape พิเศษบน region เดิม
- ปรับ font, size, fill, stroke, corner, alignment และ rotation ได้
- ถ้าข้อความล้น ให้ลดขนาด, ปรับบรรทัด, หรือแก้ region

## Save

มี save path หลัก 2 แบบ:

- Local project file `.moxzk`: เหมาะกับทำต่อภายหลังหรือย้ายเครื่อง
- Album: เหมาะกับงานที่ต้องการ login, cloud save, และเปิดกลับจาก library

Autosave เป็น safety net สำหรับ draft ไม่ควรใช้แทนการ save งานสำคัญ

## Export

Export อยู่ใน drawer ด้านขวาของ editor

- เลือก format และ quality
- เลือกทุกหน้าหรือเฉพาะบางหน้า
- export เป็น ZIP หรือ folder เมื่อ Electron runtime รองรับ
- ตรวจไฟล์ output ก่อนปิดงาน
