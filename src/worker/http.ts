import type { ApiErrorCode, RequestContext } from './types'

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function jsonError(code: ApiErrorCode, message: string, status: number, details?: unknown): Response {
  return json({ error: { code, message, details } }, status)
}

export class ApiError extends Error {
  response: Response

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.response = jsonError(code, message, status, details)
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json<T>()
  } catch {
    throw new ApiError('BAD_REQUEST', 'Request body must be valid JSON', 400)
  }
}

export function withCors(ctx: RequestContext, response: Response): Response {
  const origin = ctx.request.headers.get('Origin')
  const allowedOrigins = parseCsv(ctx.env.ALLOWED_ORIGINS)
  const headers = new Headers(response.headers)

  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set('Access-Control-Allow-Credentials', 'true')
  }

  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export function parseCsv(value: string | undefined): string[] {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

export function requiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function parseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function parsePassword(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 10 ? value : null
}

export function stringifyJsonInput(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') {
    JSON.parse(value)
    return value
  }
  return JSON.stringify(value)
}
