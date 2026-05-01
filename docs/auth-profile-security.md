# Auth Profile Security

Moxzk now has a first-pass `ProfileDialog` opened from the avatar menu. It is backed by authenticated Worker APIs for profile data, linked login methods, session visibility, password changes, session revocation, usage summaries, and account deletion.

## Worker Surfaces

- `GET /api/profile`: returns the current public user, linked `password` / `google` identities, active sessions, and usage summary.
- `PATCH /api/profile`: updates `username` and `avatarUrl`.
- `POST /api/auth/password/change`: changes an existing password or sets the first password for a Google-only account.
- `POST /api/auth/sessions/revoke`: revokes one session, other sessions, or all sessions.
- `DELETE /api/account`: deletes the account after typed confirmation and removes owned R2 objects before deleting the user row.

## Adaptive Login Protection

The Worker records hashed authentication metadata in `auth_attempts`. The table stores action, `subject_hash`, `ip_hash`, `user_agent_hash`, success, error code, and timestamp. It does not store passwords, raw emails, raw IP addresses, session tokens, or Google tokens.

Protected actions:

- `register`
- `login`
- `google_start`
- `google_desktop_start`
- `google_desktop_claim`

The Worker can return:

- `RATE_LIMITED` with `retryAfterSec`
- `ACCOUNT_LOCKED` with `lockoutUntil`
- `CHALLENGE_REQUIRED` when Turnstile is configured and a high-risk threshold is reached

`security_events` stores coarse audit events for rate limits, lockouts, challenge requirements, profile updates, password changes, session revocations, and account deletion.

## Cloudflare Edge Responsibilities

Application code limits brute force and credential-stuffing style bypass attempts, but volumetric DDoS belongs at the Cloudflare edge.

Recommended Cloudflare WAF / rate-limit rules:

- Apply a stricter rate-limit rule to `/api/auth/login`, `/api/auth/register`, `/api/auth/google/start`, `/api/auth/google/desktop/start`, and `/api/auth/google/desktop/claim`.
- Challenge suspicious countries, anonymous proxies, or high bot-score traffic before it reaches the Worker.
- Keep Turnstile optional for normal users and adaptive for suspicious auth attempts.
- Do not rely on D1 writes alone for DDoS mitigation; edge rate-limit rules should absorb floods before Worker execution.

## Turnstile

Turnstile verification activates only when `TURNSTILE_SECRET_KEY` is configured in the Worker environment. Without that secret, login protection still uses rate limit and account lockout behavior, and the UI does not require a challenge token.
