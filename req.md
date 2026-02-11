โครงสร้างแอพแปลมังงะ AI (Hybrid WebGPU Edition)

โครงสร้างนี้ออกแบบมาเพื่อลดค่าใช้จ่าย Server โดยผลักภาระงาน Inpainting (การลบภาพ) ไปใช้ GPU ของผู้ใช้งานผ่าน Browser

1. Hybrid Tech Stack

Server-Side (Next.js Node.js)

Logic: รับผิดชอบเรื่อง Auth, Database, และการเรียก LLM

Translation: ใช้ Gemini 2.5 Flash เพื่อหาพิกัดกล่องข้อความและแปลภาษา (เพราะ LLM ยังใหญ่เกินกว่าจะรันบน Browser ได้ลื่นไหล)

Client-Side (Browser)

Engine: Transformers.js (v3)

Accelerator: WebGPU API (มาตรฐานใหม่แทน WebGL เร็วกว่ามาก)

Multithreading: Web Workers (แยก Thread ประมวลผล เพื่อไม่ให้ UI กระตุก)

2. ขั้นตอนการทำงาน (Hybrid Workflow)

Step 1: Upload & Scan (Server)

User อัปโหลดภาพ

Next.js ส่งภาพไปหา Gemini

Gemini ตอบกลับมาเป็น JSON:

{
"translations": [
{ "text": "สวัสดี", "box": [10, 10, 100, 50] } // พิกัดสำหรับทำ Mask
]
}

Step 2: Mask Generation (Client - Canvas)

Frontend ได้รับ JSON

ใช้ HTML5 Canvas วาดสี่เหลี่ยมสีขาวทับตำแหน่ง box บนพื้นหลังสีดำ

export ออกมาเป็น mask_image (Base64/Blob)

Step 3: Inpainting (Client - WebGPU)

Frontend ส่ง "ภาพต้นฉบับ" + "ภาพ Mask" ไปที่ inpainting.worker.ts

Worker เรียก Transformers.js โหลดโมเดล LaMa (ONNX) ลง cache เครื่อง User (โหลดครั้งเดียว ครั้งต่อไปเร็วมาก)

รันโมเดลบน GPU ผู้ใช้

ส่งคืน "ภาพคลีน (Clean Image)" กลับมา

Step 4: Typesetting (Client - React)

Frontend นำภาพคลีนมาวางเป็น Background

เรนเดอร์ข้อความภาษาไทยทับลงไปตามตำแหน่งเดิม

3. สิ่งที่ต้องเตรียม

Dependencies

npm install @xenova/transformers
npm install sharp # สำหรับ Server-side fallback (ถ้าเครื่อง User ไม่ไหว)

การตั้งค่า Next.js (next.config.js)

ต้องอนุญาตให้โหลดไฟล์ WASM และ Model จากภายนอก

/\*_ @type {import('next').NextConfig} _/
const nextConfig = {
webpack: (config) => {
config.resolve.alias = {
...config.resolve.alias,
"sharp$": false,
      "onnxruntime-node$": false,
}
return config;
},
}
module.exports = nextConfig

4. ข้อดี-ข้อเสีย ของวิธีนี้

ข้อดี:

Free Inpainting: ไม่เสียเงินค่า API Replicate แม้แต่บาทเดียว

Privacy: ภาพที่จะถูกลบคำ ไม่ต้องถูกส่งไปหา 3rd Party Inpainting Service (แต่ยังต้องส่งไป Gemini เพื่อแปลนะ)

Offline Capable: ถ้า User เคยโหลดโมเดลแล้ว สามารถรัน Inpainting ตอนไม่มีเน็ตได้ (แต่การแปลยังต้องใช้เน็ต)

ข้อเสีย:

First Load ช้า: การโหลดโมเดล ONNX ครั้งแรก (ขนาดประมาณ 300MB-1GB) จะใช้เวลาโหลดนาน

Hardware Requirement: เครื่อง User ต้องมีการ์ดจอที่รองรับ WebGPU (Chrome/Edge รุ่นใหม่ๆ รองรับหมดแล้ว แต่มือถือเก่าๆ อาจจะไม่ไหว) -> ต้องมีระบบ Fallback ไปใช้ Server หรือ Simple Fill
