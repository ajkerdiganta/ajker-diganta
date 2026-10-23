# TODO

## CMS public-entry cleanup and role-specific login routes — `[x]`

- Homepage footer থেকে “নিউজরুম / CMS প্রবেশ” link সরাতে হবে; reader `/login` page থেকে “CMS প্রবেশপাতায় যান” link সরাতে হবে; `/cms-access` route/component সম্পূর্ণ অপসারণ করে ওই URL-এ Next.js 404 দেখাতে হবে। Public homepage বা footer-এ newsroom entry point রাখা যাবে না।
- Admin/Super Admin-এর সরাসরি login path হবে `/dainik/ajker/diganta/s/a/boss`; Reporter/Editor-এর সরাসরি login path হবে `/d/a/d/my/staff`। Login-এর পরে server session-এর প্রকৃত role ও permission যাচাই করে যথাক্রমে `/admin`, `/admin/articles`, `/admin/review`-এ পাঠাতে হবে; ভুল role-এর login বাতিল করতে হবে। এই URL-গুলো client-selected role বা URL possession থেকে privilege দেবে না।
- Hamburger icon click-এ dialog খুলবে; শুরুতে top-level item serial order-এ থাকবে, subcategory লুকানো থাকবে। Subcategory-সহ main category click করলে শুধু সেটির children খুলবে; অন্য category-এর children বন্ধ থাকবে; একই category-তে পুনরায় click করলে বন্ধ হবে। Main category-এর পাশে expand/collapse arrow থাকবে; childless main category direct link হবে। Panel-এর upper-right-এ X, outside click-এ close এবং mobile viewport-contained scroll থাকবে।
- Four test-account access checks remain **partial**. Admin (`admin@dainikajkerdiganta.com`) was registered through local Preview/browser; its email was marked verified per the user's explicit local-test instruction, and the `ADMIN` role was assigned only in `ajker_diganta_dev`. The row is active; interactive sign-in is still pending. Reporter, Editor and Reader accounts/sign-in checks remain pending. No password is documented or stored in the repository.
- **Preview evidence:** homepage 200 and newsroom footer text absent; `/cms-access` 404; admin/staff login routes 200. The current Next.js N development indicator is disabled and no longer visible in the Preview screenshot. Latest validation: typecheck, lint, 84 unit tests, 33 isolated integration tests and production build passed; representative Preview routes and `/api/health` returned 200.

## Source baseline managed project-এ যোগ করা — `[x]`

- আপলোড করা Ajker Diganta ZIP-এর existing source code-কে Dailydiganta-এর অধীনে আলাদা Ajker Diganta project-এ যোগ করা হয়েছে।
- Existing source structure, Bengali-first UI, current features, documentation, schema, committed migrations ও tests অক্ষত রাখা হয়েছে; redesign, rewrite বা নতুন feature scope যোগ করা হয়নি।
- Target project's `.git`/concurrent changes সংরক্ষিত। `.env`/credential values, `node_modules`, `.next`, generated Prisma client ও build caches source-controlled project files-এ কপি বা commit করা হয়নি।

## Local PostgreSQL development environment — `[x]`

- PostgreSQL 16 local Sandbox-এ ইনস্টল ও চালু করা হয়েছে। `ajker_diganta_dev`, `ajker_diganta_shadow` ও আলাদা `_test` suffix-যুক্ত `ajker_diganta_test` database তৈরি হয়েছে।
- Runtime `ajd_app` role-কে schema DDL privilege না দিয়ে application DML/sequence access দেওয়া হয়েছে; `ajd_migrator` কেবল local migration/test setup-এর জন্য আলাদা রাখা হয়েছে। Fresh random local credentials ও auth secret private mode `0600` `.env`-এ; secret values source, chat বা published config-এ রাখা হয়নি।
- Committed 11 Prisma migrations নতুন local dev database-এ apply হয়েছে; `pnpm db:seed`-এ 7 roles ও 48 permissions তৈরি হয়েছে; migration status up to date। Integration suite আলাদা local `_test` database ব্যবহার করে। Production database/credential-এ কোনো সংযোগ বা migration হয়নি।

## চারটি local sample role account ও landing destination — `[~]`

- Admin accountটি local Preview registration page-এ browser দিয়ে তৈরি হয়েছে; explicit local-test নির্দেশে `emailVerified` true করা হয়েছে এবং existing `pnpm admin:promote` script দিয়ে `ADMIN` role দেওয়া হয়েছে। DB-তে account active/verified/ADMIN নিশ্চিত; login পরীক্ষা এখনও বাকি।
- Reporter, Editor ও Reader account এখনও provision করা হয়নি। Admin sign-in যাচাইয়ের পর CMS workflow দিয়ে এগুলো তৈরি ও প্রতিটি role-এর landing destination পরীক্ষা করতে হবে।
- Chat-এ প্রকাশিত password ব্যবহার করা হয়নি; password plaintext source files, logs, docs বা Git-এ রাখা যাবে না।

## Preview ও source verification — `[x]`

- Existing route inventory থেকে complete page route manifest `GET /manus-routes.json`-এ HTTP 200 ও valid JSON-সহ দেওয়া হয়েছে; API, static assets, robots/sitemap/feed ও 404-only route বাদ; 33 page route-সহ dynamic route-এ `:param` pattern আছে।
- Existing pinned Node/pnpm toolchain ও lockfile অনুযায়ী dependencies install এবং Prisma client generation হয়েছে। সর্বশেষ যাচাইয়ে TypeScript typecheck, ESLint lint, 82 unit tests, 29 PostgreSQL integration tests এবং production build pass করেছে; database-dependent কাজ কেবল verified localhost `ajker_diganta_dev` ও `_test` database-এ হয়েছে। Integration test files serially চলে যেন shared test fixtures notification transaction চলাকালীন মুছে না যায়।
- Dev server configured port 3000-এ চলছে। `/manus-routes.json` HTTP 200 এবং source App Router-এর সব 42 page route-এর সঙ্গে exact match; `/`, `/advertising`, `/newsletter`, `/subscribe` HTTP 200; anonymous `/admin/users` ও `/admin/audit` request 307 auth redirect পায়। Cookie-based login public HTTPS iframe Preview-তে `SameSite=None; Secure`-এর উপযোগী; plain HTTP local development আলাদা থাকে.
- Source `FINAL_QA_REPORT.md`-এর staging migration/backup-restore, real R2, proxy/IP trust, CSP, all-route mobile breadth ও production monitoring unresolved release gates। User-management ও audit-log surfaces এখন local source-এ সম্পন্ন। Project production-ready বলা হয়নি; এই কাজের মধ্যে production publish, external database setup বা production migration করা হয়নি।


## 2026-10-20 uploaded ZIP preservation and implementation

### ZIP reference files project-এ নিরাপদে যোগ — `[x]`

- আপলোড করা `ZIPextractকরেcleanworkspace-এrepositoryচালুকরা.zip` extract করে তার প্রতিটি নিরাপদ documentation, source-reference, test-reference, schema/config reference ও visual asset এই Ajker Diganta project-এর `project-context/imported-zip-2026-10-20/`-এ আলাদা file হিসেবে যোগ করা হয়েছে; existing source file overwrite করা হয়নি; মূল ZIP-এর path/name preservation ও SHA-256 `IMPORT_MANIFEST.md`-এ আছে।
- Archive-এ `.env`, `.dev.vars`, `pasted_content.txt` এবং account/debug credential-সংশ্লিষ্ট script আছে; সেগুলো project-এ কপি, প্রকাশ, অথবা execute করা যাবে না। User-provided secrets source control-এ যোগ করা যাবে না। Imported code/config/report inert reference, সরাসরি production/source override নয়।
- Archive-এর `প্রথম আলো`/external-domain screenshot/UI content branding copy করা যাবে না; Ajker Diganta Bengali-first identity ও active valid routes বজায় রাখতে হবে।

### Archive-এর logo brand asset ও header/footer-এ যুক্ত — `[x]`

- Archive-এর transparent RGBA `dainik-ajker-diganta-logo.png` (1600×533) অপরিবর্তিত binary হিসেবে `public/assets/dainik-ajker-diganta-logo.png`-এ রাখতে হবে; PNG source ও project copy-র SHA-256 মেলাতে হবে; opaque white-background JPG-কে substitute করা যাবে না।
- Responsive `<Image>`-এ intrinsic dimensions, aspect ratio, `object-contain`, stable sizing/priority এবং অর্থবহ Bengali alt/accessibility label দিতে হবে; narrow mobile-এ logo কেন্দ্রে, wider viewport-এ header-এর বাঁ দিকে দেখাতে হবে; header/footer render-এ missing asset/white rectangle/uncropped logo থাকা যাবে না।

### Responsive accessible hamburger navigation — `[x]`

- Header-এ 40px-class accessible hamburger button রাখতে হবে; open state-এ overlay/backdrop, `role="dialog"`, `aria-modal="true"`, Bengali dialog/close labels, visible close button এবং `aria-expanded`/`aria-controls` synchronization থাকতে হবে।
- Menu current valid routes ও active published category-ভিত্তিক হতে হবে; category-র active, undeleted published child links থাকলে সর্বোচ্চ দুই স্তরের expandable group দেখাতে হবে। Header-এ current horizontal primary nav, search, login/register এবং Bengali `lang="bn-BD"` semantics অক্ষত থাকতে হবে।
- Menu close হবে Escape, close button, backdrop click ও in-app link activation-এ; opening-এ dialog-এ focus যাবে, keyboard Tab/Shift+Tab focus dialog-এর ভেতরে থাকবে, close-এ trigger-এ focus ফিরবে এবং menu open অবস্থায় background body scroll বন্ধ থাকবে। Reduced-motion এবং দৃশ্যমান focus style মানতে হবে।
- 375px mobile ও 1280px desktop homepage screenshot-এ logo/search/hamburger/navigation দৃশ্যমান, logo PNG HTTP 200 (456,044 bytes), unchanged PNG SHA-256 verified; `pnpm typecheck`, `pnpm lint`, production `pnpm build`, 58 unit tests pass; 33 page route pattern manifest matched source exactly।

### DB-backed navigation admin/editorial tools — `[x]`

- Archive contract-এর `HEADER_MAIN` ও `HAMBURGER` menu; item `menuId`, `label`, safe `href`, nullable same-menu `parentId`, nullable `categoryId`, `sortOrder`, `isActive` নিয়ে existing schema/migrations-এর সঙ্গে additive, ordered migration করতে হবে; maximum nesting দুই স্তর, stable order, existing article/user/category data অক্ষত রাখতে হবে।
- `/admin/navigation` এবং `/api/admin/navigation` read/create, item update/soft-delete endpoints দরকার; server-side narrowly scoped permission, trusted-origin/CSRF, strict bounded schema, rate limiting, audit events, stale/invalid parent/category handling এবং private no-store behavior চাই। Archive-এর `SiteSetting`-only SQL-কে navigation migration বলে চালানো যাবে না।
- Public shell-এ active menu/item only query; DB menu failure/empty state-এ current valid `/`, `/latest`, `/video` এবং অন্যান্য existing navigation হারানো যাবে না। DB migration/test কেবল isolated local PostgreSQL/test DB-তে চালাতে হবে।

### Editable public site pages/footer and settings — `[x]`

- `SitePage`-এ `about`, `privacy`, `terms`-এর editable title/body ও safe Bengali default/fallback দরকার; public page renderer text escaped রাখবে, stored page title/description metadata policy মানবে এবং public read path DB row upsert/write করবে না।
- `SiteSetting`-এ approved footer publisher/editor/company/social/app/contact fields থাকতে পারে; strict allow-list validation, HTTPS URL rules, enabled link filtering ও documented defaults চাই। Archive-এ header logo/site name/tagline/theming-এর পূর্ণ CMS contract নেই—উপযুক্ত schema/UI scope অনুমান না করে current brand identity রাখবে।
- `/admin/site-content` ও API-তে authenticated server-side dedicated content-management permission, trusted-origin validation, strict Zod input, audit trail ও safe success/error states দিতে হবে। Provider secrets encrypted server-side থাকবে; raw values HTML/JSON/client props/log/chat-এ যাবে না; blank input existing secret erase/overwrite না করুক—policy test করতে হবে।

### Advertising/newsletter/contact submission handling — `[x]`

- Public advertisement/newsletter form requirement archive-এ থাকলে `ADVERTISEMENT`/`NEWSLETTER` type, bounded name/email/phone/subject/message, server-side validation, origin/rate-limit/abuse protection এবং clear Bengali success/error feedback দিতে হবে।
- Admin inbox/list/status/resolve behavior, role permissions, audit, PII masking/retention এবং any outbound email provider dependency documented/validated হতে হবে। Archive code-এ না-থাকা route/worker implement করতে হলে existing architecture অনুযায়ী new server code/test দিতে হবে। Real email send only provider credential/verified sender and authorized test থাকলে।

### Subscription এবং manual payment workflow — `[x]`

- Archive-এ দৃশ্যমান contract বাস্তবায়নের আগে price/duration/product benefits, payment ownership and status policy যাচাই করতে হবে: monthly `60 BDT`/`31 days`, yearly `612 BDT`/`365 days`; `NAGAD`, `BKASH`, `ROCKET` manual transfer; active configured gateway ছাড়া submission নয়; form-এ plan, method, name, phone, email, address, unique transaction ID; initial status `PENDING`; expiry `15 minutes` enforce করতে হবে।
- `/subscribe`, admin gateway manager, submission list এবং verify/reject endpoints/UI দরকার; server session থেকে user identity নিতে হবে; strict validation, IDOR protection, rate limit, PII redaction, audit, idempotent/atomic transition, duplicate transaction rejection, expiry enforcement, prior active subscription handling ও central entitlement policy আবশ্যক।
- Archive schema/service-এ অসম্পূর্ণ business/security workflow straight copy করে production-ready দাবি করা যাবে না। No gateway/account number/real charge, provider API, webhook, refund, recurring billing կամ auto-renewal without approved provider credentials/sandbox and explicit business authorization.

### Other archive QA and release gaps — `[ ]`

- Local user/role এবং audit viewer surface সম্পন্ন: `/admin/users`-এ permission-guarded directory; role/status mutation শুধু `SUPER_ADMIN`-এর জন্য, নিজের account বা অন্য `SUPER_ADMIN`-কে পরিবর্তন করা যায় না, এবং mutation-এর সঙ্গে audit event একই transaction-এ লেখা হয়। `/admin/audit` সর্বশেষ ১০০টি event-এর redacted read-only তালিকা দেখায়; raw metadata, payer তথ্য, request ID বা session secret প্রকাশ করে না। `users.manage`/`audit.read` permission, navigation link, static route manifest ও RBAC regression assertion যোগ হয়েছে; DB schema-তে নতুন migration লাগেনি।
- অবশিষ্ট release gate: Cloudflare Workers/Vinext suitability, staging migrations/backup-restore, real R2 upload, verified email, HTTPS/proxy-IP/CSP, monitoring, production DNS/database migration ও release approval। এগুলো authorized staging input ছাড়া local import task-এ করা হয়নি।
- Cloudflare Workers/Vinext `97% check` runtime compatibility প্রমাণ করে না; PostgreSQL/Hyperdrive, sharp/media pipeline, native argon2/Node APIs, R2/AWS SDK, auth, scheduled jobs ও all route-এর isolated runtime verification ছাড়া Cloudflare Workers deployment নয়। Existing Node/PostgreSQL deployment/config wholesale overwrite নয়।
- Staging migrations/backup-restore, real R2 upload/quarantine/finalize/delivery, verified email, HTTPS/proxy-IP, CSP, monitoring, production DNS/database migration ও release approval এই local project import task থেকে পৃথক এবং authorized staging inputs ছাড়া blocked। Production-ready/publicly deployed দাবি নয়।
- Feature outcomes complete হবে কেবল source/schema/API/UI/test evidence থাকলে; docs/zip-copy/archive QA report alone completion evidence নয়।


## 2026-10-22 continuation — category menus, account roles, workflow and footer `[x]` local implementation

- The original transfer was restored at HEAD `399dd2e`; no reset/clean/checkout/history rewrite/commit/remote/push occurred. The two intentional CMS-access deletions and all carried dirty files remain present. `.env` is private, ignored, mode 0600; only local PostgreSQL 16.15 dev/shadow/`_test` targets were used.
- Recovered the exact original menu tree from the preserved project-context seed: 14 root categories and 101 children (115 total). The local dev seed created 11 header items and 119 active hamburger items, with 124 category-backed hrefs resolving to category slugs. Category CRUD is guarded by `category.manage` for Admin/Super Admin only; editors retain tag management and read categories only. Menu edits are Admin-only, changes revalidate the public layout, and a deliberately empty menu stays empty. The create-only tree/menu seed does not reactivate or overwrite CMS-deactivated/edited records.
- `/dainik/ajker/diganta/s/a/boss` serves Admin/Super Admin login and `/d/a/d/my/staff` Reporter/Editor login. Neither route grants roles; the home page contains no newsroom-entry link. Public sign-up creates USER only. Admin/Super Admin can create USER/REPORTER/EDITOR/ADMIN, view the latest 100 nonremoved name/email/phone/role/status entries, change roles, freeze/reactivate (revoking sessions), and soft-remove/anonymize with self/last-admin/Super Admin protections and history retention.
- The separate Admin-only `/admin/subscribers` roster is limited to active/unexpired memberships and distinct from payment verification. It shows profile phone or decrypts a verified-payment phone on the server. Reporter submit/resubmit; Editor/Admin review, approve/reject, schedule/publish/cancel; Admin/Super Admin alone can soft-remove published stories.
- Shared public footer: full-width centered social section and Facebook/YouTube/Instagram/LinkedIn controls; Admin Site content can manage verified profile links and publisher/editor names. The requested verified-profile helper text is removed. `Developed by cyberpointsecurity` links to `https://cyberpointsecurity.com`. Names/profile URLs remain blank until authorized values are supplied; nothing is guessed.
- Added the nullable phone/deletedAt account migration and Prisma Client locally only; 16 migrations are present with none pending on dev or `_test`. No dependency or external provider was added/connected.
- Final validation passed: `pnpm typecheck`, `pnpm lint`, unit 84/84 (14 files), isolated integration 33/33 (14 files; only `ajker_diganta_test`), `pnpm build`, `pnpm db:seed`, `prisma migrate status`, and `git diff --check`. Preview smoke: all 16 representative public pages include the footer and return 200; both staff login routes and `/api/health` return 200.

### Still open / not claimed complete

The email/password pairs pasted into chat were not used, stored or tested. Treat those shared passwords as exposed and rotate them before real use; integration accounts use unique per-run random credentials and are cleaned from `_test`. Verified reset/invitation email, official social URLs and publisher/editor names, newsroom content for empty categories, and real provider-backed R2/CDN remain unconfigured. `User.phone` is not field-level encrypted, so review DB at-rest encryption, retention and legal/privacy requirements before live use. Staging migration and backup/restore, proxy/IP trust, least-privilege DB grants, CSP, broad accessibility/mobile/performance, monitoring, independent security review and explicit release approval remain deployment gates. No production/staging/shared DB, account connector, payment/provider, deployment or publication action occurred.


### Footer logo-label adjustment — 2026-10-22

Removed the duplicate Bengali text beside the footer logo while retaining the image link’s accessible label, the centered follow row, publisher/editor area and developer credit. `pnpm lint`, `pnpm typecheck`, `pnpm build`, local Preview `/api/health` (200), and homepage SSR checks passed; duplicate adjacent text is absent.
