# Ajker Diganta — বাস্তবায়ন পরিকল্পনা

## লক্ষ্য ও অনুমোদিত পরিধি

Dailydiganta project-এর অধীনে `Ajker Diganta` নামে আলাদা managed Webdev project-এ আপলোড করা Ajker Diganta ZIP-এর বিদ্যমান source baseline সেটআপ করা। বিদ্যমান feature, source structure, documentation, migrations, test suite ও Bengali-first UI সংরক্ষণ করতে হবে; নতুন করে ডিজাইন বা feature rewrite করা হবে না। ব্যবহারকারীর অনুমোদনে TXT-তে দেওয়া চারটি sample role account কেবল local development database-এ তৈরি ও role landing destination যাচাই করা হবে। কোনো production database, production credential, production migration বা public deployment এই কাজের অংশ নয়।

## বাস্তবায়ন ও runtime

- Source: `/home/ubuntu/workspaces/Dailydiganta/ajker-diganta`; managed project: `/home/ubuntu/ajkerdiganta`। Target-এর নিজস্ব `.git` অক্ষত রেখে source file কপি হবে। `.env`, dependencies, `.next`, generated Prisma client, build cache ও source `.git` কপি/commit করা হবে না।
- বিদ্যমান stack অপরিবর্তিত থাকবে: Node.js 22, pinned pnpm 11.25.0, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Better Auth, Prisma 7/PostgreSQL, TipTap ও বিদ্যমান test/migration scripts। Dependency install হবে lockfile অনুযায়ী; generated Prisma Client source schema থেকে তৈরি হবে।
- PostgreSQL 16 local Sandbox-এ চালু। `ajker_diganta_dev`, `ajker_diganta_shadow` ও `_test` suffix-যুক্ত `ajker_diganta_test` আলাদা database; `ajd_app` runtime-এ DML-only এবং `ajd_migrator` local migration/test setup-এ ব্যবহৃত। Private local `.env`-এর mode `0600`; secret values source control বা chat-এ যাবে না।
- Managed Webdev project-এর MySQL-compatible database capability ইতিমধ্যে চালু, কিন্তু PostgreSQL-নির্ভর source তার সঙ্গে compatible নয়। Source/run preview-এর জন্য local PostgreSQL ব্যবহার হবে; managed MySQL-এ migration বা data write করা হবে না। Production external PostgreSQL, R2, email provider, live users/data বা production deploy কনফিগার করা হবে না।
- Committed migration কেবল নতুন local development database-এ প্রয়োগ হবে। Test suite কেবল আলাদা `_test` database-এ চলবে। চার sample account Better Auth signup ও app role assignment দিয়ে local development database-এ তৈরি হবে; যাচাই হবে Admin → `/admin`, Reporter → `/admin/articles`, Editor → `/admin/review`, Reader → `/dashboard`। Password-গুলো কেবল local database-এ hash করা হবে; script/source, published environment বা chat-এ plaintext রাখা হবে না।
- সব page route থেকে `public/manus-routes.json` তৈরি করে dev server শুরুর আগেই স্থাপন করা হবে। Preview port 3000-এ existing `next dev` command ব্যবহার করবে; browser-facing path relative থাকবে। Cookie-based Preview auth-এর জন্য public HTTPS iframe-এ `SameSite=None; Secure` প্রয়োজন; plain HTTP local development আলাদা রাখতে হবে।

## Project structure

- `src/app/`: public সংবাদ, article/video, reader dashboard, newsroom/admin page ও API routes।
- `src/components/`, `src/lib/`, `src/types/`: বিদ্যমান UI, auth/RBAC, validation, database ও product logic।
- `prisma/`: PostgreSQL schema, committed migrations ও role/permission seed।
- `tests/`, `scripts/`: unit/integration checks, setup ও maintenance scripts।
- `public/`: existing static assets এবং generated route manifest।
- Root: pinned package manifest/lockfile, Next/TypeScript config, deployment/security/user guide ও project notes।

## Design ও brand

- **Movement:** বিদ্যমান contemporary Bengali digital-newspaper/editorial design-ই reference; redesign নয়।
- **Core principles:** বাংলা পাঠযোগ্যতা, সংবাদকে অগ্রাধিকার, role-specific newsroom workflow, accessibility ও responsive layout।
- **Color philosophy:** source CSS-এর বর্তমান সংবাদমাধ্যম palette অক্ষত থাকবে; নতুন brand-color বা theme override যোগ হবে না।
- **Layout paradigm:** বিদ্যমান public article/news hierarchy, category/video listing ও পৃথক admin surfaces বজায় থাকবে।
- **Signature elements:** source-এ থাকা headline hierarchy, category labels ও article/media cards অপরিবর্তিত।
- **Interaction philosophy:** বর্তমান sign-in/session, reader action ও server-side role authorization ব্যবহার; test bypass নয়।
- **Animation:** বিদ্যমান motion থাকলে সংরক্ষণ; নতুন animation যোগ হবে না।
- **Typography:** বিদ্যমান Noto Sans Bengali ও Noto Serif Bengali font setup অনুসরণ।
- **Brand essence:** বাংলাদেশের বাংলা পাঠকের জন্য Bengali-first news destination; স্বভাব—সংবাদমুখী, স্পষ্ট, নির্ভরযোগ্য।
- **Brand voice:** বিদ্যমান Bengali editorial copy বজায়; উদাহরণ: “সর্বশেষ সংবাদ” এবং “বিস্তারিত পড়ুন”।
- **Wordmark/logo:** ZIP-এ থাকা site branding অক্ষত; এই কাজের মধ্যে logo redesign নয়।
- **Signature brand color:** বিদ্যমান stylesheet-এ নির্ধারিত রঙই থাকবে; নতুন রঙ অনুমান করে নির্ধারণ করা হবে না।

## সম্পূর্ণ workflow ও সীমা

1. Source, transfer guide ও বর্তমান project state মিলিয়ে target-এর user/concurrent পরিবর্তন অক্ষত রেখে import।
2. Lockfile-ভিত্তিক dependency install; Prisma generation; local-only migrations ও role/permission seed; privacy-preserving four-role fixture setup।
3. Source clause অনুযায়ী unit/integration/type/lint/build checks; preview dev server start; `GET /manus-routes.json`-এর JSON ও health/page response যাচাই।
4. Source snapshot-এ `FINAL_QA_REPORT.md`-এ লেখা অসম্পূর্ণ production gates অপরিবর্তিতভাবে নথিভুক্ত থাকবে। Preview/checkpoint production sign-off নয়। User-এর পৃথক নির্দেশ ছাড়া publish বা production migration হবে না।


## 2026-10-20 নতুন ZIP থেকে যোগ করা কাজের পরিকল্পনা

### Archive handling ও preservation

`ZIPextractকরেcleanworkspace-এrepositoryচালুকরা.zip` নিরাপদে যাচাই করে `project-context/imported-zip-2026-10-20/`-এ 85টি non-secret file reference হিসেবে যোগ করা হয়েছে। Existing source-path overwrite করা হয়নি; manifest-এ প্রত্যেক imported path/size/hash আছে। `.env`, `.dev.vars`, `pasted_content.txt` এবং account/debug credential-সম্পর্কিত scripts project source-এ কপি বা execute করা হয়নি। Imported ZIP source/config/report-কে executable বা authoritative ধরে current code wholesale replace করা যাবে না।

### এখনকার local implementation

- Archive-এর transparent Bengali logo PNG (1600×533) `public/assets/dainik-ajker-diganta-logo.png`-এ রাখা হয়েছে; header ও footer-এ responsive Next.js Image, meaningful Bengali alt text ও stable aspect ratio ব্যবহার করতে হবে। Opaque JPG নয়।
- Current public header-এ published top-level/child category data থেকে accessible hamburger dialog/drawer দেখানো হবে; existing article/category/video/about/dashboard/login/register routes ও responsive primary nav সংরক্ষিত থাকবে। Escape, close/backdrop/link, focus management, scroll locking, `aria-expanded` ও reduced-motion support আবশ্যক।
- Data-backed `NavigationMenu` schema/report-এ conflicting evidence আছে এবং বর্তমান checkout schema-তে নিশ্চিত নয়; তাই schema/API/menu migration verify না করে archive `SiteShell`, seed বা navigation manager চালানো যাবে না।

### পরবর্তী independently deliverable feature phases

1. **Navigation persistence/admin:** isolated DB/migration evidence-এ models নিশ্চিত/যোগ, safe URL/two-level hierarchy validation, admin CRUD/soft-delete, dedicated least-privilege permission, audit logging, active-only deterministic public rendering, error fallback ও tests।
2. **Editable site content/footer:** additive SitePage/SiteSetting/submission models/migrations, read-only public pages with fallback, admin page/API/allow-list permissions, encrypted server-side secrets, no public-request upsert, privacy-safe submission inbox, rate-limit/audit/retention।
3. **Advertising/newsletter:** validated public forms ও admin inbox/status flow—PII access control ও abuse prevention সহ।
4. **Subscription/manual payment:** archive contract business approval সাপেক্ষে; monthly/yearly amounts/durations, configured transfer instructions, authenticated ownership, unique transaction ID, atomic pending→verified/rejected, expiry/entitlement policy, admin authorization/audit/redaction। Provider API, real account/payment, webhook/refund/recurring billing external credentials ও separate explicit authorization ছাড়া নয়।
5. **Optional admin/release evidence:** user/role management ও audit-log viewer archive/current QA gap; staging backup/restore, email, R2, CSP/proxy, monitoring ও production deployment এই local task scope নয়।

### Project structure additions

- `project-context/imported-zip-2026-10-20/`: untrusted ZIP-এর inert source/docs/assets reference ও `IMPORT_MANIFEST.md`; এখান থেকে source files সরাসরি build/runtime-এ imported হয় না।
- `public/assets/`: ব্যবহারযোগ্য checked static identity asset।
- `src/components/layout/hamburger-menu.tsx`: keyboard-accessible responsive drawer; inputs current DB-backed public category routes থেকে তৈরি।
- `src/components/layout/site-shell.tsx`: current header/footer, existing categories, brand image හා menu সংযোগ।
- `ZIP_IMPLEMENTATION_AUDIT.md`: evidence-based feature matrix, risks, implementation order ও external/release blockers।
