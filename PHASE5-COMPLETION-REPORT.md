# Phase 5 Completion Report — Video Platform

**Project:** দৈনিক আজকের দিগন্ত  
**Status:** Complete  
**Phase 4 handoff:** Phase 4 verification was completed first and recorded in `PHASE4-COMPLETION-REPORT.md`; Phase 5 was then implemented as requested.

## Delivered

### Video data model and migration

Added an additive PostgreSQL migration at `prisma/migrations/20260927004000_phase5_video_platform/migration.sql`; it creates no destructive changes and leaves existing article-related video data intact.

The schema adds:

- `VideoProvider` (`YOUTUBE`, `CLOUDFLARE_STREAM`) and `VideoStatus` workflow enums.
- `Video` with stable ASCII slug, Bengali title/description/SEO fields, provider URL and immutable external ID, thumbnail, duration, category, tags, author, authoring/reviewer/publisher references, status/revision markers, publication timestamp and aggregate view count.
- `VideoTag` and `VideoRelatedArticle` joins.
- `VideoWorkflowEvent` editorial audit trail.
- `VideoDailyMetric` aggregate counts by Bangladesh calendar day.
- `VideoHistory` per-user/per-video last-view/count aggregate.

Foreign keys, uniqueness for both slug and `(provider, externalId)`, supporting indexes and non-negative duration/count/revision constraints are included. Video history cascades with its account and video.

### Editorial CMS and authorization

Added Bengali CMS pages at `/admin/videos`, `/admin/videos/new` and `/admin/videos/[id]`, with create/edit forms, taxonomy and author assignment, SEO metadata, related published article selection, thumbnail/duration fields, view totals, review/reject/approve/publish/archive actions and soft deletion.

Server-side APIs:

- `GET /api/admin/videos` and `POST /api/admin/videos`
- `GET /api/admin/videos/[id]`, `PATCH /api/admin/videos/[id]`, and `DELETE /api/admin/videos/[id]`
- `POST /api/admin/videos/[id]/transition`

The workflow is `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED`, with rejection returning content to a reporter/editor for revision and resubmission. Revisions use optimistic concurrency checks. Creators cannot approve or publish their own videos. Request bodies cannot assign an owner, status or role; the actor is derived from the server session. Mutations also use trusted-origin checks, rate limiting, validation and audit/workflow records.

The `VIDEO_EDITOR` role is least-privileged: it can create and manage only its own drafts and submit/resubmit them, but cannot read all newsroom videos, review, approve, publish or archive. Editors/admins have the respective newsroom-wide permissions.

### Provider boundary and validation

Implemented a provider adapter in `src/lib/video-provider.ts`. The current application accepts HTTPS YouTube watch, short, embed, live and `youtu.be` URLs only; it parses and canonicalizes the immutable 11-character video ID and renders embeds through `youtube-nocookie.com`.

Thumbnail URLs are restricted to the matching video’s standard image paths on `i.ytimg.com`; arbitrary hosts, HTTP, credentials, ports, query strings and fragments are rejected. `CLOUDFLARE_STREAM` is represented in the schema boundary for future work but is deliberately not enabled in the CMS/service yet.

### Public video website

- `/video` — Bengali-first responsive listing, published-only visibility, category filters, pagination, optimized-layout thumbnails, duration, author and related-article links.
- `/video/[slug]` — Bengali video detail page with privacy-enhanced embed, tags, related published articles, related videos, sharing, view tracking, canonical metadata, OpenGraph/Twitter thumbnail metadata, `VideoObject` and breadcrumb JSON-LD.
- Homepage cards, article-to-video links and sitemap entries now resolve first-class Video CMS records. Stable legacy `/video--yt-…` compatibility entries remain available for existing article-related YouTube embeds.

### View counting and account video history

Public view counting stores aggregate `Video.viewCount` and `VideoDailyMetric` totals; a 30-minute HMAC-based deduplication key uses the validated request IP without persisting the raw IP. Authenticated viewers get an independent `VideoHistory` record, exposed through `/api/me/video-history` and a separate Bengali dashboard panel with pagination and clear-history controls. The history preference opt-out clears both article and video history and blocks subsequent account-history writes. Public playback and aggregate counting continue when optional history recording fails.

## Key files

- `prisma/schema.prisma`
- `prisma/migrations/20260927004000_phase5_video_platform/migration.sql`
- `src/lib/video-provider.ts`, `src/lib/video-schemas.ts`, `src/lib/video-service.ts`, `src/lib/public-videos.ts`
- `src/app/admin/videos/**` and `src/app/api/admin/videos/**`
- `src/app/video/page.tsx`, `src/app/video/[slug]/page.tsx`, `src/app/api/public/videos/[slug]/view/route.ts`
- `src/app/api/me/video-history/route.ts`, `src/lib/personalization.ts`
- `src/components/cms/video-manager.tsx`, `src/components/public/public-client.tsx`, `src/components/personalization/dashboard-client.tsx`
- `tests/unit/video-provider.test.ts`, `tests/integration/video.test.ts`

## Verification results

| Check | Result |
|---|---|
| `pnpm exec prisma validate` | Passed |
| `pnpm exec prisma migrate status` | Passed — 8 migrations found; development schema up to date |
| `pnpm db:seed` | Passed — final role permissions synchronized |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed with no warnings |
| `pnpm test` | Passed — 33 tests across 7 unit-test files |
| `pnpm test:integration` | Passed — 10 tests across auth, CMS, personalization and Video suites; guarded `_test` database had no pending migrations |
| `pnpm build` | Passed — optimized Next.js 16 Webpack production build, including all CMS, public Video and account-history routes |
| Production HTTP smoke | Passed — `/`, `/video`, `sitemap.xml`, `robots.txt` and `feed.xml` returned 200; unknown unpublished video returned 404; anonymous `/admin/videos` redirected to login; admin and video-history APIs returned 401 |
| Bengali/mobile review | Passed — SSR Bengali markers and `lang="bn-BD"` verified; final `/video` screenshot reviewed at 390×844 |
| Security headers | Verified — `nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy and restricted permissions policy present |

The integration suite verifies strict URL/provider/thumbnail validation, owner-IDOR denial, normal-reader denial, revision conflicts, independent reviewer workflow, self-approval/publishing denial, published-only public query behavior, canonical SEO metadata, related articles, deduplicated view counting, cross-account Video history isolation, history clearing and history opt-out.

## Known limitations and operational notes

- YouTube is the only enabled video host. Cloudflare Stream has a schema enum placeholder only; its URL parser, thumbnail/rendering adapter, playback and CMS support remain future work.
- Videos use external hosting; this phase does not upload or stream video files, proxy playback, transcode media or provide caption/subtitle management.
- Legacy article-linked YouTube clips still render through compatibility lookup. Their view attempts do not contribute to first-class `Video` aggregates/history until those clips are migrated into Video CMS records.
- Public view deduplication relies on the deployment edge/reverse proxy to provide a trustworthy, normalized `x-real-ip` header. Confirm that header is overwritten by the trusted proxy in production; do not accept arbitrary client-forwarded values as authoritative.
- The live development database contains no published Video fixtures after integration cleanup, so the preview listing shows its Bengali empty state. Integration tests create, publish and verify temporary records, then remove them.
- Production deployment still requires the normal hosting, database, auth-secret and proxy configuration.

## Next recommended step

Deploy this migration and build in staging, verify the trusted IP header and configured YouTube embed/referrer behavior at the production edge, then migrate selected legacy `ArticleRelatedVideo` entries into the Video CMS before editorial rollout. Consider Cloudflare Stream only when first-party hosting requirements justify its implementation.
