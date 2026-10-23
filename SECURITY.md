# Security Operations — দৈনিক আজকের দিগন্ত

## Security posture and limitations

Security decisions are enforced on the server and APIs, not by hidden UI controls. Read [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for findings, evidence and automated retests. This engineering review is not a penetration test, compliance certification, or guarantee of security.

## Authentication and authorization

Better Auth uses Argon2id password hashing, secure production cookies when the canonical auth URL is HTTPS, session expiry/revocation, database-backed rate limits and trusted origins. Cookies are HttpOnly and SameSite=Lax; production requires HTTPS. Admin, Reporter and Editor access is separate from the reader login at `/cms-access`, but all roles share the same verified underlying session model and require an assigned database role/permission.

Use least privilege. A trusted operator promotes an eligible verified account to ADMIN with `pnpm admin:promote EMAIL --confirm EMAIL`; create/assign editorial roles through a separately reviewed, audited operator process. No default credentials are shipped. Never create public role-promotion endpoints or seed production default passwords.

## Request, content and media controls

API input uses strict Zod validation and bounded streaming parsers. Raw SQL values are parameterized. Editorial rich text and metadata are sanitized/encoded before public output; search uses PostgreSQL. Mutations verify Origin and role/ownership server-side. Private user data and all APIs must be `no-store`.

Media upload requires `media.upload`, trusted Origin, per-user rate limit, a server-created intent, matching MIME and actual byte length under `MEDIA_MAX_BYTES`, and a single-use state transition. The server writes into private quarantine; Sharp decodes raster data with a pixel ceiling, resizes and re-encodes WebP before an object is marked public. SVG and arbitrary remote images are rejected. R2 receives server-side PutObject; no browser presigned POST or storage credentials are exposed. Keep R2 tokens narrowly scoped and quarantine inaccessible via public domain.

## Transport, edge, and headers

Terminate TLS at a trusted reverse proxy/CDN, redirect HTTP to HTTPS, and set the provider's strict TLS mode. HSTS is enabled in app production config only when `BETTER_AUTH_URL` is HTTPS. The app sends `nosniff`, frame denial, referrer and permissions policies; API routes send no-store. **CSP is not configured** because it requires a nonce/Next.js and YouTube/media compatibility test; add report-only CSP with real origin inventories, then enforce after monitoring.

Better Auth consumes `x-real-ip`; this is only safe when the trusted ingress strips any client-supplied `x-real-ip` and writes the actual client address. Limit origin firewall access to the proxy/provider. If Cloudflare is used, accept IP headers only from Cloudflare ingress addresses and overwrite the header at the final trusted proxy; do not trust arbitrary `X-Forwarded-For` chains.

## Secrets and information handling

- Keep `.env`, credentials, database dumps, mail reset links, session cookies and uploaded originals out of Git, logs, issue trackers and chat.
- Rotate `BETTER_AUTH_SECRET`, database/R2/Resend keys and job secret through the secret manager with an incident record. Rotation of the auth secret may invalidate sessions; schedule appropriately.
- `instrumentation.ts` logs structured route/method and safe error identifiers only. It deliberately omits query strings, headers, request bodies, raw messages and user IDs. Route logs to access-controlled retention and alerting.
- Health endpoint discloses only `ok`/`unavailable`; do not extend it with env values, raw DB errors, versions or identifiers.

## Production controls still to validate

1. Production app role lacks DDL/superuser permissions; migration role is separate and used only by the gated release job.
2. Reverse proxy overwrites client-provided IP headers, origin is not directly reachable, TLS and cache bypass rules are correct.
3. CSP report-only/enforcement rollout and embedding/image host list have been checked.
4. R2 private quarantine, token scope, public read policy, CDN behavior, and independent media backups are validated.
5. Staging database migrations and restore exercise pass. Automated integration tests use a disposable `_test` database and are not a substitute for staging.

These external controls were unavailable for verification in this environment; they remain deployment gates, not claims of completed work.
