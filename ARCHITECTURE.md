# Architecture — দৈনিক আজকের দিগন্ত

## System overview

The application is a single TypeScript codebase using Next.js 16 App Router. Public routes use server-rendered React components and database-backed service modules. Browser JavaScript is reserved for interactive experiences such as the rich-text editor, media picker, search controls, authentication forms, and account dashboards. Route handlers implement authenticated mutations and JSON APIs. The production target is a managed Node.js 22 Linux runtime behind a trusted HTTPS reverse proxy/CDN.

```text
Browser / crawlers
  ├─ public SSR pages ── Next.js route/page ── public services ── PostgreSQL
  ├─ login/dashboard/CMS ── Better Auth session + server-side permission checks
  ├─ media upload ── bounded authenticated API ── private quarantine in S3-compatible storage
  │                                      └─ Sharp decode/resize/WebP ── verified public objects/CDN
  └─ public article/video view events ── rate-limited API ── PostgreSQL daily metrics

Operator/release job ── separate MIGRATION_DATABASE_URL ── Prisma migrations
Scheduler ── HTTPS POST with JOB_AUTH_SECRET ── due-publication job
```

## Data and service boundaries

PostgreSQL is the source of truth for users, roles and permissions, articles/revisions, taxonomy, videos, media metadata, personal collections, activity history, notifications, metrics, and rate-limit state. Prisma 7 uses its PostgreSQL driver adapter; parameterized tagged-template SQL is reserved for efficient aggregates and PostgreSQL search. Search stays inside PostgreSQL using `pg_trgm`, GIN indexes, Unicode normalization, and bounded pagination; there is no external search engine or Redis dependency.

Better Auth owns the session lifecycle; role and permission decisions are repeated server-side in page loaders and API handlers. A UI control or route being hidden does not confer authorization. Editorial content follows explicit revision-aware workflow transitions; role assignment is an operator action, not a public API.

The media abstraction targets S3-compatible storage and Cloudflare R2. Upload bytes go through a protected, stream-bounded Node route (not presigned HTML form POST), land in a private quarantine key, and are decoded/re-encoded as WebP before visibility is switched to public. The app serves public objects from configured CDN URLs, or private objects with a short-lived signed GET. Never make the quarantine prefix public.

## Rendering, caching, locale, and URLs

Public pages use server rendering and short route revalidation where configured. Public aggregate content may be cached; authenticated dashboards, session-dependent pages, private media, and APIs must remain request-specific and non-cacheable. Do not place user-scoped state into shared caches. Use deployment/CDN cache rules only for immutable verified media and explicitly public assets. Avoid adding Redis until database/query measurements demonstrate a need.

UI locale is `bn-BD`; human-facing timestamps use `Asia/Dhaka`. Database timestamps remain timezone-aware canonical values. Noto Sans Bengali (body/UI) and Noto Serif Bengali (editorial headlines) are self-hosted variable fonts, scoped to Bengali glyph ranges; Latin uses a system stack. Search normalizes Unicode (NFC), Bengali punctuation/whitespace and mixed Bengali-English text before parameterized PostgreSQL matching. Search-friendly ASCII slugs are transliterated when records are created and retained as stable identifiers; old article slugs use the redirect table.

SEO metadata, canonical URLs, OpenGraph and NewsArticle/Breadcrumb JSON-LD are generated server-side. `/sitemap.xml`, `/robots.txt`, and `/feed.xml` are available; set the canonical `PUBLIC_SITE_URL` before indexing.

## Deployment/runtime constraints

The code uses Node runtime features, `sharp` for image processing, and the native `@node-rs/argon2` package. Therefore, deploy first to a conventional Node.js runtime (or a container/VM). Cloudflare DNS proxy/CDN/WAF plus R2 object storage are compatible integration targets. Do not assume this app can deploy directly to Cloudflare Workers: OpenNext/vinext, native modules, image optimization, PrismaPg+Hyperdrive, request streaming, auth, and every API route require an explicit compatibility build/test before adopting that runtime.

Cloudflare’s current Next.js Workers guidance recommends vinext (beta) for new projects and retains OpenNext for existing apps; neither has been integrated or validated here. Hyperdrive requires a Worker binding and Prisma driver-adapter configuration; this project currently consumes `DATABASE_URL` through Node `pg` Pool. Continue using the standard Node origin until a dedicated compatibility project proves otherwise.

## Operational planes

- **Health:** `GET /api/health` executes a read-only `SELECT 1`; it returns only health status and uses `Cache-Control: no-store`.
- **Logging:** Next.js server failures and PostgreSQL pool errors emit structured JSON to stdout/stderr with route and safe error metadata, not cookies, raw request URLs, personal data, or exception messages. Connect the platform log stream to retention, search and alerting; no third-party error-monitoring SDK is configured.
- **Backups:** PostgreSQL provider PITR plus independent scheduled encrypted logical backups; copy object storage outside the live bucket/account. Verify restores in an isolated staging account/database.
- **Scheduled publication:** An external scheduler calls the internal bearer-secret route; endpoint does not accept public client credentials.

## Non-goals

No Redis/search cluster, custom streaming service, email worker, bespoke queue, serverless Workers migration, automatic production deployment, or production database operation is included in this production-preparation pass.
