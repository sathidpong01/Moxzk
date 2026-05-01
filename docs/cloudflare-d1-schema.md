# Cloudflare D1 Schema

This project uses Drizzle as the source of truth for the Cloudflare D1 schema.

- Drizzle schema: `src/worker/db/schema.ts`
- Generated migrations: `drizzle/`
- Worker API entry: `src/worker/index.ts`
- Wrangler config: `wrangler.jsonc`

## Resources

- Worker: `moxzk-api`
- D1 database: `moxzk-db`
- R2 bucket: `moxzk-images`

The active D1 `database_id` is committed in `wrangler.jsonc` after selecting the remote `moxzk-db`.

## Auth Model

Users are stored in `users`. Login methods are stored in `auth_identities` so one public user can have both password and Google identities.

- Password identities use `provider = 'password'` and `provider_subject = email_normalized`.
- Google identities use `provider = 'google'` and `provider_subject = Google sub`.
- Google account linking is by verified Google email only.
- Password hashes use Web Crypto PBKDF2 SHA-256 with per-identity salt and `100000` iterations, which is the Cloudflare Workers runtime limit.
- Session cookies are HttpOnly, Secure, SameSite=Lax.
- Auth abuse protection stores only hashed attempt metadata in `auth_attempts` and coarse audit rows in `security_events`.
- Email/password registration marks the email as verified immediately.
- Email verification and email-based password reset are disabled in the current app build, so Resend is not required.
- Profile/account management is documented in `docs/auth-profile-security.md`.

## Storage Model

R2 objects are not trusted by path alone. Every R2 object must have an `objects` row before download or delete.

R2 key format:

```text
users/{userId}/albums/{albumId}/{pageNumber}_{kind}.webp
```

Allowed object kinds are `original`, `cleaned`, `thumbnail`, and `cover`.

## Album Model

Albums and pages use hard delete only.

- Deleting a user cascades metadata for identities, sessions, albums, pages, and object rows.
- Deleting an album first deletes owned R2 objects, then D1 metadata.
- Deleting a page first deletes owned R2 objects, then D1 metadata.
- Page edit payloads are JSON TEXT columns with `json_valid(...)` checks.

## Migration Workflow

Generate and inspect SQL:

```bash
npm run db:generate
```

Apply locally:

```bash
npm run db:migrate:local
```

Apply remotely after Cloudflare login and real resource IDs are configured:

```bash
npm run db:migrate:remote
```

Dry-run Worker deployment:

```bash
npm run worker:check
```

Local frontend development expects the Worker API on port `8787` because Vite proxies `/api` to Wrangler dev:

```bash
npx wrangler dev --local --port 8787
npm run dev
```

Local Wrangler secrets are read from `.dev.vars`, which is intentionally gitignored. Required local keys:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Required Worker secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Allowed OAuth redirects are configured with `OAUTH_REDIRECT_ALLOWLIST` in `wrangler.jsonc`.
