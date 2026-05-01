import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('auth modal resets signup state when opened again', () => {
  const source = fs.readFileSync('src/components/Auth/AuthModal.tsx', 'utf8')

  assert.match(source, /useEffect\(\(\) => \{/)
  assert.match(source, /if \(!showAuthModal\) return/)
  assert.match(source, /setMode\('login'\)/)
  assert.match(source, /setEmail\(''\)/)
  assert.match(source, /setPassword\(''\)/)
  assert.match(source, /setUsername\(''\)/)
  assert.match(source, /\}, \[showAuthModal/)
})

test('auth modal exposes login signup and recovery flows without nested tab chrome', () => {
  const source = fs.readFileSync('src/components/Auth/AuthModal.tsx', 'utf8')
  const css = fs.readFileSync('src/index.css', 'utf8')

  assert.match(source, /type AuthMode = 'login' \| 'signup' \| 'recovery'/)
  assert.match(source, /เข้าสู่ระบบ/)
  assert.match(source, /สมัครสมาชิก/)
  assert.match(source, /กู้บัญชี/)
  assert.match(source, /AuthModeSwitch/)
  assert.match(source, /ลืมรหัสผ่าน\?/)
  assert.doesNotMatch(source, /AuthSegmentedControl|AuthModalSegment|<Tabs/)
  assert.match(css, /\.AuthModal\s*\{/)
  assert.match(css, /width: min\(28\.25rem, calc\(100vw - 2rem\)\)/)
  assert.match(css, /\.AuthSocialButton/)
  assert.match(css, /\.AuthInput/)
  assert.match(css, /@keyframes authPanelIn/)
})

test('auth modal uses the eight character letter and number password checklist', () => {
  const source = fs.readFileSync('src/components/Auth/AuthModal.tsx', 'utf8')

  assert.match(source, /password\.length >= 8/)
  assert.match(source, /hasLetter: \/\[A-Za-z\]\//)
  assert.match(source, /hasNumber: \/\\d\//)
  assert.match(source, /ขั้นต่ำ 8 ตัว/)
  assert.match(source, /มีตัวอักษร/)
  assert.match(source, /มีตัวเลข/)
  assert.doesNotMatch(source, /special character|อักขระพิเศษ|สัญลักษณ์พิเศษ/i)
})

test('auth modal maps duplicate register email and keeps login generic', () => {
  const source = fs.readFileSync('src/components/Auth/AuthModal.tsx', 'utf8')

  assert.match(source, /mode === 'signup' && error\.code === 'CONFLICT'/)
  assert.match(source, /อีเมลนี้ถูกใช้แล้ว/)
  assert.match(source, /action: 'switch-login'/)
  assert.match(source, /อีเมลหรือรหัสผ่านไม่ถูกต้อง/)
})

test('auth modal supports rate limit countdown google pending and caps lock states', () => {
  const source = fs.readFileSync('src/components/Auth/AuthModal.tsx', 'utf8')

  assert.match(source, /RATE_LIMITED/)
  assert.match(source, /ACCOUNT_LOCKED/)
  assert.match(source, /ลองใหม่ได้ใน \$\{remainingSec\} วินาที/)
  assert.match(source, /googlePending/)
  assert.match(source, /รอการยืนยันจากเบราว์เซอร์/)
  assert.match(source, /Caps Lock เปิดอยู่/)
  assert.match(source, /getModifierState\('CapsLock'\)/)
})
