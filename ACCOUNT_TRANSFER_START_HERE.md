# দৈনিক আজকের দিগন্ত — অন্য Manus account-এ কাজ পুনরারম্ভ

**Snapshot date:** 2026-10-22  
**Branch / commit:** `main` / `71649a5ef225adcbe69486046aa7f854a198bb86`  
**Private source repo:** `lelinchowdhury/ajker-diganta`  
**Project root after extraction:** `ajker-diganta/`

## এই export কী

এই ZIP-এ Git-এর বর্তমান `main` commit-এর **348টি tracked project file** আছে; source file-গুলো হুবহু commit থেকে নেওয়া, পরিবর্তন বা regenerate করা হয়নি। Transfer নির্দেশনাটি এই archive-এর জন্য আলাদা করে যোগ করা হয়েছে; repository-তে কোনো file যোগ বা edit করা হয়নি। ZIP-এ `.git` history নেই। একই history-সহ কাজ করতে হলে GitHub access থাকলে নিচের clone command ব্যবহার করুন।

`.env` কখনো খোলা, পড়া, scan, copy বা export করা হয়নি এবং archive-এ নেই। `.env.example` template হিসেবে আছে। Database data/dump, sessions, `node_modules`, `.next`, logs, keys ও runtime secrets archive-এ নেই। Git status-এ থাকা 5টি untracked reference item—4টি JPG ও 1টি unreviewed DOCX—এই safe snapshot-এ নেই।

Snapshot তৈরির ঠিক আগে local `main`, `origin/main` এবং GitHub `main` একই commit-এ ছিল; tracked worktree clean ছিল। ZIP-এর source state তাই GitHub-এর ওই commit-এর সঙ্গে মেলে।

## Account-এ import করার পর প্রথমে

1. ZIP-টি নতুন Manus account-এর workspace/task-এ import/extract করুন। Project folder `ajker-diganta/` হবে। Import শেষ হলে এই guide-টি আগে পড়ুন।
2. GitHub history রাখতে চাইলে একই GitHub owner account-এ private repository access/connector সক্রিয় করে নতুন workspace-এ clone করুন—ZIP folder-এ `.git` যোগ হয়েছে ধরে নেবেন না:

```sh
gh repo clone lelinchowdhury/ajker-diganta
cd ajker-diganta
git rev-parse --short HEAD
git status --short
```

Expected short commit: `71649a5`. `gh` auth না থাকলে নতুন token তৈরি বা chat-এ credential পাঠাবেন না; আগে account-এর GitHub connection নিরাপদে configure করুন। কেবল ZIP import করলে এটি source snapshot, Git repository/history নয়।

3. কাজ শুরুর আগে `TODO.md`, `FINAL_QA_REPORT.md`, `DEPLOYMENT.md`, `DATABASE.md`, `ENVIRONMENT.md`, `SECURITY.md` এবং এই guide পড়ুন। Source change-এর আগে ব্যবহারকারীর অনুমতি নিন; production deploy বা production/staging DB migration করবেন না।

## Local environment পুনর্গঠন

প্রয়োজনীয় version: Node.js `22.12+` (22.18+ recommended), `pnpm 11.25.0`, PostgreSQL 16+। Lockfile `pnpm-lock.yaml`; install-এ frozen lockfile ব্যবহার করুন। নতুন account-এর নিজস্ব Sandbox-এ environment setup করুন—পুরোনো account-এর database, sessions, `.env` বা Preview URL এই ZIP-এ নেই।

```sh
node --version
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
```

PostgreSQL-এ **fresh, local-only, disposable** databases তৈরি করুন:

- `ajker_diganta_dev` — `DATABASE_URL`
- `ajker_diganta_shadow` — `SHADOW_DATABASE_URL`
- `ajker_diganta_test` — `TEST_DATABASE_URL`; নাম অবশ্যই `_test` দিয়ে শেষ হবে

এগুলো production, staging বা shared database-এর সঙ্গে যুক্ত করবেন না। Database role/privilege ও migration policy-র বিস্তারিত `DATABASE.md`-তে আছে।

Database প্রস্তুত হলে local secret file তৈরি করুন; কোনো secret chat, Git বা project source-এ লিখবেন না:

```sh
cp .env.example .env
chmod 600 .env
openssl rand -base64 48
```

`openssl`-এর output শুধু local `.env`-এর `BETTER_AUTH_SECRET` field-এ বসান; output chat-এ পাঠাবেন না। `.env`-এ অন্তত সঠিক local `DATABASE_URL`, `SHADOW_DATABASE_URL`, `_test`-suffix-যুক্ত `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` এবং প্রযোজ্য হলে `PUBLIC_SITE_URL`/`ADDITIONAL_TRUSTED_ORIGINS` বসাতে হবে। Variable-গুলোর বর্ণনা `ENVIRONMENT.md`-তে আছে। Local DB-র জন্য `MIGRATION_DATABASE_URL` production release flow-এর বিকল্প নয়; staging/production value এখানে ব্যবহার করবেন না।

নতুন account-এর Preview origin পুরোনো account থেকে আলাদা হতে পারে। `BETTER_AUTH_URL`, `PUBLIC_SITE_URL`, trusted origins ও Preview origin সেট করার সময় নতুন account-এর **বর্তমান exact origin** ব্যবহার করুন; পুরোনো origin অন্ধভাবে কপি করবেন না। `next.config.ts`-এর development-origin allowlist নতুন Preview-এ বাধা দিলে source edit না করে থামুন এবং আলাদা অনুমতি নিন।

Dependencies install ও local DB প্রস্তুতির পরে:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
# কেবল fresh local ajker_diganta_dev + shadow DB প্রস্তুত হলে:
pnpm db:migrate
pnpm db:seed
```

`pnpm test:integration` চালানোর আগে `TEST_DATABASE_URL` অবশ্যই disposable `_test` database-এ নির্দেশ করছে নিশ্চিত করুন। তারপর local validation:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
```

Local Preview চালাতে:

```sh
pnpm dev --hostname 0.0.0.0 --port 3000
curl -fsS http://127.0.0.1:3000/api/health
```

এই server বা Preview URL অন্য Manus account-এ স্বয়ংক্রিয়ভাবে স্থানান্তরিত হয় না; নতুন account-এ server আবার চালাতে হবে।

## একই কাজের অবস্থান ও খোলা বিষয়

- Project snapshot: Next.js 16 App Router, TypeScript, Prisma 7.10, PostgreSQL, Better Auth ও TipTap; navigation, footer/CMS, user management এবং newsroom workflow-এর বর্তমান source এই commit-এ আছে।
- পুরোনো local DB/session/account এই export-এ নেই। TODO/QA-তে নথিভুক্ত অবস্থান অনুযায়ী Admin local account তৈরি ও role assignment করা হয়েছিল, কিন্তু interactive Admin sign-in এখনও verify করা বাকি; Reporter/Editor/Reader test accounts-ও নতুন local DB-তে তৈরি/verify করা বাকি। Chat-এ প্রকাশিত password পুনর্ব্যবহার করবেন না; credential entry secure local browser/form-এ করুন, chat-এ নয়।
- Local validation আগের Sandbox-এ পাস করেছিল: typecheck, lint, 84 unit tests, 33 isolated integration tests এবং production build। নতুন account-এ environment fresh হওয়ায় এগুলো আবার চালাতে হবে।
- Cloudflare Workers readiness audit (2026-10-22) **BLOCKED / NEEDS CHANGE**: বর্তমান scripts `next build --webpack` ও `next start`; Workers adapter/Wrangler setup নেই। Native `@node-rs/argon2`/`sharp`, Prisma/Hyperdrive, Better Auth, Workers bindings/secrets, R2 ও server-side TipTap runtime এখনও target Workers environment-এ যাচাই হয়নি। `vinext` নেই; dependency install বা deployment করা হয়নি। `DEPLOYMENT.md`-এর staging, backup/restore, provider, security, mobile/performance, monitoring gates-ও আলাদা release checks। Cloudflare-এ deploy করবেন না; adapter/dependency/source পরিবর্তনের আগে অনুমতি নিন।
- GitHub repository private। Repository access না থাকলে ZIP-এ থাকা current source commit-ই ব্যবহারযোগ্য snapshot; ZIP Git history যোগ করে না।

## Integrity / exclusions

Archive-এর source ফাইলগুলি current `main` commit থেকেই নেওয়া হয়েছে; imported account-এর fresh environment-এ শুধু `.env` ও database setup আলাদাভাবে তৈরি করতে হবে। ZIP-এর পাশে থাকা `.sha256` file দিয়ে download integrity যাচাই করা যাবে।
