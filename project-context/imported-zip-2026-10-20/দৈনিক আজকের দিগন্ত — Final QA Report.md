# দৈনিক আজকের দিগন্ত — Final QA Report

**পরীক্ষার তারিখ:** ৭ অক্টোবর ২০২৬  
**পরীক্ষার পরিবেশ:** Local PostgreSQL + Next.js preview (`http://127.0.0.1:3000`, public preview HTTPS URL)  
**Scope:** Registration, named-account login, role dashboards, reader features, CMS taxonomy/menu CRUD, public routes, automated tests

## Executive summary

- **Core application status:** PASS for the tested local preview flows.
- **Registration:** PASS — Bengali reader registration form accepted a new test account and authenticated it.
- **Named account login:** PASS for admin, reporter, editor and reader accounts. Passwords and secrets are not recorded in this report.
- **Role destinations:** PASS — admin → `/admin`, reporter → `/admin/articles`, editor → `/admin/review`, reader → `/dashboard`.
- **CMS category CRUD:** PASS — admin session created, edited and removed a disposable QA category.
- **CMS menu CRUD:** PASS — admin session listed menus and created, edited and removed a disposable QA menu item. The first edit attempt intentionally exposed that the edit payload requires `menuId`; the corrected edit passed.
- **Public route smoke test:** PASS for public pages and SEO endpoints; protected reader pages correctly returned `307` when unauthenticated.
- **Automated static/unit checks:** PASS — typecheck, lint and 58 unit tests passed.
- **Integration suite:** **PARTIAL / 2 failures** (details below); 8 of 10 integration files and 19 of 21 integration tests passed.

## Account and role verification

| Account type | Login | Destination/dashboard | Observed result |
|---|---:|---|---|
| Admin | PASS | `/admin` | CMS newsroom rendered with admin navigation |
| Reporter | PASS | `/admin/articles` | Reporter newsroom rendered; own-news workflow controls visible |
| Editor | PASS | `/admin/review` | Editorial review desk rendered |
| Reader | PASS | `/dashboard` | Reader dashboard rendered with saved, favourite, follows, history, preferences and profile sections |

### Reader feature checks

- Registration form showed email and password fields and accepted a Bengali test registration.
- Reader dashboard rendered successfully after login.
- Notification inbox route rendered with all/unread filters and mark-all-read control.
- Saved news, favourite news, follows, reading history, video history, preferences and profile sections were present.
- Empty-state rendering worked correctly for the test account.

### CMS feature checks

- Admin newsroom rendered: articles, analytics, review desk, scheduled publishing, categories/tags, navigation, authors, media and video newsroom links.
- Reporter article list rendered with new-article, draft, submitted, review, approved, rejected, scheduled, published and archived filters.
- Editor review desk rendered with review/approve/return workflow messaging.
- Admin category create/edit/remove API flow passed with a disposable QA category, which was removed afterward.
- Admin menu list/create/edit/remove API flow passed with a disposable QA item, which was removed afterward.
- Reporter and editor accounts were not given admin-only taxonomy/menu management access through the tested role paths.

## Public route smoke test

| Route | Result |
|---|---:|
| `/` | 200 |
| `/latest` | 200 |
| `/category/baanlaadesh` | 200 |
| `/search` | 200 |
| `/video` | 200 |
| `/login` | 200 |
| `/register` | 200 |
| `/dashboard` without session | 307 (expected protected redirect) |
| `/notifications` without session | 307 (expected protected redirect) |
| `/sitemap.xml` | 200 |
| `/robots.txt` | 200 |
| `/api/health` | 200 |

Bengali UI labels, Bengali category text and Bengali search/dashboard copy rendered correctly in the browser preview.

## Automated validation

### Passed

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — **11 files, 58 tests passed**
- Integration: auth negative/RBAC cases, CMS entry role routing, personalization isolation, notifications, video workflow, Bengali search, analytics authorization, SEO routes and health checks

### Integration failures / known issues

1. **Secure cookie assertion in local integration mode**
   - Failing assertion expects the session cookie to include `Secure`.
   - Local integration request is served over HTTP, so the emitted cookie is `HttpOnly; SameSite=Lax` without `Secure`.
   - This is an environment/test-mode mismatch, not a browser login failure. Production HTTPS must emit secure cookies and should be re-tested behind HTTPS.

2. **CMS media/storage expectation**
   - One CMS integration assertion expected `503` for an unavailable object-storage path but received `401` because the request reached authorization before storage handling.
   - This indicates the test fixture/request ordering does not match the current protected endpoint contract. It also confirms that no storage operation was performed anonymously.
   - Production media upload remains dependent on configured object storage credentials and should be tested with a real non-destructive upload after deployment configuration is supplied.

## Deployment/readiness notes

- This QA was performed against the local preview, **not against the production domain**.
- Production deployment was not executed because production database, object storage, email, Cloudflare/DNS and monitoring credentials/configuration were not available in the local environment.
- No destructive database command, reset, drop or production-data operation was performed.
- Before production release, re-run the secure-cookie test over HTTPS and perform one controlled media upload using the documented deployment process.

## Rollback guidance

1. Stop accepting new traffic or switch the deployment platform to the previous release.
2. Restore the previous application build/image and environment configuration.
3. Do not run `prisma migrate reset`, `db push --force-reset`, database drops or destructive data cleanup.
4. If a migration was applied, use the project’s documented forward-fix/rollback procedure after taking a verified backup; do not reverse production migrations blindly.
5. Re-run `/api/health`, authentication, public routes and CMS smoke checks before reopening traffic.

## Final verdict

**Local preview is suitable for continued development and controlled staging QA.** Core registration, authentication, role dashboards, reader dashboard, CMS taxonomy/menu management and public Bengali routes passed. **Production release should remain gated** until HTTPS secure-cookie verification, real object-storage upload, production database backup/migration verification, email delivery, Cloudflare/DNS, monitoring and error logging are confirmed in the deployment environment.
