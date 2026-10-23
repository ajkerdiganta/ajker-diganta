# Account Transfer & Resume Guide — দৈনিক আজকের দিগন্ত

**Snapshot date:** 2026-10-07  
**Project state represented:** Phases 1–8 implemented; security hardening, performance pass, production-preparation documentation, and local end-to-end QA completed. The current code includes the final QA reading-history fix. See `FINAL_QA_REPORT.md` for the precise passed tests and unresolved gates.

**Export file:** `ajker-diganta-project-export-2026-10-07.zip` (the SHA-256 sidecar is delivered alongside the ZIP, outside the archive).

## Important: what this export is (and is not)

The ZIP is a **source-code and project-context snapshot**, not a complete clone of the Manus account, deployed service, PostgreSQL instance, or credentials. It includes the source tree, package manifest and lockfile, Prisma schema and committed migrations, tests/scripts/docs, `.env.example`, and the supplied PRD/context files.

For safety, it deliberately excludes:

- `.env` and all credential values, auth/session secrets, API keys, passwords, and database connection strings;
- PostgreSQL dumps, production or test user rows, password hashes, sessions, and uploaded user data;
- `node_modules`, `.next`, generated Prisma client, TypeScript build cache, and other rebuildable outputs;
- the old account's Manus project settings, connector authorizations, project links, browser sessions, and account/project permissions.

No database dump is included. The Prisma schema and migrations provide the database **structure**; they do not reproduce existing data or user accounts. Do not send passwords, keys, or unencrypted database dumps in project chat or place them in this ZIP.

## Import into the other Manus account

1. **Download** `ajker-diganta-project-export-2026-10-07.zip` from this handoff and verify its SHA-256 against the value supplied alongside the download (or run `sha256sum -c ajker-diganta-project-export-2026-10-07.zip.sha256` if both files are downloaded together).
2. Sign in to the **destination Manus account**. In its Project section, create or select a project for দৈনিক আজকের দিগন্ত. Project membership, project settings, connectors, and credentials do not automatically transfer between separate accounts.
3. Add the ZIP as a project file/attachment, or open a task in the new project and attach it with this instruction: “Extract this source snapshot into the workspace; read `ACCOUNT_TRANSFER_GUIDE.md`, `README.md`, `FINAL_QA_REPORT.md`, and `DEPLOYMENT.md` before making changes. Preserve the current implementation and do not deploy or run migrations against production.”
4. In the destination task's Sandbox, extract into a clean workspace. Example:

   ```sh
   mkdir -p ~/ajker-diganta
   unzip ajker-diganta-project-export-2026-10-07.zip -d ~/ajker-diganta
   cd ~/ajker-diganta/ajker-diganta
   ```

   Depending on how the platform stages attachments, the ZIP may first need to be uploaded/downloaded into the task workspace. Do not overwrite an existing project checkout without first backing it up.
5. Recreate the target account's Manus Project instructions only if needed. This account's project had **no shared project files, links, or non-empty project instruction** to transfer; the durable handoff state is documented in this guide, README, phase reports, security/performance reports, deployment docs, and final QA report.
6. Have the destination agent verify the file list and SHA-256 before resuming work. The current snapshot should be treated as the baseline; do not rerun old temporary QA fixtures or cleanup scripts (they are intentionally absent).

## Set up a fresh local development environment

1. Provision a **new, isolated development PostgreSQL database**. Do not point local setup or integration tests at production. Create separate local development, shadow, and disposable `_test` databases/roles as described in `DATABASE.md`.
2. Copy the template and enter newly provisioned values through the destination account's approved secret manager or its private environment configuration:

   ```sh
   cp .env.example .env
   openssl rand -base64 48   # generate a fresh BETTER_AUTH_SECRET
   openssl rand -base64 48   # generate a separate fresh JOB_AUTH_SECRET
   ```

   Set `DATABASE_URL`, `SHADOW_DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_SITE_URL`, and optional email/R2 values. Keep the values private and do not commit `.env`. For production, configure a separate `MIGRATION_DATABASE_URL` only in the controlled release/migration job; follow `ENVIRONMENT.md` and `DEPLOYMENT.md`.
3. Install and validate using the versions in the manifest/lockfile:

   ```sh
   pnpm install --frozen-lockfile
   pnpm db:generate
   pnpm db:migrate
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm test:integration
   pnpm build
   ```

   Integration tests require a disposable database whose name ends in `_test`. Review `scripts/test-integration.ts` before changing environment configuration. Local `db:migrate` is for local development; use the documented staged `db:deploy` process in deployment environments.
4. Start `pnpm dev` only after the local database and environment are configured. Follow `README.md` for routes and setup.

## Users and role credentials

No user accounts, passwords, password hashes, sessions, or test accounts are included. The previous test credentials are not portable and should not be reused as production credentials.

To create a fresh test user, start the app and register through `/register`. For local administrative access, follow the guarded `pnpm admin:promote EMAIL --confirm EMAIL` procedure in `README.md`/`ADMIN_GUIDE.md` for a newly verified test account and only in the isolated development database. Create reporter/editor accounts and assign roles through the documented authorized admin workflow or the local seed procedure as appropriate. Use unique, strong passwords stored in the destination account's private credential store.

If existing application data truly must move, the current account owner must separately authorize and arrange a secure, encrypted, access-controlled database export/restore and any media-object transfer. That data transfer is intentionally not part of this ZIP; do not move production data or password hashes casually. Verify retention, user consent, data minimization, destination security, and restore integrity first.

## Resume point and remaining work

The destination account should resume from the current code baseline, not restart implementation phases. Start by reading, in this order:

1. `FINAL_QA_REPORT.md` — complete tested/passed/failed/unverified matrix and production blockers;
2. `DEPLOYMENT.md` and `ENVIRONMENT.md` — staging-first release requirements;
3. `SECURITY_AUDIT.md` — findings and deployment-dependent checks;
4. `PERFORMANCE_OPTIMIZATION.md` — prior measurements and limits;
5. `PHASE3-COMPLETION-REPORT.md` through `PHASE8-ADMIN-ANALYTICS-COMPLETION-REPORT.md`, plus `README.md` and `ADMIN_GUIDE.md`.

Key outstanding gates recorded in the final QA report include: staging migration/backup-restore verification, real R2 staging validation, deployed proxy/IP trust and database-grant verification, CSP rollout/assessment, broad mobile/field performance validation, and an explicit decision about the currently absent admin user-management and audit-log viewer surfaces. Do not claim production readiness until those gates are completed or explicitly accepted by the project owner. No deployment or production migration was performed for this handoff.
