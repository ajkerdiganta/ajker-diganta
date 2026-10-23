# দৈনিক আজকের দিগন্ত — Production Deployment Report

**Assessment date:** 2026-10-07 (Asia/Dhaka)
**Target domain:** `https://dainikajkerdiganta.com`
**Assessment scope:** Production-readiness audit and safe local release verification

## Executive summary

**Deployment status: BLOCKED — no production deployment or production database migration was performed.**

The documented runbook explicitly requires staging-first validation and external production approval. The target domain currently serves an existing PHP application, not this Next.js application. No production Node origin, secret manager values, migration credential, Cloudflare zone access, R2 bucket, Resend account, monitoring destination, or backup/restore target is available in this sandbox.

No destructive database command, database reset/drop, production migration, DNS change, Cloudflare change, or production data modification was performed.

## Current production observations

| Check | Result |
|---|---|
| Production URL | Resolves and returns HTTP 200, but response identifies `PHP/7.2.34`; it is not this Next.js app |
| DNS | `dainikajkerdiganta.com` resolves to an existing IPv4 address; no DNS change was made |
| HTTP → HTTPS | HTTP redirects to HTTPS with 301 |
| TLS | Certificate subject matches `dainikajkerdiganta.com`; issued by Let's Encrypt; observed validity through 2026-12-18 |
| Cloudflare | Not verifiable from this environment; no Cloudflare zone/API access is configured |
| Production app health | Not verifiable because the domain is serving the existing PHP site |

## Local release verification

The imported Next.js application was checked without using production credentials:

| Check | Result |
|---|---:|
| TypeScript | Passed |
| ESLint | Passed |
| Unit tests | 58 passed across 11 test files |
| Production build | Passed with Next.js webpack build |
| Local database health | Passed: `{"status":"ok","checks":{"database":"ok"}}` |
| Local homepage | HTTP 200 |
| Local latest page | HTTP 200 |
| Local category page | HTTP 200 |
| Local search page | HTTP 200 |
| Local video page | HTTP 200 |
| Local `sitemap.xml` | HTTP 200 |
| Local `robots.txt` | HTTP 200 |
| Local RSS/feed | HTTP 200 |
| Committed migrations | 12 migration directories present |
| Repository cleanliness | No uncommitted changes detected at audit time before this report |

The local QA documentation also records Bengali rendering/search, Bengali URLs, Asia/Dhaka presentation, reader personalization, notifications, CMS workflows, SEO, and authorization tests. These are local/staging-equivalent results only and do not certify production.

## Production environment-variable gate

The local `.env` is development/local configuration and must not be promoted. Values were not printed or exposed. The following production inputs are unavailable or are local/placeholder values in this sandbox:

- `NODE_ENV=production`
- Production `DATABASE_URL` using a restricted runtime/DML role
- Separate privileged `MIGRATION_DATABASE_URL`
- Production `BETTER_AUTH_URL=https://dainikajkerdiganta.com`
- Production `PUBLIC_SITE_URL=https://dainikajkerdiganta.com`
- Production `BETTER_AUTH_SECRET`
- `RESEND_API_KEY` and verified `EMAIL_FROM`
- `R2_ENDPOINT`, `R2_BUCKET`, R2 access credentials and `R2_PUBLIC_BASE_URL`
- Production `JOB_AUTH_SECRET`
- Pool sizing and runtime limits

No secret values are included in this report.

## Gate-by-gate status

| Area | Status | Notes |
|---|---|---|
| Production environment variables | **Blocked** | Secret-manager injection and production values unavailable |
| Production database | **Blocked / unknown** | No production DB endpoint or access supplied; not contacted |
| Database migrations | **Blocked / not run** | 12 committed migrations exist; production migration status unknown; `MIGRATION_DATABASE_URL` unavailable |
| Object storage | **Blocked / unknown** | R2 bucket, permissions, private quarantine and public verified-media host unavailable |
| Email service | **Blocked / unknown** | Resend key and verified sender unavailable; delivery test not run |
| Cloudflare configuration | **Blocked / unknown** | No zone/API access; no DNS/WAF/cache/origin changes made |
| HTTPS | **Partially verified** | Existing domain has valid HTTPS, but it terminates the existing PHP site, not this app |
| Secure cookies | **Not production-verified** | Code is configured to use secure cookies when production auth URL is HTTPS; live cookie verification requires deployed app |
| DNS | **Partially verified** | Existing A resolution observed; pointing to the Next.js origin was not possible or authorized |
| Database backups | **Blocked / unknown** | No backup artifact, PITR policy, restore target or provider access |
| Monitoring | **Blocked / unknown** | No log sink, error tracker, uptime alert or owner configured |

## Requested post-deployment checks

These checks were **not run against production** because the target domain is still the existing PHP application and this Next.js app was not deployed:

- Homepage, latest, category, article, author and search
- Video listing/detail and playback
- Login, registration and dashboard
- Save, favourite, follow and notifications
- Admin, CMS and media upload/finalize/public delivery
- SEO metadata, `sitemap.xml`, `robots.txt` and RSS
- Production `/api/health`
- Bengali rendering/search, Bengali URLs/slugs and Bangladesh timezone
- Mobile and desktop route-by-route layout checks
- Production Core Web Vitals

The corresponding local route smoke checks passed for the public routes listed above. Authenticated and R2 checks remain environment-dependent.

## Documented deployment sequence to use after blockers are resolved

1. Provision a separate staging environment and secret-manager entries.
2. Restore a recent production backup into a new isolated staging database; never point tests at production.
3. Install the exact lockfile, generate Prisma Client, run `NODE_ENV=production pnpm db:deploy` using only the staging migration credential, then run migration status.
4. Run typecheck, lint, unit/integration tests, production build and `pnpm start` against staging.
5. Verify auth, CMS RBAC, uploads/finalize/media delivery, email reset, Bengali search/content, SEO, private API cache behavior and all listed smoke routes.
6. Verify backup restore, RPO/RTO, PostgreSQL grants, R2 private quarantine and independent media backup.
7. Configure the Node origin behind the reverse proxy/Cloudflare with Full (strict) TLS, HTTPS redirect, origin restriction, proxy IP-header overwrite, WAF/rate rules and authenticated-route cache bypass.
8. Obtain explicit production release approval, apply only committed migrations with `prisma migrate deploy`, deploy an immutable Node build, run health/smoke checks and monitor 5xx, latency, DB pool, auth, email, media and scheduler signals.

## Rollback procedure

- **Application rollback:** route traffic back to the previous immutable Node release/container image and retain the failed release artifact/logs for investigation.
- **Database rollback:** do not run `prisma migrate reset`, `db push`, `migrate dev`, `DROP`, or unreviewed down-migrations against production. Prefer a forward-fix migration. If recovery is required, restore a verified backup/PITR point into a new isolated database first, validate it, and follow the approved provider cutover procedure.
- **Media rollback:** retain the previous application/media configuration; do not delete production R2 objects during rollback. Restore media from the independent backup into a non-public validation bucket before any approved cutover.
- **DNS/edge rollback:** revert the Cloudflare origin/route configuration to the previous origin and preserve the previous DNS/WAF/cache settings for rapid restoration.
- **Verification:** after rollback, check HTTPS, `/api/health`, homepage, auth session behavior, CMS access, database connectivity, media delivery and error/latency alerts.

## Required inputs to continue safely

Provide or connect the following through an approved secret manager/infrastructure workflow; do not paste secrets into chat:

1. A Node.js 22 production origin/server or approved hosting target with process manager/container access.
2. Production and staging PostgreSQL endpoints, plus separate restricted runtime and migration identities.
3. Verified staging and production backup/PITR policy and an isolated restore target.
4. Cloudflare zone access or an approved operator to configure DNS, Full (strict) TLS, origin restriction, WAF/rate rules and cache bypass.
5. R2 staging/production buckets with least-privilege server credentials and a verified media hostname.
6. Resend credentials and a verified sender identity.
7. Monitoring/logging/error-tracking destination, alert rules and an on-call owner.
8. A production release window and approval to point the existing domain from the PHP application to the new Node origin after staging sign-off.

Until these are available, the safe disposition is **prepared locally, not deployed**.
