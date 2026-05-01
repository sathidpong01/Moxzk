import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from './db/schema'

export type Db = DrizzleD1Database<typeof schema>

export interface RequestContext {
  request: Request
  env: Env
  db: Db
  url: URL
}

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ACCOUNT_LOCKED'
  | 'CHALLENGE_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'FEATURE_DISABLED'
  | 'CONFIGURATION_ERROR'
  | 'SERVER_ERROR'

export interface AuthUser {
  id: string
  email: string
  emailNormalized: string
  username: string | null
  avatarUrl: string | null
  plan: 'free' | 'pro' | 'team'
}
