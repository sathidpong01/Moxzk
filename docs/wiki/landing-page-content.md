# Landing Page Content

ไฟล์นี้เป็น canonical public copy สำหรับหน้า Moxzk ใน Magga ใช้เพื่อ sync ข้อความกับ `D:\magga\app\Moxzk`

## Hero

Eyebrow: `Free Download · Windows`

Headline: `Moxzk`

Subheadline: `คลีนภาพมังงะ แปลไทย และจัดข้อความกลับบนภาพ ในแอปเดสก์ท็อปเดียว`

Body:

```text
AI ช่วยลบข้อความเดิม อ่านภาพ และร่างคำแปลให้เร็วขึ้น ส่วนคุณยังแก้คำ ฟอนต์ ตำแหน่ง และส่งออกงานเองได้เหมือนใช้โปรแกรมแก้ภาพ
```

Primary CTA: `Download for Windows`

Secondary CTA: `อ่านวิธีติดตั้ง`

Trust note:

```text
ดาวน์โหลดจาก GitHub Releases เท่านั้น ตอนนี้แอปยังไม่ได้เซ็นชื่อ Windows อาจแสดงคำเตือนตอนเปิดไฟล์ติดตั้ง
```

## Download Block

Title: `ดาวน์โหลดอย่างปลอดภัย`

Body:

```text
ดาวน์โหลดจาก GitHub Releases ของโปรเจคเท่านั้น ถ้ามี SHA256 ให้ตรวจไฟล์ก่อนติดตั้ง และเก็บตัวติดตั้งไว้ใช้เมื่อต้องอัปเดตเอง
```

Items:

- `GitHub Releases`: `ใช้ลิงก์ release ล่าสุดของโปรเจคเป็นแหล่งดาวน์โหลด`
- `คำเตือน Windows`: `ตอนนี้แอปยังไม่ได้เซ็นชื่อ Windows อาจเตือนตอนเปิดไฟล์ติดตั้ง`
- `ตรวจไฟล์`: `ถ้า release มี SHA256 ให้ใช้ตรวจไฟล์ก่อนติดตั้ง`
- `Windows เท่านั้น`: `Moxzk ทำและทดสอบสำหรับ Windows desktop เป็นหลัก`

## What It Does

Title: `ฟังก์ชันหลักที่ใช้ทำงานจริง`

Cards:

- `คลีนข้อความเดิม`: `ลบข้อความในช่องคำพูดออกจากภาพ แล้วเปิดให้คุณตรวจและแก้จุดที่ยังไม่เนียน`
- `ช่วยอ่านและแปลไทย`: `ให้ AI ช่วยอ่านข้อความจากภาพและร่างคำแปลไทย เพื่อเริ่มงานได้เร็วขึ้น`
- `แก้ข้อความบนภาพ`: `ปรับคำ ฟอนต์ สี เส้นขอบ ตำแหน่ง และขนาดกรอบข้อความได้จากหน้าแก้ไข`
- `ทำงานหลายหน้า`: `เปิดหลายหน้าในงานเดียว สลับหน้า ตรวจภาพรวม และให้แอปช่วยประมวลผลหลายหน้าต่อเนื่อง`
- `บันทึกงานไว้ทำต่อ`: `บันทึกเป็นไฟล์ .moxzk บนเครื่อง หรือใช้บัญชีเพื่อเก็บงานเป็นอัลบั้มและเปิดกลับมาแก้ต่อ`
- `ส่งออกเป็นรูป`: `เลือกหน้าที่ต้องการ แล้วส่งออกเป็นไฟล์ภาพหรือชุดไฟล์สำหรับนำไปใช้งานต่อ`

## How To

Title: `เริ่มจากรูปหนึ่งหน้า แล้วค่อยทำทั้งเล่ม`

Steps:

1. `ติดตั้ง Moxzk`: `ดาวน์โหลดจาก GitHub Releases แล้วติดตั้งบน Windows`
2. `ตั้งค่าเครื่องมือ`: `เตรียม PanelCleaner, Ollama และโมเดลที่ใช้ช่วยอ่านภาพ`
3. `คลีนและแปล`: `เพิ่มรูป ให้แอปช่วยลบข้อความเดิมและร่างคำแปลไทย`
4. `ตรวจงานและส่งออก`: `แก้คำและตำแหน่งข้อความ แล้วบันทึกงานหรือส่งออกเป็นรูป`

## FAQ

Use the questions and answers from `docs/wiki/faq.md`. Keep at least these 10 questions visible on the landing page:

- ใช้ Windows เท่านั้นไหม?
- ต้องสมัครบัญชีไหม?
- ต้องติดตั้ง Ollama/PanelCleaner ไหม?
- รูปภาพออกจากเครื่องไหม?
- Cloud album คืออะไร?
- ทำไม Windows เตือนตอนติดตั้ง?
- อัปเดตแอปยังไง?
- เปิดไฟล์งานเดิม/ย้ายเครื่องได้ไหม?
- ถ้าแปลหรือคลีนไม่ทำงานต้องเช็คอะไร?
- ใช้ฟรีไหม?

## Dev And Docs Links

- `GitHub`: https://github.com/sathidpong01/Moxzk
- `Latest release`: https://github.com/sathidpong01/Moxzk/releases/latest
- `All releases`: https://github.com/sathidpong01/Moxzk/releases
- `Issues`: https://github.com/sathidpong01/Moxzk/issues
- `Wiki source`: `D:\Moxzk\docs\wiki\README.md`

## Public Copy Guardrails

- Do not use fake user counts, fake accuracy numbers, or unverified performance claims
- Do not say all images never leave the machine because cloud album upload exists
- Avoid public jargon: D1, R2, metadata, object key, token hash, Worker internals
- Use direct Thai for ordinary users
