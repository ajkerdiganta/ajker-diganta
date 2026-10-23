# Phase 8 — Admin Analytics Completion Report

**Project:** দৈনিক আজকের দিগন্ত  
**Status:** Implemented and validated

## Delivered

- Bengali-first `/admin/analytics` dashboard with date presets for **আজ**, **শেষ ৭ দিন**, **শেষ ৩০ দিন**, and a custom date range.
- Private `GET /api/admin/analytics` endpoint.
- Aggregate cards for total/published/draft/pending-review articles, total videos, active users, new users, article/video views, saved articles, and favourites.
- Top-five lists for popular articles, videos, and categories. Category popularity combines article views for each article's primary category with video views for their assigned category.
- Dedicated `analytics.read` permission. Seeded default access is limited to `ADMIN` and `SUPER_ADMIN`; editorial roles, readers, and anonymous requests do not receive analytics access.
- Additive migration creating `createdAt` indexes for saved/favourite activity. No table or existing row is altered or removed.

## Metric semantics

- **Current inventory:** total articles, currently published articles, drafts, submitted/under-review articles, total non-deleted videos, and active users.
- **Selected period:** new active users, article and video views, saves and favourites created in the interval, plus popularity rankings.
- Dates are interpreted in **Asia/Dhaka**. View totals use the existing daily metric tables; user, save, and favourite events use timestamps with an exclusive next-day boundary. Custom date ranges are capped at 366 calendar days and reversed endpoints are normalized.
- Rankings include content that is currently published, has publication metadata, and is not deleted. Category rankings include active, non-deleted categories.
- API output contains only aggregate values and public content labels/slugs; it does not return names, email addresses, IDs, or other reader-level records.

## Database and performance

- One parameterized PostgreSQL aggregation serves the dashboard metrics and top lists; values are never interpolated into SQL text.
- Existing daily metric date indexes support view aggregation. New `createdAt` indexes support date-bounded saved/favourite counts.
- Integration tests enforce a 3-second ceiling for a representative analytics endpoint request in the test environment.

## Validation

- Prisma schema validation: **passed**.
- TypeScript: **passed**.
- ESLint: **passed**.
- Unit tests: **42 passed**.
- PostgreSQL integration tests: **17 passed**, including anonymous/reader/editor denials, administrator access, aggregate values, date filtering, popular content/category totals, privacy of response payload, and performance bound.
- Production build: **passed**; `/admin/analytics` and `/api/admin/analytics` are dynamic server-rendered routes.
- Migration deployment during validation targeted only the configured disposable database `ajker_diganta_verify_test`; no production migration or deployment was run.

## Known limitations

- Daily views are available only for dates recorded in the existing ArticleDailyMetric and VideoDailyMetric tables; the dashboard does not reconstruct views from before those metrics were collected.
- Popular rankings intentionally reflect currently published content and active categories, not archived content or historical category state.
- Custom ranges are limited to the most recent 366 calendar days ending at the selected end date to bound database work.
- The dashboard reports operational aggregates and top lists only; it is not an enterprise analytics system and does not include exports, retention cohorts, or individual user activity.
