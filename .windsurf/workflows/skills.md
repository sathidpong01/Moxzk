---
description: วิธีใช้ skills ที่มีในโปรเจค Moxzk — เรียก skill ที่เหมาะสมกับงานที่กำลังทำ
---

# Skills Workflow

## Available Skills

| Skill                      | เมื่อไหร่ใช้                                              | คำสั่ง                                                        |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| **manga-translator**       | อ่านก่อนเริ่มทำงานทุกครั้ง — architecture, pipeline, APIs | อ่าน SKILL.md                                                 |
| **ui-ux-pro-max**          | ออกแบบ UI, เลือกสี, font, style, accessibility            | `python .agents/skills/ui-ux-pro-max/scripts/search.py`       |
| **prompt-engineering**     | ออกแบบ/ปรับ prompt สำหรับ Gemini (แปล, mood, font)        | อ่าน SKILL.md                                                 |
| **typescript-expert**      | ปัญหา TypeScript, types, build, module resolution         | อ่าน SKILL.md                                                 |
| **ai-engineer**            | Gemini integration, streaming, error handling, multimodal | อ่าน SKILL.md                                                 |
| **systematic-debugging**   | Debug ปัญหาทุกชนิด — ทำตาม 4 phases                       | อ่าน SKILL.md                                                 |
| **web-design-guidelines**  | ตรวจสอบ UI ตาม web standards                              | อ่าน SKILL.md                                                 |
| **webapp-testing**         | ทดสอบ web app ด้วย Playwright                             | `python .agents/skills/webapp-testing/scripts/with_server.py` |
| **computer-vision-expert** | อ้างอิง CV best practices (YOLO, SAM)                     | อ่าน SKILL.md                                                 |

## Step 1: อ่าน Project Skill ก่อนเสมอ

// turbo

```bash
cat .agents/skills/manga-translator/SKILL.md
```

## Step 2: เลือก Skill ตามงาน

### ออกแบบ UI

```bash
python .agents/skills/ui-ux-pro-max/scripts/search.py "manga reader dark mode" --design-system -p "Moxzk"
```

### ปรับ Prompt สำหรับ Gemini

อ่าน `.agents/skills/prompt-engineering/SKILL.md` แล้วใช้ patterns:

- Few-shot learning สำหรับ mood detection
- Chain-of-thought สำหรับ translation quality
- Template systems สำหรับ structured output

### Debug ปัญหา

อ่าน `.agents/skills/systematic-debugging/SKILL.md` แล้วทำตาม 4 phases:

1. Root Cause Investigation
2. Pattern Analysis
3. Hypothesis and Testing
4. Implementation

### ทดสอบ Web App

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "npm run dev" --port 5173 -- python test_script.py
```

## Step 3: ตรวจสอบ TypeScript

// turbo

```bash
npx tsc --noEmit
```
