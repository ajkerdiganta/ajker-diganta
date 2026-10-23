# Phase 4 Completion Report — User Personalization Foundation

**Project:** দৈনিক আজকের দিগন্ত  
**Status:** Complete  
**Scope:** Authenticated reader dashboard and account-owned personalization only. No recommendation engine, notification system, or other out-of-scope feature was added.

## Delivered

### Bengali reader dashboard

Implemented a protected, server-rendered `/dashboard` containing Bengali sections for:

- সারসংক্ষেপ
- সংরক্ষিত সংবাদ
- পছন্দের সংবাদ
- অনুসরণ করা বিষয়
- অনুসরণ করা বিভাগ
- পাঠের ইতিহাস
- পছন্দসমূহ
- প্রোফাইল

The dashboard uses responsive navigation and layout. The authenticated page was visually reviewed in the sandbox browser; the UI rendered Bengali labels and account-specific overview, empty states, preference controls, and profile form. Anonymous requests redirect to login.

Saved articles, favourite articles, and history render an initial page of up to 30 rows and support owner-scoped “আরও সংবাদ দেখুন” pagination. Save and favourite have separate actions, lists, counts, and persistence. Readers can remove an item from either list independently. Followed topics/categories remain available for unfollowing even when outside the latest available-choice slice.

Reader preferences include Bengali text size, a low-bandwidth option that omits the article’s large featured image, and a reading-history opt-out. Turning history off deletes the existing history and prevents future history writes. Profile editing currently supports the account’s display name; the login email remains read-only.

### Database and migration

Added the following Prisma models and additive PostgreSQL tables:

| Prisma model | Table | Purpose |
|---|---|---|
| `SavedArticle` | `saved_articles` | Independent saved-news collection |
| `FavouriteArticle` | `favourite_articles` | Independent favourite-news collection |
| `FollowedTopic` | `followed_topics` | Follows a newsroom tag/topic |
| `FollowedCategory` | `followed_categories` | Follows a category |
| `ReadingHistory` | `reading_history` | One per-user/per-article aggregate with last-read time and read count |
| `UserPreference` | `user_preferences` | Text size, low-bandwidth mode, and history setting |

The migration is `prisma/migrations/20260926204300_phase4_user_personalization/migration.sql`. Tables use composite primary keys, supporting indexes, foreign keys and cascading cleanup with their owning user/content. It was generated as an additive schema diff, deployed without resetting existing data, and verified as applied on both development and disposable integration-test databases.

### API routes

All user identifiers are derived from the authenticated server session; clients cannot select another owner through a body or query parameter.

- `GET /api/me/dashboard` — private dashboard DTO.
- `PUT` / `DELETE /api/me/articles/[id]/[collection]` — independently save/unsave or favourite/unfavourite a published article; collection is allowlisted.
- `GET /api/me/collections/[collection]?page=N` — owner-scoped, paginated saved or favourite articles.
- `PUT` / `DELETE /api/me/topics/[id]` — follow/unfollow a topic.
- `PUT` / `DELETE /api/me/categories/[id]` — follow/unfollow a category.
- `GET` / `DELETE /api/me/history` — read or clear only the current user’s history.
- `GET` / `PATCH /api/me/preferences` — read/update allowlisted reader preferences.
- `GET` / `PATCH /api/me/profile` — read profile or update the current user’s display name.

Authenticated public article views also update that user’s reading history when history is enabled. Anonymous/public view counting remains independent; a history-write failure does not break public view processing.

## Security and authorization coverage

Integration tests cover:

- Authentication required for dashboard and personalization APIs.
- User A cannot list User B’s saves, favourites, or reading history.
- User A cannot delete User B’s saved/favourite records or follows, including when submitting a forged `userId`.
- Manipulated owner IDs in preferences/profile are rejected; User B’s existing preferences remain unchanged.
- Invalid collection and article identifiers are rejected safely.
- Untrusted mutation origins are denied.
- Clearing history affects only the current account.
- History opt-out prevents subsequent history insertion.
- Save/favourite remain separate after updating or deleting one collection.

No owner ID is trusted from form fields, URL parameters, or request bodies. APIs return private, non-cacheable responses where appropriate. The dashboard also enforces authentication at its server-rendered page boundary.

## Verification results

| Check | Result |
|---|---|
| `pnpm exec prisma validate` | Passed |
| `pnpm exec prisma migrate status` | Passed — schema up to date, 7 migrations found |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | Passed — 14 unit tests across 6 files |
| `pnpm test:integration` | Passed — 8 integration tests across auth, CMS, and personalization suites |
| `pnpm build` | Passed — optimized Next.js 16 production build using Webpack |
| Production route smoke test | Passed — homepage 200; anonymous `/dashboard` redirects (307); dashboard and personalization APIs return 401 when anonymous |
| Bengali UI review | Passed — authenticated dashboard and signup/login UI rendered Bengali text in the browser |
| Temporary QA account | Logged out and deleted after visual verification |

## Known limitations

- Profile management currently permits a display-name update only. Email changes, profile-photo upload, and account deletion are not part of this phase.
- Preferences are intentionally limited to font size, article-page low-bandwidth imagery, and history retention. They do not yet drive recommendations or notifications.
- Reading history is privacy-conscious and aggregated per article/account rather than a timestamped log of every visit.
- The initial browser visual review was desktop-sized. Responsive behavior is implemented with mobile-first CSS, but a separate automated mobile screenshot run was not captured.
- The production preview is sandbox-hosted and temporary; production deployment still requires the project’s normal hosting/database configuration.

## Next recommended step

Review Phase 4 with the product owner, then implement Phase 5 only if approved. In particular, decide whether profile-photo/email changes or mobile-specific visual QA should be included in the next scope before adding additional personalization features.
