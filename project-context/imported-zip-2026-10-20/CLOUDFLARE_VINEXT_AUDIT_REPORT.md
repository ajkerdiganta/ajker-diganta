# Dainik Ajker Diganta — Cloudflare/Vinext Phase 1 Audit

**Audit date:** 2026-10-17
**Scope:** Existing Next.js application only; no live DNS, production database, or production website changes were made during this audit.

## Audit result

The project is a working Next.js 16 App Router application, but it is **not yet verified as Cloudflare Workers-ready**. The reproducible `vinext check` result is **97% compatible**, with one reported partial item: image resizing requires an optimizer. Source inspection also found runtime gaps that the checker does not classify as project issues: the application explicitly uses Node.js runtime routes, a TCP PostgreSQL adapter, native `sharp`, and Node crypto APIs.

The correct migration strategy is a **non-destructive Vinext/Cloudflare staging copy** that preserves the existing Next.js application and keeps PostgreSQL/Neon. No production deployment should be attempted until the Cloudflare build and runtime tests pass in that isolated copy.

## Inventory observed

- Next.js: `16.3.6`
- React: `19.2.8`
- Prisma packages: `7.10.0`
- Database adapter: `@prisma/adapter-pg` with `pg 8.23.0`
- Authentication: Better Auth `1.7.6` with Prisma adapter and Argon2 password hashing
- Route handlers found: **47** under `src/app/**/api/**/route.ts`; Vinext reported 48 route handlers
- Page files found: **42**; Vinext reported 42 pages
- Layouts: 1
- Prisma migrations: 15
- Server Actions: none found
- Middleware/proxy: none found
- Cloudflare/Vite/Wrangler configuration: not present at audit start
- Git metadata: no `.git` directory exists in the current workspace

## Reproducible Vinext report

Command executed:

```bash
npx vinext check
```

Exit code: `0`

Observed result:

```text
Imports: 6/6 fully supported
Config: 3/4 options supported
Libraries: 5/5 compatible
Project structure: App Router, 42 pages, 1 layout, 48 route handlers
Overall: 97% compatible (18 supported, 1 partial, 0 issues)
Partial: images — resizing needs an optimizer via vinext({ images: { optimizer } })
```

The complete raw output is stored at `project-context/vinext-check-report.txt`.

## Prioritized findings

### P0 — Must resolve before a Workers runtime claim

1. **Database runtime path is not verified for Workers.** `src/lib/prisma.ts` creates a Node `pg` Pool and `PrismaPg` adapter from a PostgreSQL connection string. Cloudflare's documented Prisma-on-Workers path uses Hyperdrive with `nodejs_compat`, or a compatible serverless/edge adapter. The current code has no Hyperdrive binding and no Workers environment binding integration. Keeping Neon is possible, but the chosen connection path must be tested in the Workers runtime.

2. **Native image processing is Node-only in the current implementation.** `src/app/api/admin/media/finalize/route.ts` imports `sharp`, reads a buffer, resizes, and writes WebP. This route is explicitly `runtime = "nodejs"`. It cannot be treated as Workers-compatible without a replacement strategy, such as Cloudflare Images transformations or a separately hosted image-processing service. This is independent of Vinext's `next/image` partial warning.

3. **Cloudflare deployment configuration is absent.** There is no `vite.config.ts`, `cloudflare.config.ts`, Wrangler configuration, Images binding, KV cache binding, or Hyperdrive binding. The migration must be generated in an isolated copy using the supported Vinext CLI, not by overwriting the original Next.js configuration.

### P1 — Must resolve before staging acceptance

4. **Node runtime APIs are present in request paths.** The code uses `node:crypto` in the scheduled publisher and media storage, `Buffer` in the image finalizer and job authentication, and AWS SDK S3 clients for R2-compatible object storage. These need a Workers preview test with `nodejs_compat`; image processing still needs special handling.

5. **Image optimization is only partially supported by the checker.** The current `next/image` usage includes Cloudflare-served/local media paths with `unoptimized` in several places and remote YouTube thumbnails. Vinext's documented Cloudflare setup requires `imagesOptimizer()` plus the matching Cloudflare Images binding if request-time optimization is desired. This has not yet been configured or tested.

6. **Scheduled publishing is an external job contract, not a Workers schedule yet.** `POST /api/internal/jobs/publish-due` is protected by `JOB_AUTH_SECRET`, but no Cloudflare Cron trigger or equivalent deployment configuration exists. Staging must test the endpoint and define the production scheduler without exposing the secret.

7. **Object storage is S3-compatible R2 via AWS SDK, but no Cloudflare binding path is configured.** The current implementation expects endpoint and access-key variables. This may work through R2's S3 API under Workers compatibility, but upload, read, signed URL, finalize, and deletion have not been tested in Workers.

### P2 — Important acceptance and operational checks

8. **Database migration discipline needs a separate direct migration URL.** `prisma.config.ts` uses `MIGRATION_DATABASE_URL` in production and `DATABASE_URL` otherwise. The `.env.example` currently documents `DATABASE_URL`, `SHADOW_DATABASE_URL`, and `TEST_DATABASE_URL`, but does not document `MIGRATION_DATABASE_URL`; this should be reconciled before packaging and deployment.

9. **Authentication is structurally suitable but not Workers-verified.** Better Auth uses cookies, headers, Prisma, Argon2, database rate limits, and reset email delivery. Secure cookies are enabled when `BETTER_AUTH_URL` is HTTPS. Session creation, login, logout, password reset, role authorization, and cookie behavior still require Cloudflare preview tests.

10. **Email delivery is configuration-dependent.** Resend is optional in the environment schema and email sending is delegated to the application's email module. Contact, newsletter, advertisement, subscription, and password-reset email paths require a configured staging Resend credential and a real delivery verification; no credentials were inspected or exposed.

11. **Current local workspace is not a Git repository.** The migration must first create a separate branch or isolated working copy. The original Next.js workspace must remain untouched and deployable with `pnpm build`.

12. **Existing route inventory differs from the task brief.** The brief mentions 15 handlers and 17 pages, while the current source contains 47 route handlers and 42 pages. The current source inventory, not the older count, is the authoritative migration scope.

## Compatibility areas audited

- **Routing and rendering:** App Router, dynamic routes, metadata, `revalidate`, `dynamic = "force-dynamic"`, redirects, and `notFound` are present. No Server Actions or middleware were found.
- **Headers and cookies:** security headers are configured in `next.config.ts`; API routes use `no-store`; Better Auth controls secure cookies based on HTTPS.
- **Caching/ISR:** home and sitemap use revalidation; public data uses React `cache`; Workers cache/KV data adapters are not configured.
- **Authentication/authorization:** Better Auth + Prisma, role/permission checks, rate limiting, audit logs, direct admin/staff paths.
- **File uploads:** quarantine → object storage → metadata validation → `sharp` conversion → verified WebP → public API delivery.
- **Database:** PostgreSQL schema with Prisma 7 driver adapter, 15 migrations, local migration/seed scripts, and transaction-heavy workflow services.
- **Email:** Resend environment support and email outbox models are present; external delivery remains environment-dependent.
- **Scheduled work:** protected publish-due route and database cleanup operation are present; no Cloudflare cron binding is configured.
- **SEO/public delivery:** sitemap, robots, RSS, metadata, article slugs, Bengali search, and public article/video routes are present.

## Tests run during Phase 1

| Check | Result | Evidence |
|---|---|---|
| `npx vinext check` | Passed, 97% | `project-context/vinext-check-report.txt` |
| Source inventory | Completed | 47 route handlers, 42 pages, 15 migrations |
| `pnpm build` | Previously passed in this workspace | Existing validation history; will be rerun after isolated migration work |
| Node/runtime dependency scan | Completed | `node:crypto`, `sharp`, `pg`, AWS SDK usage identified |
| Cloudflare Workers preview | Not yet run | No Cloudflare config exists yet |
| Neon read/write/migration test | Not run in this audit | Requires explicitly selected staging/Neon credentials; local PostgreSQL was not treated as Neon |
| Production database/DNS/deployment | Not run | Explicitly out of scope without approval |

## Decision before Phase 2

Proceed with an isolated, non-destructive Vinext migration copy. Keep the original workspace as the Next.js baseline. Use the supported `vinext init --platform=cloudflare` flow in the copy, then add only the configuration and adapter changes justified by failed builds or runtime tests. Keep PostgreSQL/Neon; do not introduce D1. Do not connect the production domain or modify live DNS.

## Official references

- [1]: https://vinext.dev/ "Vinext official documentation and Cloudflare deployment overview"
- [2]: https://github.com/cloudflare/vinext "Vinext official repository and migration CLI guidance"
- [3]: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ "Cloudflare Workers Next.js/Vinext compatibility and deployment guide"
- [4]: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/ "Cloudflare Hyperdrive with Prisma and PostgreSQL"
- [5]: https://neon.com/docs/guides/prisma "Neon official Prisma serverless connection guide"
