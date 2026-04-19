import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const drizzleDir = new URL('../drizzle/', import.meta.url)
const migration = readdirSync(drizzleDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, drizzleDir), 'utf8'))
  .join('\n')

const has = (needle) => migration.includes(needle)

test('D1 migration creates the required application tables', () => {
  for (const table of [
    'users',
    'auth_identities',
    'sessions',
    'email_tokens',
    'oauth_states',
    'albums',
    'album_pages',
    'objects',
  ]) {
    assert.ok(has(`CREATE TABLE \`${table}\``), `missing table: ${table}`)
  }
})

test('D1 migration keeps auth uniqueness and enum constraints explicit', () => {
  assert.ok(has('CREATE UNIQUE INDEX `users_email_normalized_uniq`'), 'users.email_normalized must be unique')
  assert.ok(has('CREATE UNIQUE INDEX `users_username_uniq`'), 'users.username must be unique')
  assert.ok(has('CONSTRAINT "users_plan_check" CHECK("users"."plan" in'), 'users.plan must be checked')
  assert.ok(
    has('CREATE UNIQUE INDEX `auth_identities_provider_subject_uniq` ON `auth_identities` (`provider`,`provider_subject`)'),
    'auth identity provider subject must be unique',
  )
  assert.ok(
    has('CONSTRAINT "auth_identities_provider_check" CHECK("auth_identities"."provider" in'),
    'auth identity provider must be checked',
  )
  assert.ok(has('CREATE UNIQUE INDEX `sessions_token_hash_uniq`'), 'session token hash must be unique')
  assert.ok(has('CREATE UNIQUE INDEX `email_tokens_token_hash_uniq`'), 'email token hash must be unique')
  assert.ok(
    has('CONSTRAINT "oauth_states_provider_check" CHECK("oauth_states"."provider" = \'google\')'),
    'oauth state provider must be google only in v1',
  )
})

test('D1 migration keeps album/page/object constraints explicit', () => {
  assert.ok(
    has('CREATE UNIQUE INDEX `album_pages_album_page_number_uniq` ON `album_pages` (`album_id`,`page_number`)'),
    'page number must be unique within each album',
  )
  assert.ok(
    has('CONSTRAINT "album_pages_status_check" CHECK("album_pages"."status" in'),
    'album page status must be checked',
  )
  assert.ok(
    has('CONSTRAINT "album_pages_processing_mode_check" CHECK("album_pages"."processing_mode" in'),
    'album page processing mode must be checked',
  )
  assert.ok(
    has('CONSTRAINT "album_pages_regions_json_valid" CHECK(json_valid("album_pages"."regions_json"))'),
    'regions_json must be valid JSON text',
  )
  assert.ok(
    has('CONSTRAINT "album_pages_brush_strokes_json_valid" CHECK(json_valid("album_pages"."brush_strokes_json"))'),
    'brush_strokes_json must be valid JSON text',
  )
  assert.ok(has('`artboard_x` integer'), 'artboard x position must be persisted')
  assert.ok(has('`artboard_y` integer'), 'artboard y position must be persisted')
  assert.ok(has('CONSTRAINT "objects_kind_check" CHECK("objects"."kind" in'), 'object kind must be checked')
  assert.ok(has('CREATE INDEX `objects_user_idx`'), 'objects must be queryable by user')
  assert.ok(has('CREATE INDEX `objects_album_idx`'), 'objects must be queryable by album')
  assert.ok(has('CREATE INDEX `objects_page_idx`'), 'objects must be queryable by page')
  assert.ok(has('`sha256` text'), 'objects must persist content hashes for upload dedupe')
  assert.ok(has('CREATE INDEX `objects_user_hash_idx`'), 'object hashes must be queryable per user')
})

test('D1 migration uses hard references instead of soft-delete scaffolding', () => {
  assert.equal(/\bdeleted_at\b/i.test(migration), false, 'hard delete design should not include deleted_at')
  assert.equal(/\barchived_at\b/i.test(migration), false, 'hard delete design should not include archived_at')
  assert.equal(/\bboolean\b/i.test(migration), false, 'D1 schema should avoid non-native boolean columns')
})
