const encoder = new TextEncoder()
const PASSWORD_PARAMS = { version: 1, iterations: 100_000, hash: 'SHA-256', length: 32 }

export function passwordParamsJson(): string {
  return JSON.stringify(PASSWORD_PARAMS)
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = base64UrlEncode(saltBytes)
  const hash = await derivePasswordHash(password, salt)
  return { hash, salt }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const actualHash = await derivePasswordHash(password, salt)
  return constantTimeEqual(base64UrlDecode(actualHash), base64UrlDecode(expectedHash))
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return base64UrlEncode(new Uint8Array(digest))
}

export async function optionalHash(value: string | null): Promise<string | null> {
  return value ? hashToken(value) : null
}

export function randomToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

export function base64UrlDecodeToString(value: string): string {
  return new TextDecoder().decode(base64UrlDecode(value))
}

async function derivePasswordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: PASSWORD_PARAMS.hash,
    salt: base64UrlDecode(salt),
    iterations: PASSWORD_PARAMS.iterations,
  }, key, PASSWORD_PARAMS.length * 8)
  return base64UrlEncode(new Uint8Array(bits))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
