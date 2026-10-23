# FINAL QA REPORT — দৈনিক আজকের দিগন্ত

**QA date:** 2026-10-06 (Asia/Dhaka)  
**Scope:** Local-only end-to-end and security QA of the current Next.js/PostgreSQL application. No production deployment, production database access, or staging migration was performed.  
**Test database:** `ajker_diganta_verify_test` on local PostgreSQL; the integration runner verified the `_test` database name and reported no pending migrations. Temporary browser fixtures and two synthetic accounts were removed after testing.

## Executive summary

The main public-reader journey and core reader, newsroom, notification, analytics, search, SEO, and security behaviors were exercised through a combination of the local production preview, integration tests, unit tests, and code review. Bengali content and mixed Bengali-English search rendered correctly in the browser.

One functional defect was found and fixed: authenticated article reads were written to reading history only when the public aggregate-view counter accepted the request. In a local request without a usable IP, the aggregate count correctly returned `counted: false`, but the user's personal history was also omitted. The route now records authenticated reading history independently of aggregate view deduplication. Article-view browser deduplication also uses a server-derived HMAC pseudonym per account, preventing one reader's anonymous or authenticated session key from suppressing another account's history in the same browser. A PostgreSQL integration regression test covers the no-IP case.

**This report does not certify the application as production-ready.** The required staging migration and live Cloudflare R2 verification remain undone, production proxy/IP trust and database grants have not been verified, there is no CSP, the full dependency audit reports an unpatched high-severity advisory in a development-only lint dependency, and the requested admin user-management and audit-log viewer surfaces are absent.

## Tests performed

### Browser end-to-end checks

Using the local production preview and synthetic Bengali content, the following routes and flows were opened or exercised:

- **Public:** homepage → category → article; Bengali/English search results; video listing and video detail; registration.
- **Reader:** category and topic follow; save and favourite as distinct actions; article view/history; dashboard; notification inbox and mark-read action.
- **Admin:** first verified the ordinary reader was denied `/admin`; after granting `SUPER_ADMIN` only to the disposable local test account, verified `/admin` and `/admin/analytics` rendered.
- **Rendered content:** Bengali headlines, category/author labels, dates in Dhaka time, mixed Bengali-English article/search text, and notification copy were visible in browser output.

The browser workflow ran before the final reading-history correction. After that correction, the regression integration test, full validation suite, and production build were rerun successfully; a second authenticated browser session was not run against the rebuilt output.

### Automated checks (post-fix)

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | **58 passed** across 11 test files |
| `pnpm test:integration` | **21 passed** across 10 test files, isolated local PostgreSQL test database |
| `pnpm exec prisma validate` | Passed |
| `pnpm build` | Passed; optimized Next.js production build completed |
| `pnpm audit --prod` | No known production dependency vulnerabilities reported |
| `git diff --check` | Passed |
| Preview cleanup | Temporary local production server stopped; temporary QA scripts, fixture JSON, content, and accounts removed |

The integration run found 11 migrations and **no pending migrations in the local verification database**. This is not evidence that staging or production has the same migration state.

## Passed

### Product flows and functional checks

- **Reader identity:** browser registration completed; automated tests verify Bengali registration, login, logout/session revocation, password reset, secure cookie attributes, and password validation.
- **Personalization:** separate saved/favourite collections, category/topic follows, history ownership and clear-history behavior are covered. Forged account IDs and cross-account access are rejected. The new no-IP history regression passes.
- **Notifications:** localized notification inbox rendered in Bengali; mark-read changed the unread count. Integration tests verify read/unread authorization, account scoping, preferences, event notification generation, and deduplication.
- **Reporter/editor workflow:** integration tests exercise draft creation/edit, submission, review, rejection and reporter revision/resubmission, approval, scheduling, publication, breaking/featured/trending flags, and workflow records. Reporter publication attempts are denied; editor publication is allowed.
- **Admin analytics:** authorized super-admin view rendered; API integration tests deny anonymous, reader, and editorial access and verify aggregate-only responses and date ranges.
- **Search:** the browser returned the synthetic article for `বাংলাদেশ Cyber Security`; integration tests cover Bengali, English, mixed, partial and related-entity terms. Search uses PostgreSQL and parameterized SQL, not an external search engine.
- **Media/video safeguards:** upload authorization, size limits, quarantine, invalid/disguised-file rejection and image downscaling are covered by tests using the in-memory storage adapter. Video tests reject malformed or hostile hosts and validate only supported YouTube URL forms.
- **SEO:** integration/code checks cover title, description, canonical, OpenGraph, `NewsArticle` JSON-LD, escaped hostile JSON-LD, breadcrumb markup, sitemap, robots directives and Bengali RSS.
- **Authorization/security:** server-side RBAC is exercised at API level for reporter/editor/admin/reader, article ownership, analytics, notifications, dashboards and IDOR cases. Auth tests verify untrusted-origin rejection and login throttling; CMS tests exercise stored-XSS sanitation and upload-origin/ownership checks.

### Bengali rendering and URLs

- Bengali and mixed Bengali-English content appeared correctly in the browser on article, category, search, dashboard and notification surfaces.
- Date/time display used Bangladesh locale/time conventions in the tested pages.
- The application uses stable ASCII/transliterated article slugs; CMS tests check slug output, and video tests check that the provider-derived video slug remains stable if a Bengali title changes.
- Rich-text and metadata tests reject script elements, `javascript:` links, event-handler payloads, attacker-controlled image URLs, and JSON-LD script termination.

## Finding fixed during QA

### Authenticated reading history coupled to public view-count deduplication

- **Observed:** In the browser, an article read did not initially appear in the account's reading history when the public view request lacked a usable IP. Public aggregate counting and personal history are distinct concerns; the aggregate endpoint returned `counted: false` and the prior route skipped the personal history write.
- **Impact:** A signed-in reader could miss history for a read even though the aggregate view count was intentionally not incremented.
- **Fix:** The public article-view route now attempts the authenticated history write independently of the aggregate counter result. Per-reader client deduplication is namespaced with a server-derived HMAC value rather than sharing one anonymous key across all accounts.
- **Retest:** Added/ran a PostgreSQL regression check confirming an authenticated no-IP view returns `counted: false` but still creates that user's history row. Full unit/integration suites and production build passed.

## Failed, incomplete, or not verified

| Area | Status / limitation |
|---|---|
| Admin user management | **Not implemented:** no admin user-management page/API was found in the current route inventory. The requested “Manage users” step cannot pass in this MVP. |
| Admin audit-log viewer | **Not implemented:** CMS audit events are recorded in the database, but there is no admin-facing audit-log listing page/API. The requested “View audit logs” step cannot pass. |
| Reporter/editor visual browser walkthrough | **Not performed:** role transitions and access control were verified through integration/API tests, not a separate interactive browser login for each editorial role. |
| Real video playback | **Not verified:** the preview video used a synthetic provider identifier; the detail UI rendered, but playback availability for a real publisher video was not established. |
| Live R2 upload | **Not verified:** media tests use the in-memory adapter. Real R2 bucket permissions, private quarantine, CDN delivery, and cleanup lifecycle require staging credentials and a staging test. |
| Path traversal | No separate adversarial path-traversal penetration test was run. Media object keys are generated by the server and the upload route uses bounded bytes and validated identifiers, but this is not a substitute for a dedicated test.
| Malformed Unicode fuzzing | Basic Unicode round-trip/NFC, Bengali, mixed text and schema validation are covered. Exhaustive malformed UTF-8, lone-surrogate, bidi-control and normalization fuzzing was not performed.
| Browser mobile layout | The QA browser flow was primarily a standard viewport. The earlier performance pass has a 360×800 mobile lab sample for the homepage only; all route layouts were not visually audited at mobile breakpoints during this QA.
| Staging/production database | No staging credentials were available. Staging migrations, production migration state and backup/restore were not tested or changed.
| External email | The in-app notification path was tested. A production email delivery worker/provider end-to-end was not verified; current documentation states the outbox does not itself deliver email.

## Security issues and residual security gates

No critical application exploit was demonstrated in this local QA. The automated tests and review found expected controls for authentication, server-side authorization, IDOR, parameterized search/aggregate SQL, stored XSS, CSRF/origin checks, upload bounds, and exact-host YouTube URL validation. This is not a third-party penetration test or a guarantee of security.

The full dependency audit run during the same QA session identified one **high-severity, unpatched `braces@3.0.3` advisory** in the development-only chain `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. `pnpm audit --prod` reports no known production dependency issues. The upstream advisory lists no patched release; do not rely on user-controlled glob patterns in the lint toolchain, isolate lint/CI, and update when a compatible fix is released.

Deployment-dependent security gates carried forward from `SECURITY_AUDIT.md`:

1. The edge/reverse proxy must overwrite client-supplied `x-real-ip` before the app uses it for rate limits or IP-based deduplication; this was not verifiable locally.
2. Verify production runtime PostgreSQL uses a restricted DML-only role and migrations use a separately controlled schema-owner credential.
3. A nonce-based CSP is not configured. Test a report-only policy against Next.js, media and YouTube embeds before enforcement.
4. Verify real object-storage IAM, private quarantine, CDN access policy, and cleanup in staging.
5. No third-party penetration test or production-edge scan was performed.

## Performance results

Route loads for the public pages, search, reader dashboard, and admin analytics rendered in the QA browser. No fresh full performance trace was captured after the final history fix. The existing [`PERFORMANCE_OPTIMIZATION.md`](PERFORMANCE_OPTIMIZATION.md) contains the prior single-run production mobile lab sample at 360×800, 4× CPU slowdown and simulated 150 ms RTT / 200 KiB/s download:

- Homepage TTFB: **43 ms**; LCP: **888 ms**; CLS: **0.00015** (empty/limited verification content, not representative of a populated front page).
- Cold font transfer: **299,604 B**, down from 353,952 B (−15.35%) after Bengali-only font subsetting.
- Image transfer in that sample: **0 B** because the fixture homepage had no lead image; **INP was not measured** because there was no qualifying interaction trace.
- No current per-route TTFB, populated-image LCP, authenticated-dashboard performance trace, or representative production query-plan/load test is claimed here.

## SEO issues

SEO unit/integration checks passed for the implemented metadata and routes. The URL/article SEO strategy is Bengali-first with transliterated ASCII article slugs and `bn-BD` structured data. Sitemap, robots rules (including admin/dashboard disallow), and RSS return successfully in the isolated integration suite.

No external search-engine crawler validation, social-card fetch from the public Internet, live canonical-host verification, or production sitemap indexing test was performed. Verify the configured canonical origin and media accessibility from a staging/public edge before release.

## Production blockers / recommended next actions

This QA is **local-only, not a production release approval**. Before production launch:

1. Complete and verify the **staging migration** against the actual staging database; separately exercise backup/restore and health checks.
2. Verify proxy IP-header behavior, runtime/migration database grants, HTTPS/cookies, and security headers in the deployed topology.
3. Test media upload/finalization/read/delete and CDN delivery with a real least-privilege R2 staging bucket.
4. Decide whether **admin user management and audit-log viewing** are required for launch. They are absent and were not added during this no-new-features QA task.
5. Track the unpatched dev-only `braces` advisory and refresh dependency audits after upstream remediation.
6. Roll out CSP in report-only mode, then enforce only after route/embed verification.
7. Run mobile visual/interaction checks across home, article, search, category, video, dashboard and admin with representative staging content and real image sizes; collect field LCP/CLS/INP after launch.
8. Validate email notification delivery separately if email notifications are a launch requirement.

**Overall disposition:** Core MVP workflows passed automated tests and the exercised local browser flows, with the reading-history defect fixed. Release sign-off remains conditional on the staging/deployment gates above and resolution or explicit acceptance of the admin-surface requirements and dev-tool advisory.


## 2026-10-22 current-tree follow-up — account and workflow local QA

Current snapshot is still at `399dd2e` with the intended uncommitted work preserved; two carried CMS-access files remain intentionally deleted. No remote exists. Private `.env` is ignored and mode 0600. All database validation used local PostgreSQL 16.15, with the isolated integration DB name ending `_test`; the current dev and test schemas report 16 migrations with none pending. No production/staging/shared DB, provider, deployment or publication action occurred.

The restored menu has 14 root categories and 101 subcategories (115 total), 11 header items and 119 active hamburger items. Admin-only category/menu writes are checked at the server boundary; editors retain tag management. Staff login paths are `/dainik/ajker/diganta/s/a/boss` (Admin/Super Admin) and `/d/a/d/my/staff` (Reporter/Editor), with no newsroom-entry link on the homepage. Public registration creates USER only. Admin/Super Admin can manage USER/REPORTER/EDITOR/ADMIN accounts, and the separate active-subscriber roster remains distinct from payment verification. Reporter submission and Editor/Admin review/publication/cancellation, with Admin-only published-story removal, are covered by isolated integration tests.

The public footer centers the follow row, supports CMS-managed publisher/editor names and verified social links, and includes `Developed by cyberpointsecurity` linked to `https://cyberpointsecurity.com`. The requested profile helper sentence is removed. No names or profile URLs were invented. All 16 checked public Preview routes included the developer footer and returned HTTP 200; both protected staff-login pages and `/api/health` returned 200.

Final validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test` (84 tests/14 files), `pnpm test:integration` (33 tests/14 files on the guarded local `ajker_diganta_test`), `pnpm build`, `pnpm db:seed`, local `prisma migrate status`, and `git diff --check`. Integration creates synthetic accounts with per-run random passwords, then cleans them up.

The credentials supplied in chat were not used or stored; rotate them before real use. Verified email/reset delivery, official profile URLs and editor/publisher names, articles for empty categories, real R2/CDN, phone field encryption/retention review, staging migration/backup-restore, production proxy and DB-grant verification, CSP, broad mobile/accessibility/performance checks, monitoring, independent security review and release approval remain open. This is local QA, not production readiness.


### Footer logo-label adjustment — 2026-10-22

The duplicate text beside the footer logo was removed; the image, accessible link label, centered social row and developer credit remain. Final typecheck, lint and production build passed. Restarted Preview returned HTTP 200 for `/api/health`; server-rendered homepage confirms the logo, follow heading and credit remain and the duplicate adjacent text is absent.


### Local Admin test account and Next.js indicator — 2026-10-22

- The Admin test account was registered through the local Preview browser; the password was entered directly by the user in the browser and was not copied into source, logs, documentation or chat by the agent. The active row was confirmed in the loopback PostgreSQL `ajker_diganta_dev` database. Per the user's explicit local-test instruction, `emailVerified` was set to true for this test record only, then the existing `pnpm admin:promote` script assigned `ADMIN`. A read-only check confirmed `ACTIVE`, `emailVerified=true`, and `USER`/`ADMIN` roles. No production, staging or shared database was accessed.
- **Interactive Admin sign-in remains unverified**; a browser sign-in step is still pending. Reporter, Editor and Reader test accounts have not yet been provisioned or login-tested. Passwords previously typed in chat were not used.
- Disabled the Next.js development N indicator with `devIndicators: false` in `next.config.ts`. `pnpm typecheck` passed, the Admin route and `/api/health` returned HTTP 200, and a refreshed Preview screenshot confirmed the N icon is absent. This is a local development UI setting; no deployment was performed.
