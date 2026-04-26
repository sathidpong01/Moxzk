import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('src/components/Settings/SettingsPanel.tsx', 'utf8')
const css = fs.readFileSync('src/index.css', 'utf8')
const settingsStorage = fs.readFileSync('src/services/settingsStorage.ts', 'utf8')

test('settings modal is sized as a desktop workspace', () => {
  assert.match(source, /SettingsWorkspace/)
  assert.match(source, /max-w-6xl/)
  assert.match(source, /h-\[min\(84vh,820px\)\]/)
  assert.match(css, /\.SettingsWorkspace/)
  assert.match(css, /max-width: min\(72rem, calc\(100vw - 3rem\)\) !important/)
})

test('settings exposes a zero-knowledge Ollama model tutorial', () => {
  assert.match(source, /AI \/ Models/)
  assert.match(source, /ดาวน์โหลด Ollama/)
  assert.match(source, /https:\/\/ollama\.com\/download\/windows/)
  assert.match(source, /name: 'gemma3:4b'/)
  assert.match(source, /`ollama pull \$\{model\}`/)
  assert.match(source, /ติดตั้งในเครื่องนี้/)
  assert.match(source, /คัดลอกคำสั่ง/)
  assert.match(source, /Electron/)
})

test('settings keeps translation guidance separate from model setup', () => {
  assert.match(source, /type SettingsTab = 'general' \| 'models' \| 'translation' \| 'cleanup'/)
  assert.match(source, /ใช้บริบทข้ามหน้า/)
  assert.match(source, /โหมดคำแปล/)
  assert.match(source, /สั้นเข้าใจได้/)
  assert.match(source, /ตรงตามต้นฉบับ/)
  assert.match(source, /translationMode/)
  assert.match(settingsStorage, /translationMode: settings\.translationMode/)
  assert.match(settingsStorage, /normalizeTranslationMode/)
  assert.match(source, /ไกด์โทนคำแปล/)
})
