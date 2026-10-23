# Phase 6 Completion Report — Notification System

**Project:** দৈনিক আজকের দিগন্ত  
**Status:** Implemented and verified  
**Migration:** `20260928210000_phase6_notifications`

## Delivered

- **Account-owned notification inbox:** Bengali `/notifications` page, unread count/filter, individual read/unread controls, mark-all-read and paginated loading. The dashboard links to the inbox and shows its unread count.
- **Notification types and priorities:** `BREAKING_NEWS`, `TOPIC`, `VIDEO`, `SYSTEM`; `NORMAL`, `HIGH`, and `URGENT`. Breaking alerts use urgent priority; topic/video alerts default to normal.
- **Preference controls:** Per-type in-app and email preferences are available under **আমার ড্যাশবোর্ড → পছন্দসমূহ**. In-app breaking/topic/system notices default on; video and all email preferences default off. Preferences remain scoped to the signed-in account.
- **Bengali template architecture:** Notifications persist a template key plus structured payload and render through a centralized template catalog. Current templates include `article.breaking`, `article.topic`, `video.published`, and `system.message`.
- **Transactional event hooks:** Article publication (including scheduled publication), breaking-news flag activation, and Video publication enqueue eligible in-app notifications within the same database transaction as the editorial change. Topic matching checks followed tags and all assigned categories. A reader who qualifies for both a breaking and topic notification for one event does not receive a duplicate through the same enabled channel.
- **Deduplication:** Database uniqueness on `(userId, dedupeKey)` makes retries idempotent. Email outbox rows have the same per-user event-deduplication constraint.
- **Email architecture:** Added a durable `EmailOutbox` model with delivery status, attempt count, availability/claim/send timestamps, locale, and retry/error fields. Creation is gated by `EMAIL_NOTIFICATIONS_ENABLED`; the example environment keeps it `false` until a provider-backed outbox worker is deployed.
- **Authorization:** Server-rendered inbox access redirects anonymous visitors to login. API queries and mutations derive ownership only from the authenticated session; callers cannot select another user by query/body fields.

## Routes and files

- `GET /notifications` — authenticated Bengali inbox page.
- `GET /api/me/notifications?page=&unread=true` — current account’s inbox.
- `PATCH /api/me/notifications` with `{ "action": "read-all" }` — mark the current account’s unread notices as read.
- `PATCH /api/me/notifications/[id]` with `{ "read": true|false }` — update only a notice owned by the current account.
- `GET/PATCH /api/me/preferences` — read/update the existing user’s preferences, extended with eight notification-channel settings.
- Dashboard, article publication/breaking workflow, and Video publication hooks integrated with the shared notification service.

Main implementation files include `src/lib/notification-service.ts`, `src/components/notifications/notification-inbox.tsx`, `src/app/notifications/page.tsx`, the notification API routes, and `tests/integration/notifications.test.ts`.

## Data model

The additive migration introduces:

- `Notification` — recipient, type, priority, template key/payload, internal destination, dedupe key, read timestamp, and creation time.
- `EmailOutbox` — recipient, event key, template/payload, `bn-BD` locale, status, retries, scheduling/claim/send timestamps, and error detail.
- `NotificationType`, `NotificationPriority`, and `EmailOutboxStatus` enums.
- Eight boolean notification preferences on `UserPreference`, with conservative email/video defaults.
- Indexed recipient/read/time and outbox status/availability queries, unique per-user event keys, cascading user foreign keys, and a nonnegative outbox-attempt constraint.

Existing records were preserved; the migration is additive.

## Security and abuse safeguards

- Inbox page and APIs require a valid session; API reads return no-store responses.
- Mutations check trusted request origin and validate their payloads.
- `updateMany` includes both notification ID and session-derived user ID; a cross-account ID returns not found and cannot change the other user’s record.
- Preference input is a strict allowlist and rejects injected `userId` or unknown fields.
- Unique constraints protect against duplicate delivery from workflow retries and repeated calls.
- Email outbox insertion is disabled by default; video and email notifications require explicit preferences.

## Verification

- `pnpm exec prisma migrate status` — passed; schema up to date.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — **33 tests passed** across 7 unit-test files.
- `pnpm test:integration` — **12 tests passed** across 5 integration-test files, using the guarded disposable database ending in `_test`.
  - Covered owner-only inbox listing, forged user-ID parameters, cross-user read attempts, read/unread and read-all, preference isolation, Bengali system messages, priority, duplicate prevention, scheduled topic/category alerts, breaking-news alerts, and opt-in Video alerts.
- `pnpm build` — passed using the project’s configured Next.js Webpack build.
- Production smoke checks — `/` returned 200; unauthenticated `/notifications` and `/dashboard` redirected to login; notification and preference APIs returned 401; `/robots.txt`, `/sitemap.xml`, and `/feed.xml` returned 200 with expected content types; security headers were present.

## Known limitations / next step

- **Email is architecture-only in this phase.** The outbox schema and enqueue path are ready, but no claim/retry worker or provider delivery integration is enabled. Keep `EMAIL_NOTIFICATIONS_ENABLED=false` until an email worker/provider is deployed and monitored; current UI clearly explains this.
- Notifications are fanned out synchronously inside the publication transaction, which gives atomic, retry-safe MVP behavior. For a large recipient population, move fan-out to an asynchronous worker/outbox to keep editorial publication latency bounded.
- Push/browser notifications and user-configurable retention/deletion are not included in this phase.
