# Install Windows

Moxzk รองรับ Windows desktop เป็นเป้าหมายหลัก ดาวน์โหลดจาก GitHub Releases แล้วติดตั้งเหมือนแอป Windows ทั่วไป

## Download

1. เปิด https://github.com/sathidpong01/Moxzk/releases/latest
2. ดาวน์โหลดไฟล์ installer ของ Windows เช่น `Moxzk-<version>-Windows-x64.exe`
3. ถ้า release มี `SHA256SUMS.txt` ให้ดาวน์โหลดไฟล์ checksum ไว้ด้วย
4. เปิด installer และทำตามขั้นตอนบนหน้าจอ

ห้ามดาวน์โหลดจาก mirror ที่ไม่รู้แหล่งที่มา หน้า public ของโปรเจคควรชี้ไป GitHub Releases เท่านั้น

## SmartScreen Warning

Moxzk ยังเป็น unsigned indie build บางเครื่องอาจเจอ Windows SmartScreen warning

ถ้าคุณดาวน์โหลดจาก GitHub Releases ของโปรเจคโดยตรงและ checksum ตรงกับ release note ให้เลือก `More info` แล้ว `Run anyway` ได้ตามความเสี่ยงที่ยอมรับได้

## Verify Checksum

ถ้า release มี checksum ให้ตรวจด้วย PowerShell:

```powershell
Get-FileHash .\Moxzk-0.2.0-Windows-x64.exe -Algorithm SHA256
```

นำค่า `Hash` ไปเทียบกับ `SHA256SUMS.txt` ใน release เดียวกัน ชื่อไฟล์และ hash ต้องตรงกัน

## Update

- Moxzk เช็คอัปเดตจาก GitHub Releases หลังเปิดแอป
- เมื่อดาวน์โหลดอัปเดตเสร็จ แอปจะถามก่อน restart เพื่อติดตั้ง
- ถ้า auto-update มีปัญหา ให้ดาวน์โหลด installer ล่าสุดจาก GitHub Releases แล้วติดตั้งทับ

## Uninstall

ถอนการติดตั้งผ่าน Windows Settings ได้เหมือนแอปทั่วไป ไฟล์งาน `.moxzk` และรูปที่ export ไว้ไม่ได้ถูกลบตาม installer
