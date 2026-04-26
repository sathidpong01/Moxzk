# MG_Translater Design

## Purpose

ไฟล์นี้อธิบาย design ของระบบในระดับโปรเจค: โปรดักต์นี้ตั้งใจเป็นอะไร, ระบบถูกแยกเป็นส่วนใดบ้าง, ขอบเขตความรับผิดชอบของแต่ละชั้นคืออะไร, และข้อจำกัดสำคัญที่ต้องรักษาไว้เมื่อพัฒนาต่อ

`README.md` เน้นการติดตั้งและการใช้งาน ส่วนไฟล์นี้เน้น "ทำไมระบบจึงถูกจัดรูปแบบแบบนี้" และ "ถ้าจะเปลี่ยนอะไร ควรเปลี่ยนตรงไหน"

## Product Definition

MG_Translater คือเครื่องมือทำความสะอาดภาพมังงะและแปลภาษาไทยแบบ human-in-the-loop

แกนของโปรดักต์ไม่ใช่ "โยนรูปให้ AI แล้วจบ" แต่คือ:

- เปิดหลายหน้าใน workspace เดียว
- ให้ AI ช่วย clean, OCR, และ translate
- ให้ผู้ใช้กลับมาแก้ region, typography, layout, และลำดับหน้าได้ง่าย
- บันทึกงานลง album และ export กลับออกไปเป็นไฟล์ภาพได้

เป้าหมายด้าน UX คือให้ผู้ใช้รู้สึกว่าใช้งาน "editor ที่มี AI overlay" มากกว่า "chat tool ที่แปลรูปได้"

## Design Goals

1. `Editor-first workflow`
   - การอัปโหลด, เปิด album, AI processing, review, save, และ export ต้องหมุนรอบ editor เดียวกัน
   - การเปิด album ควรโหลดทุกหน้าเข้า editor ทันที โดยเลือกหน้าแรกเป็น active page ไม่เพิ่ม page-picker ที่ไม่จำเป็น

2. `Page-centric multi-page model`
   - หนึ่งโปรเจคประกอบด้วยหลายหน้า แต่ผู้ใช้ต้องเห็นทั้งภาพรวมและแก้รายละเอียดรายหน้าได้
   - state หลักจึงเก็บเป็นรายการ `ImageEntry` ต่อหน้า ไม่ใช่ก้อนผลลัพธ์เดียวทั้งงาน

3. `Local processing, cloud persistence`
   - งานที่หนักและผูกกับเครื่องผู้ใช้ เช่น PanelCleaner และ Ollama อยู่ฝั่ง local runtime
   - งานที่ต้องการบัญชี, ownership, metadata, และ object storage อยู่ฝั่ง Cloudflare Worker + D1/R2

4. `Prepare for Electron without rewriting domain logic`
   - โค้ด business logic ไม่ควรถูกผูกกับ browser API แบบตรงเกินไป
   - การแตะ native capability ต้องผ่าน runtime contract เพื่อให้สลับจาก web ไป Electron ได้ทีละส่วน

5. `Thai translation continuity matters`
   - ระบบต้องรักษาความต่อเนื่องของคำเรียก, ความสัมพันธ์, สำนวน, และ glossary ข้ามหน้า
   - การแปลจึงไม่ควรถูกออกแบบเป็น isolated page-by-page inference แบบไม่รู้บริบท

6. `Explicit ownership and safe storage`
   - object ใน R2 ต้องมี metadata ใน D1 และต้องผ่าน ownership checks ก่อนเข้าถึง
   - ห้ามให้ browser หรือ client code เชื่อ key/path เพียงอย่างเดียว

7. `Clear editor affordances`
   - สิ่งที่คลิกได้ต้องแสดง cursor แบบ clickable ให้ชัดเจน
   - สิ่งที่ปิดใช้งานต้องดูและรู้สึกต่างจาก action ปกติ
   - drag handle, canvas tool cursor, และ resize/transform affordance ต้องไม่ถูกทำให้เหมือนปุ่มทั่วไป

## Explicit Non-Goals

- ไม่ทำ mobile-first UI ในเฟสปัจจุบัน
- ไม่ vendor โค้ด GPLv3 ของ PanelCleaner เข้ามาใน repo
- ไม่เก็บ secret สำคัญไว้ใน `VITE_*` env เพื่อใช้ตรงใน browser
- ไม่ออกแบบให้ AI แปลแทนมนุษย์แบบไม่มีขั้น review/แก้ไข
- ไม่ทำ backend processing ฝั่ง cloud เป็นเส้นทางหลักสำหรับ cleanup/OCR ในดีไซน์ปัจจุบัน

## System Context

```text
User
  |
  v
React + Vite App
  |
  +--> Zustand stores + UI workflow
  |       - upload
  |       - edit
  |       - export
  |
  +--> Local processing services
  |       - PanelCleaner bridge
  |       - Ollama OCR / translation / vision
  |
  +--> Cloudflare API
          - auth / session
          - albums / pages metadata
          - R2 object storage
          - D1 ownership checks
```

ระบบถูกแบ่งออกเป็น 3 ขอบเขตหลัก:

- `Frontend editor shell` สำหรับ workflow, canvas, state, และ user interaction
- `Local AI/cleanup runtime` สำหรับงานประมวลผลภาพและโมเดลที่ต้องรันใกล้เครื่องผู้ใช้
- `Cloud persistence layer` สำหรับ auth, albums, metadata, และ object storage

หมายเหตุ: เส้นทางที่รองรับและใช้งานจริงในปัจจุบันคือ Cloudflare Worker + D1 + R2 เท่านั้น เว้นแต่จะมีการตัดสินใจ migration ใหม่อย่างชัดเจน

## Core Architecture

### 1. Frontend Shell

Frontend อยู่ที่ React 19 + Vite 8 + TypeScript

องค์ประกอบหลัก:

- `src/App.tsx`
  - คุม workflow ระดับบน: upload, edit, export, auth modal, albums, settings
- `src/store/appStore.ts`
  - state ของ editor, page entries, active page, regions, brush strokes, processing status
- `src/store/albumStore.ts`
  - state และ action สำหรับ albums/pages ฝั่ง Cloudflare
- `src/store/authStore.ts`
  - session และ user profile

UI ถูกออกแบบให้ editor เป็นแกนกลาง:

- `UploadStep` สำหรับนำรูปเข้า
- `EditStep` สำหรับ workflow หลักของโปรดักต์
- `ExportDrawer` สำหรับ preview, เลือก format/quality, และส่งออกไฟล์โดยไม่พาผู้ใช้ออกจาก editor

surface ปัจจุบันของ editor ประกอบด้วย:

- `ArtboardWorkspace` เป็น canvas หลักแบบ multi-artboard ที่แสดงหลายหน้าใน workspace เดียว
- `PanelToggleBar` เป็น toolbar สำหรับ tool, undo/redo, zoom, fit view, และ workspace navigation
- `FloatingInspector` เป็นแผงปรับข้อความ แปรง และงานระดับหน้า
- `ContextualTextHud` เป็น HUD ที่โผล่ใกล้ text region สำหรับแก้ typography/translate/delete เร็ว
- `ImageStrip` เป็น filmstrip สำหรับสลับหน้าในงานหลายหน้า
- `AlbumListModal` และ `ExportDrawer` เป็น modal/drawer เสริม workflow โดยไม่เปลี่ยน model หลักของ editor

### 2. Editor Model

editor ใช้ Konva/react-konva และยึด page model เป็นหลัก

entity สำคัญ:

- `ImageEntry`
  - ตัวแทนของ 1 หน้า
  - เก็บไฟล์ต้นฉบับ, cleaned image, regions, brush strokes, status, page number, และ metadata ฝั่ง album/R2
- `TextRegion`
  - กรอบข้อความที่ผู้ใช้แก้ไขได้
  - รองรับ typography, stroke, alignment, rotation, confidence, และ layout mode
- `BrushStroke`
  - งานแก้/ลบจุดบนภาพแบบ manual

หลักการสำคัญ:

- หน้าเป็นหน่วยงานหลักของระบบ
- ผู้ใช้แก้ active page แต่ยังต้องมองเห็น context ของงานหลายหน้าได้
- draft snapshot ต้องเก็บทั้งรายการหน้า ไม่ใช่เฉพาะหน้าที่กำลังเปิด
- workspace ปัจจุบันเป็น multi-artboard board-first: เห็นหลายหน้าและจัดลำดับหน้าใน canvas เดียว
- artboard position และ page order เป็น state ของหน้าและต้อง sync กลับ album เมื่อบันทึก

### 3. Text Layout Strategy

ระบบรองรับ layout text อย่างน้อย 2 โหมด:

- `balloon_fit`
  - default ที่ปลอดภัยสำหรับ speech bubble และงานมังงะทั่วไป
- `artistic`
  - ใช้เมื่ออยากดัดการวางข้อความเชิงศิลป์มากขึ้นบน region เดิม

design intent คือ:

- region เดิมต้องปรับโหมดได้
- ไม่ควรบังคับสร้าง region ใหม่เพียงเพื่อสลับรูปแบบการวางข้อความ
- โหมด default ของข้อมูลเก่าและงานใหม่ควรเป็น `balloon_fit`

### 4. AI Processing Pipeline

pipeline หลักอยู่ที่ `src/services/batch-processing.ts`

ลำดับงานระดับสูง:

1. เลือกหน้าที่ต้องประมวลผล
2. clean ภาพผ่าน PanelCleaner batch ก่อน
3. derive text boxes จาก cleanup diff เมื่อเหมาะสม
4. translate/OCR ผ่าน Ollama
5. append story context ของหน้าก่อนหน้าเพื่อรักษาความต่อเนื่อง
6. บันทึกผลกลับเข้า `ImageEntry.regions`
7. เปิดให้ผู้ใช้ review และแก้ใน editor

เหตุผลที่ clean ก่อน translate:

- noise reduction ช่วย OCR/vision model
- pipeline แยก failure ได้ชัดกว่า
- retry แบบ stage-aware ทำได้ง่ายกว่า

เหตุผลที่ batch translate ยังส่ง context ข้ามหน้า:

- ความสัมพันธ์ตัวละครและคำเรียกในมังงะเปลี่ยนความหมายได้มากหากแปลแบบไม่รู้บริบท
- style guide และ previous lines จึงเป็นส่วนหนึ่งของ design ไม่ใช่ optional garnish

### 5. Local Processing Boundary

งาน local processing ถูกแยกจาก frontend ผ่าน service layer:

- PanelCleaner ผ่าน `scripts/panelcleaner-bridge.mjs`
- Ollama ผ่าน `src/services/ollama.ts`

จุดตั้งใจของ design:

- frontend รู้เพียง endpoint/contract
- logic orchestration อยู่ใน service ไม่กระจายตาม component
- สามารถเปลี่ยนวิธีเรียก native/local service ใน Electron phase ได้โดยไม่ต้องเขียน editor ใหม่

### 6. Cloud Persistence Layer

Cloudflare Worker เป็น API layer หลักของระบบ:

- entrypoint: `src/worker/index.ts`
- auth logic: `src/worker/auth.ts`
- album/page logic: `src/worker/albums.ts`
- storage/object logic: `src/worker/storage.ts`
- schema source of truth: `src/worker/db/schema.ts`
- migrations: `drizzle/`

การเก็บข้อมูลแยก 2 ชั้น:

- `D1`
  - users
  - auth identities
  - sessions
  - albums
  - album pages
  - objects metadata
- `R2`
  - original image
  - cleaned image
  - thumbnail
  - cover

หลักการสำคัญ:

- D1 คือ source of truth ของ metadata และ ownership
- R2 key ไม่ใช่หลักฐานสิทธิ์
- การลบ album/page เป็น hard delete พร้อมลบ object ที่เกี่ยวข้อง

## Runtime Boundary and Electron Direction

runtime abstraction คือหัวใจของ design ระยะกลางของโปรเจคนี้

interface `AppRuntime` ใน `src/runtime/types.ts` แยก capability ที่ browser ทำได้กับ capability ที่ native shell จะทำได้ในอนาคต

ขอบเขตหลักของ runtime:

- `ollama`
  - ตรวจสถานะ server
  - list model
- `panelCleaner`
  - ตรวจสถานะ bridge/service
- `files`
  - save file เดี่ยว
  - export หลายไฟล์
- `projectDraft`
  - save/load/clear draft
- `capabilities`
  - ประกาศว่า runtime นี้ทำ native action อะไรได้บ้าง

### Web runtime today

`src/runtime/webRuntime.ts` คือ implementation ปัจจุบัน

- `canStartLocalServices = false`
- `canPickNativeFolders = true` เฉพาะ browser ที่รองรับ `showDirectoryPicker`
- `canSecureStoreSecrets = false`
- `canUseCustomProtocolAuth = false`

ผลเชิง design:

- web phase ยังสั่ง start Ollama/PanelCleaner เองไม่ได้
- การ export ใช้ File System Access API ถ้า browser รองรับ ไม่เช่นนั้น fallback เป็น ZIP
- project draft ใช้ IndexedDB
- secret ระดับระบบยังไม่ถือว่าปลอดภัยพอใน browser shell

### Electron target

Electron V1 เพิ่ม shell แบบ "เปลี่ยน runtime implementation ไม่เปลี่ยน business model" แล้ว โดยยังคง renderer เป็น React/Vite browser-style app และให้ native action วิ่งผ่าน `AppRuntime`

สิ่งที่ V1 รองรับ:

- native save dialog สำหรับ ZIP/single-file export
- native folder export ผ่าน main process
- desktop draft persistence โดยเก็บ manifest และ image assets ใต้ Electron `userData`
- typed IPC เฉพาะ export/draft โดยไม่ expose raw `ipcRenderer`

สิ่งที่ยังเป็นเฟสถัดไป:

- native start/check service ของ Ollama และ PanelCleaner
- secure local storage สำหรับ secret
- custom protocol auth callback เช่น `mg-translater://auth/callback`

ข้อกำหนดเชิงสถาปัตยกรรม:

- ห้ามให้ component คุยกับ `ipcRenderer` โดยตรง
- ห้ามย้าย business logic กระจัดกระจายเข้า preload/main แบบไม่จำเป็น
- native action ทุกอย่างควรถูกดันเข้า runtime contract ก่อน

## Data Model Summary

### Local working state

- `ImageEntry[]`
  - หน้าทั้งหมดในโปรเจค
- `activeImageId`
  - หน้าที่กำลังแก้
- `regions`
  - active page overlay state
- `brushStrokes`
  - active page manual edits
- `settings`
  - endpoint, model, style guide, font map

### Draft snapshot

`RuntimeProjectDraft` ต้องเก็บ:

- step ปัจจุบัน
- active page
- image entries ทั้งหมด
- region และ brush state ของหน้าที่ active
- settings
- saved timestamp

เหตุผล:

- autosave ต้องกู้ project กลับมาได้ในสภาพที่ผู้ใช้คาดหวังจริง
- ถ้าเก็บแค่ active fragment จะทำให้ multi-page workflow แตก

### Remote album state

album ไม่ใช่แค่ชื่อโฟลเดอร์ แต่เป็น remote project container ที่ผูกกับผู้ใช้และ ownership

แต่ละ page เก็บ:

- page order
- artboard position
- original/cleaned keys
- thumbnail/hash metadata
- serialized edit payload

ตอนเปิด album ระบบ fetch page payload แบบเต็มเพื่อสร้าง `ImageEntry` ทุกหน้า แล้ว hydrate รูปของ active page ก่อน ส่วนรูปหน้าอื่นสามารถโหลดต่อแบบ background ได้เพื่อไม่บล็อกการกลับเข้า editor

## Primary User Flows

### 1. New project

1. ผู้ใช้อัปโหลดหลายรูป
2. ระบบสร้าง `ImageEntry` ต่อหน้า
3. editor เปิดเป็น multi-artboard workspace
4. ผู้ใช้ใช้ filmstrip หรือเริ่มแก้ด้วยมือก่อนก็ได้
5. ผู้ใช้เลือก run AI แบบหน้าเดียวหรือ batch ได้จาก workflow เดียวกัน

### 2. Open existing album

1. ผู้ใช้เปิด album modal
2. เลือก album
3. ระบบ fetch ทุกหน้าแบบเต็ม
4. ระบบโหลดทุกหน้าเข้า editor พร้อมเลือกหน้าแรกเป็น active page หรือ page ที่ request จาก detail view
5. modal ปิดและผู้ใช้กลับเข้าสู่ editor ทันที

นี่คือ contract ปัจจุบันของโปรดักต์ และควรถูกถือเป็น default behavior

### 3. Batch AI run

1. queue หน้าเป้าหมาย
2. clean ทีละ batch ผ่าน PanelCleaner
3. translate/OCR ทีละหน้าโดยเก็บ story context สดระหว่าง run
4. mark status และ error ต่อหน้า
5. เปิดให้ retry เฉพาะส่วนที่ล้มเหลวได้

### 4. Save to album

1. สร้างหรือเลือก album
2. upload object ที่จำเป็นไป R2
3. update page metadata ใน D1 ผ่าน Worker
4. sync `albumPageId` และ key ต่าง ๆ กลับเข้า editor state

### 5. Export

1. เปิด `ExportDrawer` จาก editor
2. เลือก format, quality, preview mode, และหน้าเป้าหมาย
3. drawer render preview จาก editor state และให้เทียบ before/after เมื่อมีข้อมูลพอ
4. ถ้า runtime รองรับ เลือก folder แล้วเขียนไฟล์ตรง
5. ถ้าไม่รองรับ fallback เป็น ZIP

## Interaction and Cursor Affordance

กฎ UX สำหรับ target ที่โต้ตอบได้:

- button, icon button, toolbar tool, tab, dropdown item, listbox trigger/option, album card, export preview card, และ label ที่เปิด file picker ต้องใช้ cursor แบบ pointer
- disabled action ต้องใช้ `not-allowed` และไม่ควรมี hover state ที่สื่อว่า action พร้อมใช้งาน
- drag handle ต้องใช้ `grab` และ active drag ต้องใช้ `grabbing`
- canvas/editor stage ต้องใช้ cursor ตาม active tool เช่น select, brush, eraser, eyedropper, และ pan ผ่าน `getEditorToolCursor()`
- pointer feedback เป็นส่วนหนึ่งของ accessibility และ operability ไม่ใช่แค่ visual polish

## Security and Trust Boundaries

1. `Browser vs native`
   - browser shell ไม่ถือว่าเป็นที่เก็บ secret ที่ปลอดภัย
   - ดังนั้น feature ที่ต้องการ secure secret storage เป็นงานของ Electron phase

2. `Client vs Worker`
   - client ไม่ควรเข้าถึง object โดยข้าม Worker
   - session/auth ต้องวิ่งผ่าน Worker และ cookie policy

3. `D1 vs R2`
   - path ใน R2 ใช้เก็บ object แต่สิทธิ์จริงอยู่ใน D1 metadata + ownership checks

4. `Local tools`
   - PanelCleaner เป็น external dependency
   - ระบบต้องยอมรับความจริงว่า tool อาจไม่ติดตั้ง, path อาจไม่เจอ, service อาจไม่พร้อม

## Reliability and Failure Model

ระบบนี้ถูกออกแบบให้ fail แบบแยกส่วนได้:

- PanelCleaner ล้มเหลว แต่ editor และ album ยังทำงานต่อได้
- Ollama ไม่พร้อม ผู้ใช้ยังแก้ไข manual และบันทึกงานได้
- R2 image บางหน้าต้อง lazy load ตอนเปิด album
- export folder ล้มเหลวแล้ว fallback เป็น ZIP ได้
- batch processing ต้อง mark error ต่อหน้า ไม่ทำให้งานทั้งก้อนไร้สถานะ

ผลคือ state model ต้อง explicit เรื่อง:

- `status`
- `progress`
- `lastErrorStage`
- retry path

## Design Guardrails

เมื่อพัฒนาต่อ ให้รักษาหลักต่อไปนี้:

1. ฟีเจอร์ editor ใหม่ควรต่อยอดจาก `ImageEntry` และ `TextRegion` ที่มีอยู่ ไม่สร้าง parallel model โดยไม่จำเป็น
2. native capability ใหม่ต้องผ่าน `AppRuntime` ก่อน ไม่เรียก browser/native API ตรงจากหลาย component
3. schema ฝั่ง D1 ต้องแก้ผ่าน Drizzle schema และ migrations เท่านั้น
4. `balloon_fit` ต้องยังเป็น default ที่ปลอดภัยสำหรับงานมังงะ
5. การเปิด album ต้องยังคง direct-open เข้า editor เป็นค่าเริ่มต้น
6. ถ้าทำงานกับข้อความภาษาไทย ต้องรักษา UTF-8 และเลี่ยง replacement character
7. การเปลี่ยน backend หลักต้องถือเป็น architectural decision แยก ไม่ใช่ refactor ย่อย
8. interactive UI ใหม่ต้องกำหนด cursor/focus/disabled state ให้ตรงกับพฤติกรรมจริง

## Current Limitations

- Electron V1 ยังเป็น dev shell และยังไม่มี installer/signing/auto-update
- การ start/check local services ยังเป็น manual ใน web phase
- secure secret storage ยังไม่พร้อมใน browser runtime
- verification สำคัญหลายอย่างยังต้องพึ่ง browser smoke test นอกเหนือจาก unit/script tests

## Next Design Step

เฟสถัดไปที่สมเหตุสมผลที่สุดคือเพิ่ม Electron shell โดยคง shape ปัจจุบันไว้:

- รักษา editor/state/service layer เดิม
- เพิ่ม Electron runtime implementation คู่กับ `webRuntime`
- ใส่ typed IPC สำหรับ native capability เท่านั้น
- ไม่รื้อ workflow หลัก upload -> edit -> save/export

ถ้าทำถูก direction นี้ MG_Translater จะขยับจาก "web-first editor" ไปเป็น "desktop-native manga translation workstation" ได้โดยไม่เสียโครงสร้างหลักของระบบ

## Key Reference Files

- `README.md`
- `src/App.tsx`
- `src/store/appStore.ts`
- `src/store/albumStore.ts`
- `src/services/batch-processing.ts`
- `src/services/editorCursor.ts`
- `src/components/Editor/ArtboardWorkspace.tsx`
- `src/components/Editor/ExportDrawer.tsx`
- `src/services/projectDraftStorage.ts`
- `src/runtime/types.ts`
- `src/runtime/webRuntime.ts`
- `src/worker/index.ts`
- `src/worker/db/schema.ts`
- `docs/cloudflare-d1-schema.md`
