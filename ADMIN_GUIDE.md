# Administrator and Newsroom Guide — দৈনিক আজকের দিগন্ত

## Access

- Readers use `/login` and `/register`.
- Editorial staff enter through the separate `/cms-access` gateway; route visibility is not an authorization control.
- `/admin` is the newsroom dashboard; `/admin/analytics` is restricted to authorized administrators. Reader dashboards are at `/dashboard` and `/notifications`.
- There are no default production credentials. Never deploy a shared sample password or a pre-created admin account.

## Account provisioning

1. Invite/register a staff account using the approved email/verification workflow. Configure Resend and verify the sender/domain first.
2. Give administrative elevation only to a verified active account using a controlled operator shell and exact-address confirmation: `pnpm admin:promote staff@example.com --confirm staff@example.com`.
3. REPORTER/EDITOR roles and any additional permissions are provisioned through the documented trusted operator/database workflow, with approval and audit evidence. The ordinary UI/API does not allow a user to grant themselves a role. Do not place privileged credentials in this guide or share through chat.
4. Remove role assignments promptly when staff duties change; revoke sessions on departure, change role credentials and review `AuditLog` according to retention policy.

## Article workflow

`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → SCHEDULED → PUBLISHED`; rejected work follows `REJECTED → reporter edit → RESUBMIT`. Reporters create/edit their own drafts, submit and revise rejected work. Editors review, edit, approve/reject, schedule/publish, manage taxonomy/bylines and editorial flags under their assigned permissions. ADMIN/SUPER_ADMIN has broader CMS access. Server checks revalidate permissions and ownership on every privileged API request.

Article body supports Bengali, mixed Bengali-English, headings, quotes and lists. Media is chosen from the verified media library; uploads are server-bounded, privately quarantined, raster-decoded and WebP-reencoded. SEO fields are sanitized/encoded. Slugs use stable lowercase ASCII transliteration; changing an article slug records an old-slug redirect. Use concise human-readable Bengali metadata and avoid storing localized timestamps in SEO/date fields.

Scheduled publication depends on a trusted external scheduler invoking the internal publisher endpoint with `JOB_AUTH_SECRET`. Missing secret disables scheduling safely. Monitor the job’s published count and failures through logs. Do not run a client-side timer or repeatedly trigger the route manually.

## Videos and public content

Videos use provider validation (MVP YouTube) and a review/publish workflow. Do not submit arbitrary embed or thumbnail hosts; server validates allowed URLs and does not fetch arbitrary user URLs. Public content comes from the CMS/PostgreSQL database, not static hard-coded news. Check title, canonical metadata, accessible captions/alt text, category/author and related content before publication.

## Personalization, notifications and analytics

Saved and favourite articles are independent user actions. Readers manage follows, reading/video history, preferences and notification inbox under their own accounts. Never look up another user's activity as an administrator unless an authorized, documented business need permits it; admin analytics intentionally uses aggregates and avoids exposing personal identity fields unnecessarily.

Analytics supports date ranges (today/7 days/30 days/custom) and aggregate article/video/user/view/save/favourite counts and popular lists. Treat exported totals as operational metrics, not billing or audited financial records.

## Production operational checklist

- Use named individual accounts and least-privilege roles; require MFA at the identity/provider layer where available.
- Keep production and staging identities/data separated. Do not test with default credentials or personal account data.
- Confirm backups before any large content/import/cleanup operation.
- Report upload, publishing, access-denial, indexing, or analytics anomalies to the designated owner. Do not expose auth cookies, API tokens or query-bearing reset URLs in screenshots/logs.
- For full release steps and unresolved go/no-go gates, see [DEPLOYMENT.md](DEPLOYMENT.md) and [SECURITY.md](SECURITY.md).


## 2026-10-22 direct login and account controls

ADMIN/SUPER_ADMIN staff use `/dainik/ajker/diganta/s/a/boss`; REPORTER/EDITOR staff use `/d/a/d/my/staff`. Paths do not grant roles. The homepage intentionally has no newsroom-entry text/link. Admin/Super Admin can provision USER, REPORTER, EDITOR and ADMIN from `/admin/users`; public registration remains USER-only. The directory shows name, email, optional phone, role and account status. Admins can change roles, freeze/reactivate, and soft-remove accounts. Freeze revokes sessions; removal revokes credentials/sessions/roles and anonymizes login identity while retaining audit, newsroom, subscription and payment-verification history. Super Admin, self and last-active-administrator safeguards apply. Subscriber records remain separate at `/admin/subscribers`, distinct from payment review at `/admin/subscriptions`.

## Footer display names and social links

Use Admin → Site content to add/remove publisher and editor display names below the centered social icons. Enter only authorized names and verified official HTTPS Facebook/YouTube/Instagram/LinkedIn profile URLs; an icon is clickable only when its link is configured and enabled. No profile URLs/names are prefilled. Never share initial passwords in source/log/chat; the chat-pasted passwords in this task were not used and should be rotated before actual use.
