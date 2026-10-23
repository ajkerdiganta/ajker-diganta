# Database Operations — PostgreSQL

## Supported database

PostgreSQL 16+ using UTF-8 databases and the committed Prisma schema/migrations. Bengali Unicode is stored as text without lossy collation conversion. Store event timestamps as `timestamptz`; do not persist localized `bn-BD` date strings. The UI converts these to `Asia/Dhaka` at presentation time.

## Credentials and privileges

Use three separate identities:

| Credential | Purpose | Privileges |
|---|---|---|
| `DATABASE_URL` | Long-lived app process | Only application DML/sequence/required routine privileges; no schema creation/alteration or superuser |
| `MIGRATION_DATABASE_URL` | Controlled staging/release migration job and trusted operator utilities | Schema-owner privileges needed by Prisma migrations; injected only into the deployment job, not app runtime |
| `SHADOW_DATABASE_URL` | Local Prisma schema diff/development only | Isolated disposable shadow database; never production |

`TEST_DATABASE_URL` points to a separate disposable integration database whose database name ends in `_test`; the test runner rejects other database names. Never point local commands or integration tests at production. Use TLS in managed environments (`sslmode=require` at minimum; prefer provider-supported certificate verification). Rotate credentials when staff/automation access changes.

## Migration policy

Committed migrations live in `prisma/migrations`. They are applied with `prisma migrate deploy`; do not use `migrate dev`, `db push`, reset, or schema-diff commands against staging/production. Changes should be additive and reviewed for lock duration, data volume, default/backfill cost, rollback behavior, and extension permissions. The runtime role must not have DDL privileges. For large live tables, plan index changes for a measured maintenance window; the current search migration uses ordinary GIN index creation, not `CONCURRENTLY`.

Production-mode `prisma.config.ts` deliberately requires `MIGRATION_DATABASE_URL`. A release job should first restore a recent production backup into staging, apply the exact candidate migration set to staging, run the app/test smoke suite against staging, capture migration status, and only then schedule a separately approved production release. No production migration was run in this preparation task. No staging credential was available, so staging migration validation remains incomplete and blocks sign-off.

```sh
# Controlled staging/release job only; set both URLs in its secret store, never shell history.
export NODE_ENV=production
export MIGRATION_DATABASE_URL='postgresql://...staging migration role...'
pnpm db:deploy

# Check status against an explicitly named staging credential in a separately controlled task:
pnpm exec prisma migrate status
```

Before enabling search migrations, confirm the managed PostgreSQL service permits the `pg_trgm` extension. The Phase 7 migration runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` and creates trigram GIN indexes over article/video content plus authors/tags/categories. Obtain provider DBA approval if extension creation is restricted; do not silently skip these indexes or run extension changes against production without approval.

## Schema map

- Identity: `user`, Better Auth `session`/`account`/`verification`, `Role`, `Permission`, `UserRole`, and rate-limit state.
- Newsroom: `Article`, `ArticleRevision`, workflow/audit events, `Category`, `Tag`, `Author`, associations, related content, SEO and redirects.
- Video: `Video`, category/tag/author relations, editorial workflow, related articles, view metrics and viewer history.
- Media: `Media` tracks object key, ownership, size/checksum, dimensions, visibility and upload status; bytes are in external object storage.
- Reader activity: separate `SavedArticle` and `FavouriteArticle`, topic/category follows, reading/video history, user preferences and notifications.
- Analytics: aggregate daily article/video metrics; admin responses are aggregated and avoid unnecessary private identity fields.

Foreign keys, uniqueness rules, status enums and supporting indexes are defined in `prisma/schema.prisma`. Do not create manual schema changes outside migrations.

## Connection sizing

The app uses a single PrismaPg + `pg.Pool` per Node server process. Defaults are `DATABASE_POOL_MAX=5`, 10s idle timeout, 5s connection timeout, and 30s statement timeout. Set the pool maximum according to provider limits and total app replicas: `max connections ≈ replicas × pool max + migration/admin/monitoring headroom`. Keep serverless/process restarts from multiplying the pool beyond the DB allowance; choose a managed pooler if necessary, and test prepared-statement/transaction compatibility before adopting one. Do not add Redis as a database cache without evidence of an unmet performance/SLO need.

## Backups and restore test

Production must have provider-managed automated backups/PITR with a documented retention policy and an independent off-site logical backup. Logical backup example (store output on an encrypted backup volume, then replicate to a separate account/provider; do not place it in the same writable bucket as production media):

```sh
umask 077
pg_dump --format=custom --no-owner --no-acl --file="$BACKUP_DIR/ajker-diganta-$(date -u +%Y%m%dT%H%M%SZ).dump" "$BACKUP_DATABASE_URL"
```

Keep `BACKUP_DATABASE_URL` in the protected secret store; do not echo it, paste it into chat, or put it in shell history. Restrict the backup operator to required read access and encrypt at rest/in transit. Monitor backup completion, age, size, and restore points. For a large production database, use the managed provider's PITR/base-backup process rather than relying on `pg_dump` alone.

Restore only to a new isolated staging database from a trusted dump; never add `--clean` when the target is not disposable. For example:

```sh
pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -c 'ANALYZE;'
pnpm exec prisma migrate status
```

Validate table counts, role relationships, article rendering, key indexes/extensions, login/CMS, and media references before approving a recovery. Time the restore and record RPO/RTO. A restore test was **not run** here: no backup artifact or staging restore target was configured.

R2 lifecycle expiration is retention/cost automation, not backup. The current R2 S3 API matrix marks bucket versioning operations unimplemented; independently copy media bytes/metadata outside the live bucket/account and verify restoration. Keep quarantine cleanup/retention separate from verified media retention.


## 2026-10-22 local category/menu and account schema follow-up

The create-only role/default seed now includes the preserved Bengali tree (14 root categories and 101 subcategories) and initial header/hamburger menus. For categories/menu rows it inserts only missing records; an existing deactivated or CMS-edited row is not overwritten or reactivated. The test runner applies the seed only after verifying a disposable database name ending `_test`.

Migration `20261021225251_admin_user_contact_management` is additive: nullable `User.phone` and `User.deletedAt` plus lookup support for filtering removed accounts. Prisma Client generation and migrations were applied only to local `ajker_diganta_dev` and isolated `ajker_diganta_test`; 16 migrations are present and both local targets had no pending migrations. No production/staging/shared database was changed. Removal is soft-delete/anonymization, preserving audit, article, subscription and financial verification relations. `users.manage` role mapping is seeded, not schema DDL. `User.phone` is not field-level encrypted; restrict access to the Admin-only directory and review at-rest encryption, retention and privacy obligations before live use.
