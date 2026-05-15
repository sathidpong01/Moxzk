import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const tutorialSource = fs.readFileSync('src/components/Onboarding/ollamaTutorial.ts', 'utf8')
const modalSource = fs.readFileSync('src/components/Onboarding/OllamaInstallTutorialModal.tsx', 'utf8')
const firstRunSource = fs.readFileSync('src/components/Onboarding/FirstRunSetupView.tsx', 'utf8')
const onboardingStorage = fs.readFileSync('src/services/onboardingStorage.ts', 'utf8')
const appSource = fs.readFileSync('src/App.tsx', 'utf8')
const css = fs.readFileSync('src/index.css', 'utf8')
const setupIconFiles = [
  'moxzk.svg',
  'python.svg',
  'panelcleaner.svg',
  'ollama.svg',
  'model.svg',
  'translation.svg',
  'account-albums.svg',
  'workspace.svg',
]

const stepIds = [
  'download',
  'run-installer',
  'finish-install',
  'check-status',
  'pull-model',
  'save-settings',
]

test('Ollama tutorial defines a complete six-step Windows flow', () => {
  assert.match(tutorialSource, /OLLAMA_DOWNLOAD_URL = 'https:\/\/ollama\.com\/download\/windows'/)
  assert.match(tutorialSource, /OLLAMA_RECOMMENDED_MODEL = 'gemma3:4b'/)

  for (const id of stepIds) {
    assert.match(tutorialSource, new RegExp(`id: '${id}'`))
  }

  assert.match(tutorialSource, /ดาวน์โหลด Ollama สำหรับ Windows/)
  assert.match(tutorialSource, /เปิดไฟล์ OllamaSetup\.exe/)
  assert.match(tutorialSource, /กลับมาเช็คสถานะใน Moxzk/)
  assert.match(tutorialSource, /โหลดโมเดล \$\{OLLAMA_RECOMMENDED_MODEL\} เข้า Ollama/)
  assert.doesNotMatch(tutorialSource, /capturedAt|sourceUrl/)
})

test('Ollama tutorial screenshot assets are real webp files with Thai alt text', () => {
  const imageMatches = [...tutorialSource.matchAll(/imageSrc: '([^']+\.webp)'[\s\S]*?imageAlt: '([^']+)'/g)]
  assert.equal(imageMatches.length, 6)

  for (const [, imageSrc, imageAlt] of imageMatches) {
    assert.ok(imageAlt.trim().length > 20, `${imageSrc} needs useful alt text`)
    assert.match(imageAlt, /สกรีนช็อต|ภาพตัวอย่าง/)

    const assetPath = path.join('public', imageSrc.replace(/^\/+/, ''))
    assert.ok(fs.existsSync(assetPath), `${assetPath} should exist`)
    const data = fs.readFileSync(assetPath)
    assert.ok(data.length > 1000, `${assetPath} should not be empty`)
    assert.equal(data.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(data.subarray(8, 12).toString('ascii'), 'WEBP')
  }
})

test('Ollama tutorial images match their steps instead of reusing the same docs screenshot', () => {
  for (const expectedImage of [
    'download.webp',
    'installer-file.webp',
    'ollama-running.webp',
    'moxzk-check-status.webp',
    'gemma-model.webp',
    'moxzk-save-settings.webp',
  ]) {
    assert.match(tutorialSource, new RegExp(`tutorial/ollama/${expectedImage}`))
  }

  assert.doesNotMatch(tutorialSource, /installer\.webp|windows-requirements\.webp|api-check\.webp|quickstart\.webp|moxzk-model\.webp/)
})

test('Ollama tutorial modal exposes next/back progress and contextual actions', () => {
  assert.match(modalSource, /ย้อนกลับ/)
  assert.match(modalSource, /ถัดไป/)
  assert.match(modalSource, /เสร็จแล้ว/)
  assert.match(modalSource, /ขั้นตอน \$\{stepIndex \+ 1\} จาก \$\{OLLAMA_TUTORIAL_STEPS\.length\}/)
  assert.match(modalSource, /เปิดหน้าโหลด Ollama/)
  assert.match(modalSource, /ตรวจสถานะ/)
  assert.match(modalSource, /เริ่ม Ollama/)
  assert.match(modalSource, /โหลด \{OLLAMA_RECOMMENDED_MODEL\} เข้า Ollama/)
  assert.match(modalSource, /บันทึกการตั้งค่า/)
  assert.match(modalSource, /layerClassName="relative z-\[240\]"/)
  assert.doesNotMatch(modalSource, /เปิดแหล่งข้อมูล|ภาพจากแหล่งข้อมูล|figcaption|sourceUrl|capturedAt/)
  assert.match(css, /\.OllamaTutorialModal/)
  assert.match(css, /\.OllamaTutorialProgress/)
})

test('first-run setup is a per-step wizard and persists outside AppSettings', () => {
  assert.match(onboardingStorage, /ONBOARDING_STORAGE_KEY = 'moxzk-onboarding-v1'/)
  assert.match(onboardingStorage, /firstRunCompleted: false/)
  assert.match(onboardingStorage, /ollamaTutorialSeen: false/)
  assert.match(onboardingStorage, /setupReminderSuppressed: false/)
  assert.match(onboardingStorage, /completedSetupItems: \[\]/)
  assert.match(onboardingStorage, /skippedSetupItems: \[\]/)
  assert.match(onboardingStorage, /currentSetupStep: 'python'/)
  assert.match(onboardingStorage, /type OnboardingSetupItem/)
  assert.match(onboardingStorage, /'python'/)
  assert.match(onboardingStorage, /skipOnboardingSetupItem/)
  assert.match(onboardingStorage, /normalizeCurrentSetupStep/)
  assert.match(onboardingStorage, /normalizeSkippedSetupItems/)
  assert.match(onboardingStorage, /function completeFirstRunSetup/)
  assert.match(onboardingStorage, /function markOllamaTutorialSeen/)
  assert.match(onboardingStorage, /setupReminderSuppressed: suppressReminder/)
  assert.match(onboardingStorage, /normalizeCompletedSetupItems/)
  assert.doesNotMatch(fs.readFileSync('src/types/index.ts', 'utf8'), /firstRunCompleted|ollamaTutorialSeen/)

  assert.match(firstRunSource, /setupSteps/)
  assert.match(firstRunSource, /activeStep/)
  assert.match(firstRunSource, /currentStepIndex/)
  assert.match(firstRunSource, /canGoNext/)
  assert.match(firstRunSource, /showIntro/)
  assert.match(firstRunSource, /ตั้งค่า Moxzk ให้พร้อมใช้งาน/)
  assert.match(firstRunSource, /SETUP_ICON_SRC/)
  assert.match(firstRunSource, /setup-icons\/python\.svg/)
  assert.match(firstRunSource, /setup-icons\/ollama\.svg/)
  assert.match(firstRunSource, /<img className="FirstRunSetupIcon"/)
  assert.match(firstRunSource, /ถัดไป/)
  assert.match(firstRunSource, /Skip/)
  assert.match(firstRunSource, /visiblePageNumber/)
  assert.match(firstRunSource, /FirstRunSetupUtilityCheck-\$\{activeStatus\}/)
  assert.match(firstRunSource, /primaryAction/)
  assert.match(firstRunSource, /utilityActions/)
  assert.match(firstRunSource, /showPrimaryAction/)
  assert.match(firstRunSource, /activeStatus !== 'ready'/)
  assert.match(firstRunSource, /FirstRunSetupReadyPanel/)
  assert.match(firstRunSource, /FirstRunSetupHeroAction/)
  assert.match(firstRunSource, /SETUP_MODEL_OPTIONS/)
  assert.match(firstRunSource, /gemma3:12b/)
  assert.match(firstRunSource, /llama3\.2-vision:11b/)
  assert.match(firstRunSource, /function resolveSetupModelName\(model: string\)/)
  assert.match(firstRunSource, /return trimmed \|\| OLLAMA_RECOMMENDED_MODEL/)
  assert.match(firstRunSource, /SETUP_MODEL_AUTOCOMPLETE_NAMES/)
  assert.match(firstRunSource, /qwen3\.5:cloud/)
  assert.match(firstRunSource, /function getModelSearchSuggestions/)
  assert.match(firstRunSource, /role="listbox"/)
  assert.match(firstRunSource, /role="option"/)
  assert.match(firstRunSource, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.match(firstRunSource, /modelSearchInput/)
  assert.match(firstRunSource, /debouncedModelSearch/)
  assert.match(firstRunSource, /debouncedSelectedModelName/)
  assert.match(firstRunSource, /setModelSearchPending\(true\)/)
  assert.match(firstRunSource, /window\.setTimeout\(\(\) => \{/)
  assert.match(firstRunSource, /}, 350\)/)
  assert.match(firstRunSource, /Search หรือใส่ชื่อโมเดลเอง/)
  assert.match(firstRunSource, /placeholder="เช่น gemma3:4b หรือ llama3\.2-vision:11b"/)
  assert.match(firstRunSource, /selectedModelName/)
  assert.match(firstRunSource, /modelPullProgress/)
  assert.match(firstRunSource, /SOURCE_LANGUAGE_OPTIONS/)
  assert.match(firstRunSource, /TRANSLATION_MODE_OPTIONS/)
  assert.match(firstRunSource, /onUpdateSettings/)
  assert.match(firstRunSource, /สมัครสมาชิก \/ เข้าสู่ระบบ/)
  assert.match(firstRunSource, /FirstRunSetupAccountPreview/)
  assert.match(firstRunSource, /โปรแกรม Python/)
  assert.match(firstRunSource, /ติดตั้ง Python/)
  assert.doesNotMatch(firstRunSource, /ติดตั้ง Python ให้/)
  assert.match(firstRunSource, /โปรแกรม Ollama/)
  assert.match(firstRunSource, /ตัวช่วยลบข้อความ/)
  assert.match(firstRunSource, /โหลดโมเดล/)
  assert.match(firstRunSource, /ภาษาและโหมดแปล/)
  assert.match(firstRunSource, /บัญชีและอัลบั้ม/)
  assert.match(firstRunSource, /งานร่างและไฟล์ในเครื่อง/)
  assert.doesNotMatch(firstRunSource, /coreItems|recommendedItems|ทำเครื่องหมายว่าเสร็จ|ข้ามตอนนี้|ตั้งค่าทีหลัง/)
  assert.match(appSource, /loadOnboardingState/)
  assert.match(appSource, /if \(!onboarding\.firstRunCompleted\) setFirstRunSetupOpen\(true\)/)
  assert.match(appSource, /skipOnboardingSetupItem/)
  assert.match(appSource, /getFirstSetupStepToReview/)
  assert.match(appSource, /REQUIRED_FIRST_RUN_STEPS/)
  assert.match(appSource, /REQUIRED_FIRST_RUN_STEPS\.find\(\(item\) => skipped\.has\(item\) \|\| !completed\.has\(item\)\) \?\? REQUIRED_FIRST_RUN_STEPS\[0\]/)
  assert.match(appSource, /completeFirstRunSetup\(current, \{ suppressReminder/)
  assert.match(appSource, /markOllamaTutorialSeen\(current\)/)
  assert.match(css, /\.FirstRunSetupShell/)
  assert.match(css, /\.FirstRunSetupFocusedPage/)
  assert.match(css, /\.FirstRunSetupTopSkip/)
  assert.match(css, /\.FirstRunSetupIntroSkip/)
  assert.match(css, /\.FirstRunSetupUtilityCheck-ready/)
  assert.match(css, /\.FirstRunSetupUtilityCheck-missing/)
  assert.match(css, /\.FirstRunSetupUtilityCheck-skipped/)
  assert.match(css, /\.FirstRunSetupFooter\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto\s*minmax\(0,\s*1fr\)/s)
  assert.match(css, /\.FirstRunSetupBackAction\s*\{[^}]*border:\s*0/s)
  assert.match(css, /\.FirstRunSetupReadyPanel/)
  assert.match(css, /\.FirstRunSetupModelSearch/)
  assert.match(css, /\.FirstRunSetupModelSearchBox/)
  assert.match(css, /\.FirstRunSetupModelSuggestions/)
  assert.match(css, /\.FirstRunSetupModelSearchReady/)
  assert.match(css, /\.FirstRunSetupModelProgress/)
  assert.match(css, /\.FirstRunSetupTranslationExtras/)
  assert.match(css, /\.FirstRunSetupAccountPreview/)
  assert.match(css, /\.FirstRunSetupStepPage-account\s*\{[^}]*grid-template-columns:/s)
  assert.match(css, /\.FirstRunSetupAccountPreview\s*\{[^}]*position:\s*relative/s)
  assert.doesNotMatch(css, /\.FirstRunSetupIcon\s*\{[^}]*background:/s)
  assert.doesNotMatch(css, /\.FirstRunSetupIcon\s*\{[^}]*border:/s)
  for (const fileName of setupIconFiles) {
    const iconPath = `public/setup-icons/${fileName}`
    assert.equal(fs.existsSync(iconPath), true, `${iconPath} should exist`)
    assert.match(fs.readFileSync(iconPath, 'utf8'), /<svg[\s>]/)
  }
})

test('tutorial copy avoids developer-facing storage and infrastructure terms', () => {
  const visibleSources = [tutorialSource, modalSource, firstRunSource].join('\n')
  for (const forbidden of ['R2', 'D1', 'metadata', 'Worker', 'object key', 'token hash', 'session internals']) {
    assert.doesNotMatch(visibleSources, new RegExp(`\\b${forbidden}\\b`, 'i'))
  }
})
