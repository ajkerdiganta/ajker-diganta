# Production Deployment Runbook

## Status and platform choice

This repository is prepared for a **Node.js 22 Linux application server/container** behind a trusted TLS-terminating reverse proxy/CDN. Do not publish/deploy automatically from this repository without the owner's explicit release approval. The local production build can be verified, but no external production environment is available in this sandbox.

Cloudflare compatibility: Cloudflare may provide DNS, proxy/CDN, WAF and R2 storage in front of a conventional Node origin. Cloudflare R2 uses an S3-compatible endpoint; the app now writes uploads server-side via bounded PutObject because R2 presigned HTML-form POST is not supported. Configure only the R2 endpoint and public verified-media domain; do not make quarantine keys public.

**Direct Cloudflare Workers deployment is not a supported/verified target yet.** The app relies on Node runtime features, `sharp` and native `@node-rs/argon2`, in addition to Prisma/PostgreSQL. Cloudflare currently recommends vinext (beta) for Workers, while OpenNext remains documented for existing apps; either path requires a dedicated compatibility build and end-to-end test. Workers use of Prisma requires Node compatibility, Hyperdrive binding and driver-adapter configuration. These are not installed/configured here. Keep the production origin on Node until each native module, image route, server action/route, session flow, upload body, ISR/cache behavior and DB integration passes in the selected Workers adapter.

Official references (read before an adapter migration): [Cloudflare Next.js / vinext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [OpenNext adapter guidance](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/), [OpenNext Cloudflare support](https://opennext.js.org/cloudflare), [Prisma + Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Required before staging sign-off

Configure all production-equivalent staging variables in an approved secret manager: separate staging `DATABASE_URL` and schema-owner `MIGRATION_DATABASE_URL`, real HTTPS `BETTER_AUTH_URL`/`PUBLIC_SITE_URL`, non-placeholder `BETTER_AUTH_SECRET`, valid Resend credentials/sender, R2 endpoint/bucket/access credentials/public asset domain, `JOB_AUTH_SECRET`, and pool values. No real configuration values belong in Git.

The migration credential was unset in this session and no staging database endpoint/credentials were provided. Therefore **staging migrations have not been run**. Do not substitute local/dev or integration test URLs. This remains a deployment sign-off blocker.

## Staging release sequence

1. Provision the app role without DDL privileges and a separate migration/schema-owner role; allow required PostgreSQL extension `pg_trgm`. Require TLS for both connections.
2. Build a staging PostgreSQL snapshot with masked/synthetic PII. Verify backup/PITR before testing destructive or migration work. Confirm it is not a production endpoint.
3. Install exact lockfile dependencies, generate Prisma Client, run `prisma migrate status`, apply migrations using `NODE_ENV=production` and only the staging `MIGRATION_DATABASE_URL`:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
NODE_ENV=production pnpm db:deploy
NODE_ENV=production pnpm exec prisma migrate status
```

4. Build and launch the immutable candidate with the staging app URL/database/object-store/email settings:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm start
```

Integration tests must target an isolated disposable database ending `_test`; never redirect them to shared staging. Application staging smoke uses staging only and should not enable test fixture/default passwords in production.
5. Verify health, test login/reset/logout, Reporter cannot publish, Editor workflow, Admin-only analytics, ordinary user IDOR separation, article/category/video/search pages, notification preferences, upload/finalize/public media, Bengali and mixed-script content, canonical/structured SEO, sitemap, robots and RSS. Check `Cache-Control: no-store` on private APIs and headers on HTTPS pages.
6. Exercise backup restore into a **new empty staging database** and media restore into a non-public test bucket. Record elapsed time, RPO/RTO, row/media validation and rollback/recovery owner.
7. Approve a separate production release window. Review migrations and backup snapshot, deploy code/migrations in the approved sequence, monitor logs/error rates/latency and `/api/health`, and retain a tested rollback or forward-fix strategy. Do not auto-deploy as part of this guide.

## Web server and edge

Run `pnpm start` under a process manager/container orchestrator with graceful termination, bounded CPU/memory and readiness/liveness checks. Bind only behind a private origin listener. Trust one known reverse proxy; it must overwrite `x-real-ip` because the application uses it for rate limiting. Do not expose the origin directly. Cloudflare proxy/WAF should be restricted to your zone; use TLS mode Full (strict), HTTPS redirects, origin access restrictions, bot/rate rules and cache bypass for `/api/*`, `/admin/*`, `/dashboard`, `/notifications`, and every authenticated route. Public HTML cache should be deliberate and must never mix signed-in content.

The app sets HSTS only when production `BETTER_AUTH_URL` uses HTTPS, plus frame/content/referrer/permissions protections; APIs are no-store. There is no production CSP yet. Roll out a nonce-based CSP in report-only, measure violations for Next scripts, YouTube iframe, and image/CDN hosts, then enforce in a reviewed follow-up.

## Environment and database

See [ENVIRONMENT.md](ENVIRONMENT.md) and [DATABASE.md](DATABASE.md). In short, the web process receives `DATABASE_URL` (restricted DML runtime role), auth/email/storage/job credentials and public origins. Only the controlled migration job receives `MIGRATION_DATABASE_URL`. Tune pool maximum against replicas and provider connection limits. Use a managed PostgreSQL provider in the same/near region as the app; enable TLS, PITR, automated backups, alerting and tested restore.

## Cloudflare R2 / media

Create a private bucket and a separate public-media hostname/custom domain. Keep access credentials scoped to required object Get/Put/Delete operations; only the app server sees them. The app owns key generation and uploads validated raw bytes to `quarantine/`; it re-encodes and moves verified images to `verified/`. Enable HTTPS, avoid public bucket-wide access if the custom domain can serve only `verified/` paths, confirm redirect/cache behavior, and test application delivery. Direct browser-to-R2 upload CORS is not needed for the current server-proxy design.

R2 lifecycle policies can expire stale quarantine objects, but are not backups. R2's current S3 API matrix marks bucket versioning unsupported, so copy media to a separate account/provider and test retrieval. Never grant lifecycle/delete/write scope more broadly than needed.

## Email, scheduling, logging and incidents

Use a verified sender and provider API key for password resets. Alert on provider failures; the app does not report password-reset delivery as successful if Resend rejects it. User notification email outbox has no provider-backed sender worker in this MVP and remains out of scope.

Run the publisher job on a managed external scheduler at the interval needed by newsroom policy; send `POST /api/internal/jobs/publish-due` over HTTPS with a bearer secret. Restrict who can trigger the job; rotate the secret if exposed. Scheduled publication fails closed when the secret is missing.

Structured server logs go to stdout/stderr; route them to managed logs with restricted access and retention. `instrumentation.ts` omits personal/request content. No Sentry/third-party error monitoring is configured; connect a platform monitoring product and test alert delivery before launch. Monitor 5xx, latency, DB pool exhaustion, auth rate limits, email failures, media failures, job counts, disk/storage and backup age.

## Acceptance checklist

- [ ] Secret manager has complete staging configuration; no real `.env` tracked or bundled.
- [ ] Staging migration from the same lockfile/commit succeeds; no production URL was used.
- [ ] Production build, unit tests, PostgreSQL integration tests pass.
- [ ] Auth cookies are Secure/HttpOnly/SameSite in production and account reset email is delivered.
- [ ] Reverse proxy overwrites trusted client-IP headers; origin is restricted; HTTPS/HSTS verified externally.
- [ ] Runtime DB DML-only and migration-role separation verified by DBA.
- [ ] R2 upload/finalize/CDN delivery passes; quarantine is private; independent object backup exists.
- [ ] PostgreSQL backup/PITR and restore into isolated staging exercised and recorded.
- [ ] Bengali public content, SEO/sitemap/robots/feed, admin analytics, access denial and mobile routes checked.
- [ ] CSP report-only plan, alert/monitor ownership, rollback decision and production approval documented.

No deploy or production migration was carried out here; external staging values, R2, Resend and proxy configuration were not available.
