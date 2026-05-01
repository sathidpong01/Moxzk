import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('worker password parser accepts eight characters as the backend minimum', () => {
  const source = fs.readFileSync('src/worker/http.ts', 'utf8')

  assert.match(source, /value\.length >= 8/)
  assert.doesNotMatch(source, /value\.length >= 10/)
})

test('cloudflare api exposes typed auth error metadata for auth UX', () => {
  const source = fs.readFileSync('src/services/cloudflareApi.ts', 'utf8')

  assert.match(source, /retryAfterSec/)
  assert.match(source, /lockoutUntil/)
  assert.match(source, /requiresChallenge/)
  assert.match(source, /Retry-After/)
})

test('auth store keeps auth failures available for inline rendering', () => {
  const source = fs.readFileSync('src/store/authStore.ts', 'utf8')

  assert.match(source, /interface AuthUiError/)
  assert.match(source, /authError: AuthUiError \| null/)
  assert.match(source, /toAuthUiError/)
  assert.match(source, /clearAuthError/)
})
