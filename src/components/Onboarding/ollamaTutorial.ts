export type OllamaTutorialStepId =
  | 'download'
  | 'run-installer'
  | 'finish-install'
  | 'check-status'
  | 'pull-model'
  | 'save-settings'

export interface OllamaTutorialStep {
  id: OllamaTutorialStepId
  eyebrow: string
  title: string
  body: string
  imageSrc: string
  imageAlt: string
  action?: 'download' | 'check-status' | 'start-ollama' | 'pull-model' | 'save-settings'
}

export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download/windows'
export const OLLAMA_RECOMMENDED_MODEL = 'gemma3:4b'

export const OLLAMA_TUTORIAL_STEPS: OllamaTutorialStep[] = [
  {
    id: 'download',
    eyebrow: 'Step 1',
    title: 'ดาวน์โหลด Ollama สำหรับ Windows',
    body: 'กดดาวน์โหลดจากเว็บ Ollama โดยตรง แล้วรอให้ไฟล์ติดตั้งโหลดเสร็จในเครื่อง',
    imageSrc: '/tutorial/ollama/download.webp',
    imageAlt: 'สกรีนช็อตหน้า Download Ollama ที่เลือก Windows และมีปุ่ม Download for Windows',
    action: 'download',
  },
  {
    id: 'run-installer',
    eyebrow: 'Step 2',
    title: 'เปิดไฟล์ติดตั้งที่โหลดมา',
    body: 'เปิดไฟล์ OllamaSetup.exe จากโฟลเดอร์ดาวน์โหลด แล้วทำตามหน้าต่างติดตั้งจนจบ',
    imageSrc: '/tutorial/ollama/installer-file.webp',
    imageAlt: 'ภาพตัวอย่างไฟล์ OllamaSetup.exe ในโฟลเดอร์ดาวน์โหลดหลังโหลดจากเว็บ Ollama',
  },
  {
    id: 'finish-install',
    eyebrow: 'Step 3',
    title: 'ปล่อยให้ Ollama ทำงานอยู่เบื้องหลัง',
    body: 'หลังติดตั้งเสร็จ Ollama จะทำงานเป็นโปรแกรม Windows และเปิดบริการในเครื่องให้ Moxzk เชื่อมต่อได้',
    imageSrc: '/tutorial/ollama/ollama-running.webp',
    imageAlt: 'ภาพตัวอย่าง PowerShell ที่ตรวจเวอร์ชัน Ollama และบริการ localhost หลังติดตั้งเสร็จ',
    action: 'start-ollama',
  },
  {
    id: 'check-status',
    eyebrow: 'Step 4',
    title: 'กลับมาเช็คสถานะใน Moxzk',
    body: 'กลับมาที่หน้า AI แปลภาษาใน Moxzk แล้วกดตรวจสถานะ ถ้าพร้อมใช้งานจะเห็นข้อความว่า Ollama พร้อมใช้งาน',
    imageSrc: '/tutorial/ollama/moxzk-check-status.webp',
    imageAlt: 'สกรีนช็อตหน้า AI แปลภาษาใน Moxzk ที่มีปุ่มตรวจสถานะ Ollama',
    action: 'check-status',
  },
  {
    id: 'pull-model',
    eyebrow: 'Step 5',
    title: `โหลดโมเดล ${OLLAMA_RECOMMENDED_MODEL} เข้า Ollama`,
    body: `ใช้ปุ่มโหลดเข้า Ollama ใน Moxzk หรือรันคำสั่ง ollama run ${OLLAMA_RECOMMENDED_MODEL} จาก PowerShell ก็ได้`,
    imageSrc: '/tutorial/ollama/gemma-model.webp',
    imageAlt: 'สกรีนช็อตหน้าโมเดล gemma3:4b บน Ollama ที่แสดงคำสั่งใช้งาน',
    action: 'pull-model',
  },
  {
    id: 'save-settings',
    eyebrow: 'Step 6',
    title: 'บันทึกแล้วเริ่มแปลภาพ',
    body: 'เมื่อสถานะพร้อมและมีโมเดลแล้ว ให้บันทึกการตั้งค่า จากนั้นเริ่มคลีนและแปลภาพได้ตามปกติ',
    imageSrc: '/tutorial/ollama/moxzk-save-settings.webp',
    imageAlt: 'สกรีนช็อตหน้า AI แปลภาษาใน Moxzk ที่มีปุ่มบันทึกการตั้งค่าด้านบน',
    action: 'save-settings',
  },
]
