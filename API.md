# API Reference — route inventory

This document describes route families by behavior. The source of truth for exact request/response schemas is each `src/app/api/**/route.ts` handler and its Zod schema; this is not an exhaustive OpenAPI contract. JSON mutations return localized errors and use no-store cache policy. Do not infer authorization from this list alone: each handler enforces permissions on the server.

## Health and public APIs

| Route | Methods | Purpose / access |
|---|---|---|
| `/api/health` | GET | Public dependency health check; read-only database `SELECT 1`, no secrets/topology, no-store, 200/503 |
| `/api/public/articles/[slug]/view` | POST | Public article view event; deduplicated/rate limited; no reader identity disclosure |
| `/api/public/videos/[slug]/view` | POST | Public video view event; deduplicated/rate limited |
| `/api/media/[id]` | GET | Deliver verified media only; private visibility additionally requires media owner/read permission; redirects to a safe object URL |
| `/api/cms/entry` | GET | Resolve CMS entry/role routing after session verification |

## Authentication

`/api/auth/[...all]` is Better Auth's handler: registration, email/password login/logout, session, forgot-password/reset flow. Secure cookie behavior derives from the configured HTTPS canonical auth origin in production. Email reset requires a working provider configuration; development may log the reset link locally only. Never send authentication secrets to client code.

## Public content

Public content pages use server-side database services for home/latest/category/article/author/search/video listings and detail views. Search query parameters support `q`, `type`, `category`, `author`, `from`, `to`, `sort`, and `page`; allowed search types and sort values are constrained by the service. Search URLs use URL-encoded Bengali/English query values and page-based bounded pagination. Query values are parameterized; no external search engine is used. SEO endpoints are `/sitemap.xml`, `/robots.txt`, and `/feed.xml`.

## CMS (session and permission required)

- `/api/admin/overview` and `/api/admin/analytics`: admin-only overview and aggregate KPI data with validated date ranges.
- `/api/admin/articles` and `/api/admin/articles/[id]`: article list/create/read/edit/archive/delete actions as allowed by role and ownership.
- `/api/admin/articles/[id]/transition`: revision-aware workflow actions such as submit/review/approve/reject/schedule/publish/archive/feature flags; publication is editor/admin-only.
- `/api/admin/categories[/id]`, `/api/admin/tags[/id]`, `/api/admin/authors[/id]`: editorial taxonomy and byline management, permission checked.
- `/api/admin/videos[/id]`, `/api/admin/videos/[id]/transition`: video CRUD and workflow.
- `/api/admin/media`: verified media library; `/api/admin/media/intent`: create bounded upload intent; `/api/admin/media/upload?mediaId=…` (PUT raw bytes): authenticated, owner-bound, size-limited write to private quarantine; `/api/admin/media/finalize`: inspect and re-encode to WebP; `/api/admin/media/[id]`: authorized metadata and lifecycle management.

Mutations enforce trusted Origin checks, Zod schemas, rate controls and audit events where relevant. The binary upload reads a bounded stream and checks bytes against the server-created intent. The client cannot choose an object key or make an upload public.

## User APIs (authenticated; owner-only)

- `/api/me/dashboard`: profile/preferences and initial private dashboard data.
- `/api/me/collections/[collection]`: list saved or favourite articles (separate tables and semantics).
- `/api/me/articles/[id]/[collection]`: save/unsave or favourite/unfavourite an article.
- `/api/me/categories/[id]`, `/api/me/topics/[id]`: category/topic follows.
- `/api/me/history`, `/api/me/video-history`: reading/video history, bounded pagination and owner-only clear operations where supported.
- `/api/me/preferences`, `/api/me/profile`: self-service preferences/profile.
- `/api/me/notifications`, `/api/me/notifications/[id]`: list and update only the caller's notifications.

Authenticated responses are private/no-store. Client-supplied `userId` values never authorize cross-user access.

## Internal scheduler

`POST /api/internal/jobs/publish-due` requires `Authorization: Bearer <JOB_AUTH_SECRET>` and is intended only for a managed scheduler over HTTPS. It publishes due approved revisions and runs view-dedup-key cleanup. Calls without a configured secret return 503; invalid credentials return 401. The secret must be generated randomly, stored in a secret manager and never embedded in a browser/client.

## Common operational rules

- JSON body parsers and upload bodies are bounded; file endpoints accept raster images only and return generic errors.
- Public page caching is not the same as API caching. APIs are no-store; never cache session-specific output at the CDN.
- Use standard HTTP status meanings (401 unauthenticated, 403 forbidden, 404 concealed private resource, 409 conflict, 413 oversized, 415 unsupported type, 429 rate limited, 503 dependency/configuration unavailable).
- All timestamps are machine-readable instants; the Bengali UI formats them in `Asia/Dhaka`.
