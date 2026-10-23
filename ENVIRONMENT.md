# Environment Variables

Copy `.env.example` to `.env` for local development. In production/staging, inject variables through an encrypted environment/secret manager; do not mount or log secret values unnecessarily, commit `.env`, or prefix server secrets with `NEXT_PUBLIC_`. Variable names are case-sensitive.

| Variable | Required/when | Description |
|---|---|---|
| `NODE_ENV` | Runtime; set `production` in deployed app/release job | `development`, `test`, or `production`; Prisma CLI selects migration URL in production mode. |
| `DATABASE_URL` | Required | PostgreSQL URL for the web process. Runtime user should have only required DML/sequence privileges. Use provider TLS (`sslmode=require` at minimum; use stronger certificate verification where supported). |
| `MIGRATION_DATABASE_URL` | Required only in production-mode Prisma deploy/seed/operator commands | Separate privileged schema-owner URL for controlled migrations; do not provide it to the long-lived app. Production `prisma.config.ts` fails closed without it. |
| `SHADOW_DATABASE_URL` | Local `migrate dev` only | Disposable Prisma shadow DB; never production. |
| `TEST_DATABASE_URL` | Integration tests | Isolated disposable PostgreSQL database with name ending in `_test`; test runner enforces this suffix. |
| `DATABASE_POOL_MAX` | Optional; default 5 | Maximum `pg.Pool` connections per Node process/instance. Multiply by all replicas and reserve DB headroom. Range 1–100. |
| `DATABASE_IDLE_TIMEOUT_MS` | Optional; default 10000 | Idle pool connection timeout in milliseconds; range 1000–300000. |
| `DATABASE_CONNECTION_TIMEOUT_MS` | Optional; default 5000 | Pool connection acquisition timeout in milliseconds; range 500–60000. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | Optional; default 30000 | PostgreSQL statement timeout in milliseconds; range 1000–300000. |
| `BETTER_AUTH_SECRET` | Required | Unique random secret, minimum 32 bytes, not a sample phrase. Generate e.g. `openssl rand -base64 48`. Production rejects obvious placeholders/repetition. Rotation may revoke sessions. |
| `BETTER_AUTH_URL` | Required | Canonical auth/application origin; production must use HTTPS. Drives secure cookies/HSTS configuration. |
| `ADDITIONAL_TRUSTED_ORIGINS` | Optional | Comma-separated exact trusted origin allowlist; no wildcards, paths or arbitrary clients. |
| `PUBLIC_SITE_URL` | Production recommended|required for public SEO readiness | Canonical public origin used for sitemap/canonical/social URLs; production must be HTTPS and should match the public domain. |
| `RESEND_API_KEY` | Production required for password-reset email | Resend server API secret; keep server-side only. Without it, production password-reset send fails rather than exposing reset links. |
| `EMAIL_FROM` | Required for production email | Verified sender identity, e.g. `দৈনিক আজকের দিগন্ত <accounts@news.example>`; domain must be verified with the provider. |
| `EMAIL_NOTIFICATIONS_ENABLED` | Optional; defaults off unless the literal value is `true` | When enabled, notification events create deduplicated email-outbox records. **This MVP has no delivery worker**, so this does not send email; leave disabled until a monitored sender is implemented. Password-reset email through Resend is separate. |
| `R2_ENDPOINT` | Required to enable media upload | Private S3 API endpoint, normally `https://<account-id>.r2.cloudflarestorage.com`. HTTPS only. |
| `R2_BUCKET` | Required with R2 | Private bucket name used by the app's S3-compatible storage adapter. |
| `R2_ACCESS_KEY_ID` | Required with R2 | Server-side R2 token access key; least-privilege scope. |
| `R2_SECRET_ACCESS_KEY` | Required with R2 | Server-side secret key; never client-visible. |
| `R2_PUBLIC_BASE_URL` | Recommended for public verified media | HTTPS custom/CDN hostname from which verified objects are served. Do not expose quarantine. |
| `MEDIA_MAX_BYTES` | Optional; default 10485760 | Maximum incoming raster file bytes; currently bounded 1 KiB–50 MiB. Set edge/proxy body limits to match or be slightly above the app setting. |
| `JOB_AUTH_SECRET` | Required to enable scheduled article publisher | Unique random bearer secret of 32+ bytes for the trusted scheduler; not used by browser clients. Without it, publisher route returns 503. |

### Sample local-only value generation

```sh
openssl rand -base64 48
```

Do not copy production credentials into `.env.example`. Empty R2 values intentionally leave media upload unavailable/fail-closed. Development reset links may be logged locally for testing; never configure development mode in production. `EMAIL_NOTIFICATIONS_ENABLED=true` only queues the email outbox; it does not start a sender or confirm delivery.
