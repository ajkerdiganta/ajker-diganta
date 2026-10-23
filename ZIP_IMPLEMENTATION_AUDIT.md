# ZIP Implementation Audit

## ১. Executive summary

এই প্রতিবেদনটি কেবল সরবরাহ করা স্বাধীন archive-audit ফলের synthesis; কোনো archive script চালানো, অতিরিক্ত ফাইল পরিদর্শন, package/network ব্যবহার, database migration/seed, source edit বা production action করা হয়নি। বর্তমান `/home/ubuntu/ajkerdiganta`-এ core newsroom, reader, auth/RBAC, search, video, analytics এবং Bengali public shell বিদ্যমান। কিন্তু archive-এ বর্ণিত নতুন feature bundle—আসল Ajker Diganta logo, accessible responsive hamburger navigation, persisted/admin-managed navigation, editable site content/footer, advertising/newsletter submission এবং subscription/payment—বর্তমান project-এ সম্পূর্ণভাবে wired নয়।

সবচেয়ে নিরাপদ সিদ্ধান্ত হলো archive code বা schema wholesale copy না করে current source-এর উপর additive, reviewed implementation করা। Branding ও local hamburger UI আগে করা যায়; DB-backed navigation, site-content CMS এবং subscription/payment-এর আগে schema, migration order, permission boundary, ownership এবং test database-এ validation প্রয়োজন।

একটি গুরুত্বপূর্ণ evidence conflict আছে: একটি navigation audit current Prisma schema-তে `NavigationMenu`/`NavigationMenuItem` থাকার কথা বলেছে, কিন্তু পরবর্তী current-project inventory এবং backend/product audits একই project-এ এই model/table অনুপস্থিত বলেছে। সরবরাহিত latest/current-source evidence-কে অগ্রাধিকার দিয়ে এই প্রতিবেদনে model-গুলোকে **runtime-এ নিশ্চিত নয়/অনুপস্থিত ধরে** migration-এর আগে verification-gated রাখা হয়েছে; archive seed বা footer-only migration-কে navigation migration ধরা যাবে না।

**মূল audit অবস্থা:** core application চালু থাকার evidence ছিল, কিন্তু archive feature parity বা production readiness প্রমাণিত ছিল না। 2026-10-20-এ audited branches-এর কিছু অংশ local source-এ additiveভাবে implementation শুরু/সম্পন্ন হয়েছে; নিচে current status যুক্ত করা হয়েছে। এটি production approval নয়।

## ২. Archive inventory এবং safe exclusions

### পর্যালোচিত archive evidence

স্বাধীন audit-গুলোতে নিম্নের evidence family এসেছে:

- Public shell, `site-shell`, hamburger UI, Bengali branding assets (`dainik-ajker-diganta-logo.png`/`.jpg`) এবং mobile screenshots।
- Navigation manager/service, navigation schema/seed এবং menu CRUD contract।
- Editable `SitePage`, `SiteSetting`, footer/contact submission schema, manager, validation এবং encryption design।
- Subscription modal/manager/service/schema, manual Nagad/BKASH/ROCKET payment workflow ও plan rules।
- Prisma schema/migration/seed, Better Auth, RBAC/authorization, environment validation, CMS helpers এবং tests।
- Product/QA/deployment reports, route manifests, Cloudflare/Vinext candidates, current README/QA/architecture evidence।

### নিরাপদভাবে বাদ রাখা হয়েছে

- Secret, credential, `.env`/`.dev.vars`, provider account value, payment account number, debug/provisioning file বা sensitive runtime data কোনোভাবেই ব্যবহার/প্রকাশ করা হয়নি।
- Archive-এর code, seed, migration, config বা deployment report-কে executable authority ধরা হয়নি।
- Archive-এর `প্রথম আলো`/`prothomalo.com` screenshot branding, external labels, notification prompt বা external logo Ajker Diganta implementation-এর অংশ নয়।
- Cloudflare Workers/Vinext-এর static checker percentage runtime compatibility বা production approval নয়।
- Archive QA pass-কে current project-এর pass ধরা হয়নি; relevant integration-এর পর current tree-তে পুনরায় পরীক্ষা লাগবে।
- Subscription archive-এর schema/service-কে end-to-end payment product ধরা হয়নি; reader page, API, authorization, expiry/idempotency এবং provider integration অসম্পূর্ণ।
- Legal/privacy copy, business pricing approval, gateway credentials, production identity/copy এবং exact menu labels product approval ছাড়া অনুমান করা হয়নি।

## ৩. Feature-by-feature current coverage এবং exact missing work

### ৩.১ Branding ও mobile header/hamburger — **P0 missing integration**

**বর্তমান coverage:** Current shell-এ Bengali brand text/rounded `দ` mark, tagline/time bar, search/login/register, category-derived horizontal navigation, Bengali fonts, `lang="bn-BD"`, focus-visible ও reduced-motion support আছে। Existing routes হিসেবে `/`, `/latest`, category routes, `/video`, `/about`, `/dashboard`, `/search`, `/login`, `/register` এবং অন্যান্য reader/admin surface evidence-এ আছে।

**সুনির্দিষ্ট ঘাটতি:** Current public header archive PNG ব্যবহার করে না; `public/assets/dainik-ajker-diganta-logo.png` উপস্থিতির evidence নেই। Current shell-এ hamburger trigger, drawer/dialog, backdrop, nested accordion বা DB menu consumption নেই। Archive PNG-এর reported intrinsic size 1600×533, RGBA transparency এবং প্রায় 3:1 ratio; একই dimensions-এর JPG opaque near-white background বহন করে, তাই JPG branding fallback নয়।

**প্রয়োজনীয় কাজ:** Approved PNG-কে অপরিবর্তিত binary হিসেবে `public/assets/dainik-ajker-diganta-logo.png`-এ রাখা; `next/image`-এ intrinsic dimensions, Bengali alt/accessible name, `object-contain`, `priority` ও stable sizing দেওয়া। Mobile-এ centered responsive logo, search/hamburger/compact নিবন্ধন; medium viewport-এ left-aligned logo/login; wider viewport-এ existing search/login/register semantics বজায় রাখা। Current valid routes না ভেঙে client hamburger component যোগ করতে হবে। `aria-expanded`, `aria-controls`, `role="dialog"`, `aria-modal`, close button, backdrop/X/link close, Escape, focus placement/return, body scroll behavior এবং reduced-motion hardening archive code-এর বাইরে required completion।

### ৩.২ Navigation persistence ও admin management — **P0, schema/API verification-gated**

**বর্তমান coverage:** Static category-derived navigation এবং taxonomy/admin patterns আছে। `cms-api`-ধাঁচের authentication, trusted-origin, bounded JSON, permission/error helpers এবং audit infrastructure আছে। Archive contract-এ `HEADER_MAIN` ও `HAMBURGER` menu, item `menuId`, `label`, `href`, nullable `parentId`/`categoryId`, `sortOrder`, `isActive`, two-level tree, CRUD ও soft-delete বলা হয়েছে।

**সুনির্দিষ্ট ঘাটতি:** Current source evidence-এ `/api/admin/navigation`, `/admin/navigation`, `navigationItemSchema`, navigation-specific permission এবং test coverage নেই। Current schema-তে navigation model থাকার একটি conflicting audit আছে; অন্য latest/current inventory-তে তা অনুপস্থিত বলা হয়েছে। Live schema/migration state supplied evidence-এ নিশ্চিত নয়। Archive footer-only `migration.sql` navigation DDL নয়।

**প্রয়োজনীয় কাজ:** Current DB/schema verification-এর পর কেবল additive migration-এ menu/item table, indexes, FK, seed এবং generated client যুক্ত করা; existing Article/Category/user data অক্ষুণ্ণ রাখা। Strict server validation: NFC-trimmed Bengali label, bounded length, UUID/null, integer ordering, boolean active, safe internal `/...` বা অনুমোদিত `https://` href; `javascript:`, control-character, malformed/protocol-relative URL প্রত্যাখ্যান। Parent একই menu-র, self-parent নয়, সর্বোচ্চ দুই স্তর। Active menu/item ও deterministic `sortOrder`/label ordering public query-তে বজায় রাখা।

`GET/POST /api/admin/navigation` এবং item `PATCH/DELETE`-এ authenticated principal, narrowly scoped `navigation.read/manage` বা approved equivalent, trusted origin, rate limit, bounded JSON, audit event এবং `Cache-Control: private, no-store` দরকার। Parent soft-delete হলে direct child inactive করা, stale parent/category policy এবং cross-menu move policy স্পষ্ট করতে হবে। Empty/error হলে public fallback হিসেবে বর্তমান valid links—অন্তত `/`, `/latest`, `/video`—হারানো যাবে না।

### ৩.৩ Editable site content, footer ও submissions — **P0 missing**

**বর্তমান coverage:** `/about`, `/privacy`, `/terms` hardcoded; footer/header identity ও links hardcoded। Current admin newsroom pages আছে, কিন্তু site-content admin surface নেই। সাধারণ auth/RBAC/audit helper আছে।

**সুনির্দিষ্ট ঘাটতি:** `SitePage`, `SiteSetting`, `FooterSubmission`, `ContactSubmission` এবং সংশ্লিষ্ট relations/current DB table নিশ্চিত নয়। `/admin/site-content`, `/api/admin/site-content`, public verified submission POST, inbox/resolve flow নেই। Archive manager client-only; archive `getSitePage` public read path-এ upsert করে—production public request-এ mutation করা নিরাপদ নয়। Header logo/site name/tagline/theme edit করার পূর্ণ contract archive evidence-এ নেই।

**প্রয়োজনীয় কাজ:** Additive, dependency-ordered schema/migration-এ approved `SitePage`/`SiteSetting`/submission model যোগ; missing `SiteSetting`-এর উপর সরাসরি `ALTER TABLE` নয়, আগে table creation। Admin server page-এ `admin.access` এবং আলাদা narrowly scoped content-manage permission; mutation-এ strict Zod allow-list, trusted origin, audit, secret omission-on-blank semantics। Provider secret কেবল encrypted server-side storage; raw secret client props, HTML, JSON বা logs-এ নয়।

`/about`, `/privacy`, `/terms`-এ read-only DB consumer, safe fallback, newline paragraph rendering, escaped text এবং stored metadata policy (`generateMetadata`) যুক্ত করতে হবে। Public read-এ upsert নয়; initialization migration/seed-এ। Footer-এ publisher/editor/company/social/store links-এর validated, enabled-only rendering এবং safe external-link behavior। Advertising/newsletter forms-এ strict type (`ADVERTISEMENT`/`NEWSLETTER`), name/email/phone/message bounds, rate limit, PII authorization, status/resolve/audit ও retention policy চাই।

### ৩.৪ Subscription ও manual payment — **P0/P1 product work, real payment blocked**

**বর্তমান coverage:** Authenticated users, saved/favourite article, history ও notifications-এর ভিত্তি আছে। Subscription schema, route, permission, env/provider SDK, `/subscribe`, admin manager/API—কোনোটির current evidence নেই।

**Archive contract:** Monthly 60 BDT/31 days এবং yearly 612 BDT/365 days; Nagad/BKASH/ROCKET manual transfer; submission-এ plan, method, customer/contact/address/transaction ID; configured active gateway ছাড়া submit নয়; initial PENDING, admin approve/reject, active subscription expiry, prior active expiry।

**সুনির্দিষ্ট ঘাটতি ও ঝুঁকি:** Archive-এ পূর্ণ reader page/API নেই। Verify flow-এ expiry cutoff, concurrent retry/idempotency, duplicate transaction, refund/cancellation/renewal, amount snapshot, ownership, verifier relation ও retention policy অসম্পূর্ণ। Payment PII ও transaction identifiers raw exposure-এর ঝুঁকি আছে। Existing permission catalog-এ subscription management permission নেই; client label security boundary নয়।

**প্রয়োজনীয় কাজ:** Business approval-এর পর additive enums/models/indexes/relations ও test migration; authenticated session থেকে `userId`, client payload থেকে নয়। Strict form validation, active gateway check, unique transaction ID, rate limit, atomic pending→active/rejected transition, 15-minute submission expiry enforcement, concurrent verification guard, prior-active expiration, verifier audit। একটি central entitlement policy দিয়ে saved/favourite/notification-এর কোন benefit gated হবে নির্ধারণ। Admin-only PII redaction, IDOR protection, audit এবং retention।

**অবস্থা:** Provider API, webhook/signature, reconciliation, refund, invoice, recurring billing/auto-renewal বা real charge এই report-এর scope-এ complete নয় এবং credentials/sandbox ছাড়া blocked। Manual workflow-ও production-ready নয় যতক্ষণ উপরোক্ত controls ও business policy অনুমোদিত না হয়।

### ৩.৫ Backend security, migration ও test posture — **cross-cutting dependency**

**বর্তমান coverage:** Better Auth, Argon2, session revocation, trusted origins, rate limit, RBAC, article/media workflow, audit writes, PostgreSQL/Prisma এবং core tests-এর evidence আছে। Current QA-তে typecheck/lint/build এবং core unit/integration pass-এর report আছে।

**সুনির্দিষ্ট ঘাটতি:** Archive schema current schema-এর সঙ্গে collision-prone; archive migration প্রথমে অনুপস্থিত `SiteSetting` alter করে fail করতে পারে। Archive seed category/menu/permission rows বদলাতে পারে, transaction/idempotency ও stale data policy অনিশ্চিত। Archive `permissions.ts`-এর broad `EDITOR` grant blindly নিলে privilege expansion হবে; current auth-এ preview cookie behavior-ও wholesale overwrite-এ regress করতে পারে। **Local implementation complete (2026-10-20):** `/admin/users` permission-guarded directory, SUPER_ADMIN-only role/status controls, protected SUPER_ADMIN/self safeguards ও transactional audit event; `/admin/audit`-এ সর্বশেষ 100টি redacted event-এর read-only view। Permission catalog seed-এ additiveভাবে `users.manage`/`audit.read` আছে; schema/migration পরিবর্তন দরকার হয়নি।

**প্রয়োজনীয় কাজ:** Existing migrations edit নয়; reconciled target schema, additive dependency order, fresh/existing DB dry-run, generated client/typecheck, backup/rollback plan। `auth.ts`, authorization, env, prisma helpers wholesale replace নয়; current behavior preserve। Seed isolated/idempotent/controlled upsert; role/permission diff review; custom grants cleanup নয় unless explicitly approved। New route-এর জন্য 401/403, trusted-origin/CSRF, rate-limit, IDOR, audit, secret redaction এবং no-store tests।

### ৩.৬ Product route parity ও QA evidence — **P0/P1 evidence gap**

Archive route manifest-এ `/advertising`, `/newsletter`, `/subscribe` আছে বলে audit-এ উল্লেখ করা হয়েছে; current route tree/manifest-এ এগুলো অনুপস্থিত। এগুলো প্রয়োজন হলে Bengali public UI, validation, submit flow, auth/redirect, admin inbox এবং route manifest update করতে হবে। Existing core routes ও current valid auth behavior অক্ষুণ্ণ রাখতে হবে।

User-management ও audit-log viewer এখন local source-এ বাস্তবায়িত; local route/role behavior-এর validation সম্পন্ন না হওয়া পর্যন্ত release gate হিসেবে গণ্য থাকবে। Reporter/editor walkthrough, real video playback, all-route mobile visual, external email, fuzzing এবং production operational checks archive/current QA-তে অসম্পূর্ণ বা unverified—এগুলো নতুন feature হিসেবে অনুমান নয়, release evidence gate হিসেবে document করতে হবে।

### ৩.৭ Cloudflare/Vinext/operations — **non-local, explicitly blocked**

Current baseline Node.js 22 + PostgreSQL/Prisma/pg/PrismaPg + native Argon2 + sharp। Archive candidates-এ Workers/Vinext config থাকলেও Hyperdrive/Workers-compatible DB path, native module compatibility, sharp/image finalize, R2, auth cookie, scheduler এবং all API behavior প্রমাণিত নয়। `sharp`-কে empty stub দিয়ে alias করা correctness/security solution নয়।

বর্তমান evidence অনুযায়ী production domain পুরোনো PHP app serve করে; staging DB/R2/email/Cloudflare/DNS/WAF/monitoring/backup access নেই। তাই local branding/menu work করা গেলেও Cloudflare production cutover, DNS/WAF/cache, Workers runtime, R2/Resend integration, edge IP trust, CSP, restricted DB grants ও deployment করা যাবে না।

## ৪. Prioritized implementation order এবং dependencies

1. **Source-of-truth এবং scope freeze:** Current schema/migration state, route tree, approved logo binary, business identity/copy, exact menu labels এবং feature acceptance আলাদা করে অনুমোদন করুন। Navigation model conflict resolve না হওয়া পর্যন্ত existing model উপস্থিত ধরে code লিখবেন না।
2. **Local P0 branding:** Approved transparent PNG স্থাপন/verify; current `SiteHeader`-এ responsive `next/image`, Bengali alt, stable sizing এবং existing routes/labels বজায় রেখে visual regression করুন। JPG/placeholder fallback নয়।
3. **Local P0 hamburger:** Existing category/static links থেকে deterministic menu pass করুন; accessible dialog/backdrop/accordion, Escape, focus return, link close, reduced-motion এবং narrow viewport scroll যোগ করুন। প্রথম ধাপে DB migration না করে current valid routes রক্ষা করুন।
4. **Schema decision and migration design:** Navigation, site-content/footer এবং subscription কোনগুলো সত্যিই launch scope—তা নির্ধারণ; তারপর additive Prisma design, enum/model/relation/index diff, fresh/existing DB dry-run, rollback plan। Footer-only archive SQL reuse নয়।
5. **Navigation backend/admin:** Schema থাকলে strict schema, safe href/tree validation, `navigation.read/manage`, CRUD, soft-delete, audit, deterministic public queries, fallback, `/admin/navigation` এবং `/api/admin/navigation`। Seed আগে diff/backup/idempotency review।
6. **Editable content/footer:** SitePage read-only public consumer, safe fallback/metadata; SiteSetting/footer rendering; server-only encrypted provider settings; admin mutation with allow-list/audit; advertising/newsletter submission abuse controls।
7. **Subscription MVP, only after business approval:** Plan/benefit policy, schema/API, ownership, transaction uniqueness, atomic verification, expiry/idempotency, permission, redaction and tests; real gateway automation আলাদা পর্ব।
8. **Cross-cutting QA and release gate:** Current auth/RBAC/article/media/SEO regression-এর সঙ্গে নতুন feature tests; route manifest reconcile; local build/typecheck/lint/test; তারপর isolated staging operational checks।
9. **সম্পন্ন—local P1:** User/role management এবং read-only audit viewer; `/admin/users` ও `/admin/audit` source surfaces, role policy ও route manifest যোগ করা হয়েছে। External deployment/production verification এখনও আলাদা release gate।
10. **Cloudflare/production:** Compatibility branch ও disposable/staging environment-এ প্রমাণ ছাড়া current Node origin বদলানো নয়।

## ৫. Local-only validation

এই review scope-এ কেবল local, non-destructive validation পরিকল্পনাযোগ্য:

- Asset: approved path-এ PNG response/load, `image/png`, 1600×533, transparent corners, no white rectangle, sharp/untrimmed responsive rendering।
- Responsive: 320/375/719/768/1024px-এ centered/left logo state, search/hamburger/registration/login visibility, horizontal navigation clipping/scroll, no layout shift।
- Accessibility: Bengali accessible names, `aria-controls`, `aria-expanded`, dialog/aria-modal, keyboard tab order, focus-visible, Escape, backdrop/X/link close, focus return/trap, reduced-motion এবং background scroll behavior।
- Public routes: existing `/`, `/latest`, `/video`, `/search`, `/login`, `/register`, category routes এবং approved new routes-এ no broken links; auth redirects অপরিবর্তিত।
- Schema/migration (শুধু isolated test DB-তে): Prisma validate/generate, migration status, fresh database apply, second-run/idempotency, expected indexes/FKs/relations, no existing-row loss, seed diff and rollback evidence।
- Navigation: active filtering, root/child/two-level constraints, inactive/category behavior, deterministic order, API 401/403/400/404/rate-limit, audit event, no-store।
- Site content: stored/fallback page rendering, metadata, newline paragraphs, escaped text, invalid-field rejection, blank secret preservation, no secret in HTML/JSON/logs, footer enabled filtering, submission validation/rate-limit/PII authorization।
- Subscription fixture only: fake gateway/test data, PENDING→ACTIVE/REJECTED/EXPIRED, 15-minute cutoff, duplicate/concurrent verify, previous active expiry, ownership/IDOR, redacted admin responses, no real payment or account value।
- Regression: Current project’s established typecheck/lint/test/build/integration checks এবং route manifest consistency; archive pass counts current completion evidence হিসেবে ব্যবহার নয়।

## ৬. Explicitly blocked items

নিম্নের বিষয়গুলো completion হিসেবে দাবি করা যাবে না:

- **Real payments বা financial activation:** real Nagad/BKASH/ROCKET account, live charge, payment gateway API, webhook/signature, reconciliation, refund, invoice, recurring billing বা auto-renewal—business approval, official sandbox/credentials, threat model ও test vectors ছাড়া blocked।
- **Third-party credentials/provider integration:** Resend, R2, Cloudflare, payment provider, external email বা storage credentials পড়া, import, commit, configure বা validate করা হয়নি এবং করা যাবে না।
- **Cloudflare runtime/production access:** Workers/Vinext deployment, Hyperdrive/remote PostgreSQL, DNS/WAF/CDN/cache cutover, R2, edge IP trust, production domain switch, monitoring, backup/restore, CSP enforcement ও production migration blocked। Static Vinext checker result approval নয়।
- **Database deployment:** Archive migration/seed সরাসরি current/shared/production DB-তে চালানো blocked; `SiteSetting` prerequisite, missing model/table, permission drift, FK/index এবং generated client আগে reconciled হতে হবে।
- **Exact product copy and policies:** gateway account numbers, publisher identity, legal/privacy approval, refund/cancellation/renewal/support policy, exact menu labels এবং benefit paywall অনুমান করা হয়নি।
- **Feature completion claim:** supplied archive QA, menu CRUD pass, deployment report বা production report current project-এ reproduced নয়; implementation-এর পরে current project-এ পুনরায় validation বাধ্যতামূলক।

**উপসংহার:** নিরাপদ immediate deliverable হলো local approved-logo integration এবং current routes-ভিত্তিক accessible hamburger UI। DB-backed menu/CMS/subscription এবং any production/cloud deployment হলো পরবর্তী dependency-gated work; এগুলো সম্পন্ন হয়েছে বলা যাবে না।


## Current-tree continuation — 2026-10-22

This supplement updates status without replacing the ZIP-era analysis above. The exact archived category hierarchy is restored: 14 roots and 101 subcategories, with 11 header items and 119 active hamburger items. Category create/edit/remove is server-restricted to Admin/Super Admin; editors retain tag management. Category/menu mutations invalidate public navigation caches; create-only seeding preserves existing deactivated or CMS-edited rows.

Protected staff login routes are `/dainik/ajker/diganta/s/a/boss` (Admin/Super Admin) and `/d/a/d/my/staff` (Reporter/Editor); role authorization remains server-side, and the home page has no newsroom-entry link. Admin/Super Admin can provision USER/REPORTER/EDITOR/ADMIN; public signup remains USER-only. The Admin directory supports phone/contact visibility, role changes, freeze/session revocation and soft removal with safeguards. Active subscribers are listed separately from payment verification. Reporter submission and Editor/Admin review/publication/cancel workflow is tested; published-story deletion remains Admin-only.

The centered public social footer supports Admin-managed publisher/editor names and official profile links, removes the requested helper copy, and links `Developed by cyberpointsecurity` to `https://cyberpointsecurity.com`. Missing profile names/URLs remain blank rather than guessed. Local Preview smoke checks returned 200 for 16 public routes, both staff login pages and `/api/health`.

One additive phone/deletedAt migration was applied only to local PostgreSQL 16.15 dev and isolated `_test`; 16 migrations have no pending status on those targets. `pnpm typecheck`, `pnpm lint`, unit 84/84, integration 33/33, `pnpm build`, `pnpm db:seed`, and `git diff --check` pass. The user’s chat-supplied passwords were not used or persisted. Verified email, official profile/display names, empty-category content, phone PII encryption/retention, staging backup/restore, real R2/CDN, production proxy/DB grants, CSP, accessibility/performance, monitoring, independent security review and release approval are still open; no production action was taken.
