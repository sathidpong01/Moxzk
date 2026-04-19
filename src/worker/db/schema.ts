import { relations, sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const plans = ['free', 'pro', 'team'] as const
export const identityProviders = ['password', 'google'] as const
export const emailTokenTypes = ['verify_email', 'reset_password'] as const
export const pageStatuses = ['pending', 'processing', 'clean_done', 'translated', 'error'] as const
export const processingModes = ['full', 'clean_only'] as const
export const objectKinds = ['original', 'cleaned', 'thumbnail', 'cover'] as const

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  emailNormalized: text('email_normalized').notNull(),
  emailVerifiedAt: integer('email_verified_at'),
  username: text('username'),
  avatarUrl: text('avatar_url'),
  plan: text('plan', { enum: plans }).notNull().default('free'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  uniqueIndex('users_email_normalized_uniq').on(table.emailNormalized),
  uniqueIndex('users_username_uniq').on(table.username),
  check('users_plan_check', sql`${table.plan} in ('free', 'pro', 'team')`),
])

export const authIdentities = sqliteTable('auth_identities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: identityProviders }).notNull(),
  providerSubject: text('provider_subject').notNull(),
  email: text('email').notNull(),
  emailNormalized: text('email_normalized').notNull(),
  credentialHash: text('credential_hash'),
  credentialSalt: text('credential_salt'),
  credentialAlgo: text('credential_algo'),
  credentialParamsJson: text('credential_params_json'),
  providerProfileJson: text('provider_profile_json'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  uniqueIndex('auth_identities_provider_subject_uniq').on(table.provider, table.providerSubject),
  index('auth_identities_user_idx').on(table.userId),
  index('auth_identities_email_normalized_idx').on(table.emailNormalized),
  check('auth_identities_provider_check', sql`${table.provider} in ('password', 'google')`),
])

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  uniqueIndex('sessions_token_hash_uniq').on(table.tokenHash),
  index('sessions_user_idx').on(table.userId),
  index('sessions_expires_at_idx').on(table.expiresAt),
])

export const emailTokens = sqliteTable('email_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: emailTokenTypes }).notNull(),
  tokenHash: text('token_hash').notNull(),
  emailNormalized: text('email_normalized').notNull(),
  expiresAt: integer('expires_at').notNull(),
  consumedAt: integer('consumed_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  uniqueIndex('email_tokens_token_hash_uniq').on(table.tokenHash),
  index('email_tokens_user_type_idx').on(table.userId, table.type),
  index('email_tokens_expires_at_idx').on(table.expiresAt),
  check('email_tokens_type_check', sql`${table.type} in ('verify_email', 'reset_password')`),
])

export const oauthStates = sqliteTable('oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  provider: text('provider', { enum: ['google'] }).notNull(),
  redirectTarget: text('redirect_target').notNull(),
  nonceHash: text('nonce_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  index('oauth_states_expires_at_idx').on(table.expiresAt),
  check('oauth_states_provider_check', sql`${table.provider} = 'google'`),
])

export const albums = sqliteTable('albums', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  coverKey: text('cover_key'),
  sourceLang: text('source_lang').notNull().default('ja'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  index('albums_user_updated_idx').on(table.userId, table.updatedAt),
])

export const albumPages = sqliteTable('album_pages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  albumId: text('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  originalKey: text('original_key'),
  cleanedKey: text('cleaned_key'),
  thumbnailKey: text('thumbnail_key'),
  artboardX: integer('artboard_x'),
  artboardY: integer('artboard_y'),
  regionsJson: text('regions_json').notNull().default('[]'),
  brushStrokesJson: text('brush_strokes_json').notNull().default('[]'),
  status: text('status', { enum: pageStatuses }).notNull().default('pending'),
  processingMode: text('processing_mode', { enum: processingModes }).notNull().default('full'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  uniqueIndex('album_pages_album_page_number_uniq').on(table.albumId, table.pageNumber),
  index('album_pages_album_page_number_idx').on(table.albumId, table.pageNumber),
  index('album_pages_status_idx').on(table.status),
  check('album_pages_status_check', sql`${table.status} in ('pending', 'processing', 'clean_done', 'translated', 'error')`),
  check('album_pages_processing_mode_check', sql`${table.processingMode} in ('full', 'clean_only')`),
  check('album_pages_regions_json_valid', sql`json_valid(${table.regionsJson})`),
  check('album_pages_brush_strokes_json_valid', sql`json_valid(${table.brushStrokesJson})`),
])

export const objects = sqliteTable('objects', {
  key: text('key').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  albumId: text('album_id').references(() => albums.id, { onDelete: 'cascade' }),
  pageId: text('page_id').references(() => albumPages.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: objectKinds }).notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  index('objects_user_idx').on(table.userId),
  index('objects_album_idx').on(table.albumId),
  index('objects_page_idx').on(table.pageId),
  index('objects_user_hash_idx').on(table.userId, table.sha256),
  check('objects_kind_check', sql`${table.kind} in ('original', 'cleaned', 'thumbnail', 'cover')`),
])

export const usersRelations = relations(users, ({ many }) => ({
  identities: many(authIdentities),
  sessions: many(sessions),
  emailTokens: many(emailTokens),
  albums: many(albums),
  objects: many(objects),
}))

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, { fields: [authIdentities.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const emailTokensRelations = relations(emailTokens, ({ one }) => ({
  user: one(users, { fields: [emailTokens.userId], references: [users.id] }),
}))

export const albumsRelations = relations(albums, ({ one, many }) => ({
  user: one(users, { fields: [albums.userId], references: [users.id] }),
  pages: many(albumPages),
  objects: many(objects),
}))

export const albumPagesRelations = relations(albumPages, ({ one, many }) => ({
  album: one(albums, { fields: [albumPages.albumId], references: [albums.id] }),
  objects: many(objects),
}))

export const objectsRelations = relations(objects, ({ one }) => ({
  user: one(users, { fields: [objects.userId], references: [users.id] }),
  album: one(albums, { fields: [objects.albumId], references: [albums.id] }),
  page: one(albumPages, { fields: [objects.pageId], references: [albumPages.id] }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AuthIdentity = typeof authIdentities.$inferSelect
export type NewAuthIdentity = typeof authIdentities.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type EmailToken = typeof emailTokens.$inferSelect
export type NewEmailToken = typeof emailTokens.$inferInsert
export type OAuthState = typeof oauthStates.$inferSelect
export type NewOAuthState = typeof oauthStates.$inferInsert
export type Album = typeof albums.$inferSelect
export type NewAlbum = typeof albums.$inferInsert
export type AlbumPage = typeof albumPages.$inferSelect
export type NewAlbumPage = typeof albumPages.$inferInsert
export type StoredObject = typeof objects.$inferSelect
export type NewStoredObject = typeof objects.$inferInsert
