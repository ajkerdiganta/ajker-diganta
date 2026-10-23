# Security Audit — দৈনিক আজকের দিগন্ত

**Original audit:** 2026-10-02; production-preparation addendum: 2026-10-04
**Scope:** Existing Next.js 16 / TypeScript / Prisma / PostgreSQL application; 35 API route handlers plus authentication, admin/CMS, personalization, notifications, analytics, media, public rendering, database access, and dependency graph. This is a code/configuration review with automated tests and local production smoke checks—not a third-party penetration test.
**Reference:** [OWASP Top 10:2025](https://owasp.org/Top10/2025/). No claim of “100% secure” is made.

## Executive summary

No confirmed exploitable broken-access-control, SQL-injection, stored-XSS, user-controlled SSRF, or cross-account data-access vulnerability was found in the reviewed paths. Several existing safeguards were verified by integration tests. The original pass fixed production configuration weaknesses, added resource bounds to request and editor JSON parsing, tightened operator-driven admin elevation, added security headers, and patched three transitive dependency advisories. The 2026-10-04 follow-up also fixed the Cloudflare R2 upload protocol mismatch and tightened production environment checks. Current `pnpm audit --prod` reports no known vulnerabilities; full `pnpm audit` reports one high-severity advisory without an upstream patch in the dev-only braces lint-tool dependency (F-10).

**Important deployment caveats remain:** the production reverse proxy must overwrite the trusted `x-real-ip` header; production must actually use a restricted runtime database role and a separate migration credential; and a carefully tested Content Security Policy (CSP) is not yet configured. The actual production proxy, PostgreSQL grants, and object-storage account were not accessible for verification.

## Findings and remediation

### F-01 — Vulnerable transitive packages in the dependency graph

- **Severity:** High/high/moderate advisories; mitigated in this pass
- **OWASP mapping:** A03 Software Supply Chain Failures
- **Affected component:** `deepmerge-ts` (Prisma config dependency), `mysql2` (Prisma/Better Auth dependency graph)
- **Evidence:** Before remediation, `pnpm audit` reported `deepmerge-ts@7.1.5` affected by recursive-object stack exhaustion (GHSA-ggr8-5vv4-36mx), `mysql2@3.15.3` affected by plaintext auth-plugin downgrade (GHSA-3f6p-5ww8-9rcr), and `mysql2` affected by unbounded compressed-protocol inflation (GHSA-rgwj-5xj2-c3m3). The app is configured for PostgreSQL, so the MySQL-specific server-connection scenarios were not reachable through its configured database adapter; the dependency findings still warranted patching.
- **Recommended remediation:** Keep transitive dependencies within patched releases and re-run audits regularly.
- **Fix applied:** Added pnpm workspace overrides `deepmerge-ts@8.0.2` and `mysql2@3.23.1`; lockfile and installed dependency graph updated. No first-party framework or database-provider version was changed.
- **Retest result:** `pnpm why` showed only the patched versions. Full `pnpm audit` and `pnpm audit --prod` report **No known vulnerabilities found**.

### F-02 — Unbounded recursive/deep editor JSON could exhaust the call stack

- **Severity:** Medium (availability)
- **OWASP mapping:** A10 Mishandling of Exceptional Conditions; A06 Insecure Design
- **Affected component:** Article TipTap JSON normalization (`src/lib/article-content.ts`)
- **Evidence:** The request byte limit existed, but `JSON.stringify`, `structuredClone`, and recursive rich-text traversals ran before any maximum JSON depth or node count was enforced. A compact, deeply nested or cyclic in-process object could trigger excessive recursion; deeply nested valid JSON could also reach recursive traversal.
- **Recommended remediation:** Reject malformed, oversized, or pathological object graphs before serialization, cloning, or recursive sanitation.
- **Fix applied:** Added iterative cycle detection and limits of 64 levels and 20,000 JSON nodes before the existing 1.5 MB byte limit and recursive processing.
- **Retest result:** New tests confirm deep and cyclic payloads are rejected; content/XSS tests still pass. Full unit suite passes.

### F-03 — JSON body limit relied partly on client-supplied Content-Length

- **Severity:** Medium (availability)
- **OWASP mapping:** A10 Mishandling of Exceptional Conditions; A06 Insecure Design
- **Affected component:** Shared CMS API parsing and upload-intent endpoint
- **Evidence:** A Content-Length check alone can be absent or dishonest on streamed/chunked requests.
- **Recommended remediation:** Enforce the byte limit while consuming the request stream, independent of declared headers.
- **Fix applied:** Shared bounded JSON parser counts streamed bytes; the current raw binary media route separately counts actual bytes rather than relying on a Content-Length header.
- **Retest result:** Unit tests cover valid/malformed JSON, absent or false Content-Length, and streamed JSON/binary bodies above the limit. CMS integration tests verify expected media byte count, ownership, and upload-state preservation. Full retest results are listed below.

### F-04 — Production could accept obvious placeholder secrets and insecure origins

- **Severity:** High if deployed with a placeholder; configuration weakness fixed
- **OWASP mapping:** A02 Security Misconfiguration; A04 Cryptographic Failures
- **Affected component:** `src/lib/env.ts`, `.env.example`, production startup/build configuration
- **Evidence:** The schema enforced a 32-character minimum but did not reject common placeholder text or repeated-character secrets, and did not require HTTPS for production authentication/public/storage URLs.
- **Recommended remediation:** Fail closed on common placeholder secrets and HTTP origins; generate a unique random secret of at least 32 bytes.
- **Fix applied:** Added production runtime validation for unique/nonplaceholder auth secrets, HTTPS auth and canonical origins, TLS PostgreSQL URLs, configured email sender/provider, and complete HTTPS R2 settings. Provider checks are skipped only during Next's asset-build phase; the production server still refuses an incomplete runtime configuration. The validator does not claim to calculate secret entropy.
- **Retest result:** Unit tests cover valid, rejected, development, and production-build cases. A real production start requires actual external settings and has not been performed in this preparation task.

### F-05 — Admin promotion CLI lacked confirmation and account eligibility checks

- **Severity:** Medium (privilege escalation through trusted operator mistake/compromise)
- **OWASP mapping:** A01 Broken Access Control; A06 Insecure Design
- **Affected component:** `scripts/promote-admin.ts`
- **Evidence:** The trusted shell command previously assigned `ADMIN` to any matching email without requiring an exact confirmation or checking active status/email verification, and its error output could include low-level exception messages.
- **Recommended remediation:** Require deliberate confirmation, promote only a verified active account, and keep elevation out of browser APIs.
- **Fix applied:** CLI now requires `pnpm admin:promote EMAIL --confirm EMAIL`, checks `ACTIVE` and `emailVerified`, and emits a generic database-failure message with only the exception type. README instructions updated.
- **Retest result:** TypeScript, lint and build pass. The CLI was invoked with a missing production migration credential and failed closed before opening a database connection. No production account was created or modified; successful elevation was intentionally not performed.

### F-06 — Security headers and API cache policy were incomplete

- **Severity:** Low/medium defense-in-depth; fixed except CSP
- **OWASP mapping:** A02 Security Misconfiguration
- **Affected component:** `next.config.ts`
- **Evidence:** Existing `nosniff`, frame-denial, referrer and permissions headers were present; HSTS and a uniform API no-store policy were not configured. A Content Security Policy is also not present.
- **Recommended remediation:** Use HSTS behind HTTPS, prevent intermediary storage of API responses, and roll out a nonce-based CSP after verifying Next.js scripts and embedded providers.
- **Fix applied:** Added production HTTPS-conditional `Strict-Transport-Security: max-age=31536000`, `X-Permitted-Cross-Domain-Policies: none`, and `Cache-Control: no-store` for `/api/*`. Existing headers retained.
- **Retest result:** Local production smoke check returned HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, API `Cache-Control: no-store`, and HTTP 401 for anonymous `/api/admin/analytics`.

### F-07 — Privileged operator and migration database separation is deployment-dependent

- **Severity:** High if production runtime credentials own the schema; production gate
- **OWASP mapping:** A02 Security Misconfiguration; A01 Broken Access Control
- **Affected component:** Prisma CLI config, runtime PostgreSQL deployment
- **Evidence:** Prisma CLI previously always used `DATABASE_URL`; no code-level separation prevented migration commands from reusing long-lived runtime credentials. The actual production database grants were not available to inspect.
- **Recommended remediation:** Runtime web credentials should have only required DML privileges; migrations should use a separately managed schema-owner credential in a controlled deployment job.
- **Fix applied:** In `NODE_ENV=production`, `prisma.config.ts` now requires `MIGRATION_DATABASE_URL`; production RBAC seeding and admin promotion also use that operator/migration URL rather than the runtime URL. Integration tests explicitly map both runtime and migration URLs to the guarded test database. README and `.env.example` document the separation.
- **Retest result:** Production-mode Prisma validation, seed, and admin-promotion commands with an empty migration URL all failed closed with the expected `MIGRATION_DATABASE_URL` requirement. Integration runner verified and used `ajker_diganta_verify_test`; it reported no pending migrations. No production migration was run.

### F-08 — Raw database exceptions could reach server/CLI logs

- **Severity:** Low (operational information disclosure)
- **OWASP mapping:** A09 Security Logging and Alerting Failures; A10 Mishandling of Exceptional Conditions
- **Affected component:** Admin analytics route/page and seed/integration-runner scripts
- **Evidence:** Several catch blocks logged the raw Prisma error object, which can include query/connection diagnostics in some failure modes.
- **Recommended remediation:** Keep useful observability while avoiding raw connection/error data in routine production logs; send restricted details to a protected error-monitoring service if needed.
- **Fix applied:** These call sites now log a fixed event label plus exception class only. User-facing API errors remain generic.
- **Retest result:** TypeScript/lint/integration/build validation passed after the change.

### F-09 — Object-storage upload method was incompatible with Cloudflare R2

- **Severity:** Medium (production upload availability/configuration)
- **Affected component:** CMS media intent, browser upload flow, and S3-compatible media adapter
- **Evidence:** The existing client used presigned HTML-form POST. Cloudflare R2 documents presigned PUT/GET-style operations but does not support presigned POST; deployments using R2 would not complete media upload.
- **Recommended remediation:** Use a bounded server-side PUT path or a signed PUT supported by the target provider; preserve authentication, byte limits, private quarantine, and post-upload content decoding.
- **Fix applied:** Replaced browser form POST with an authenticated, Origin-checked, rate-limited raw-byte API that verifies upload intent ownership and exact size before writing to private quarantine using the server-side S3 PutObject operation. Finalization still Sharp-decodes, bounds pixels and re-encodes WebP.
- **Retest result:** Media integration tests pass through the in-memory adapter for size, owner and invalid-content handling. Live R2 credentials were not supplied; actual R2 permission/CDN behavior remains a staging gate.

### F-10 — Unpatched `braces` stack-exhaustion advisory in the lint toolchain

- **Severity:** High (CVSS 8.7 upstream; confined to a development dependency, not the production dependency graph)
- **Affected component:** `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3`
- **Evidence:** On 2026-10-04, `pnpm audit` reported GHSA-vfj7-8cjw-p6xm/CVE-2026-93687. The GitHub-reviewed advisory marks all `braces <= 3.0.3` affected and lists no patched version. `pnpm why braces` confirms the only path is through the dev-only Next ESLint configuration.
- **Recommended remediation:** Upgrade the upstream ESLint/Next dependency as soon as a patched `braces` is released. Until then, do not pass untrusted/user-controlled glob patterns to the lint toolchain; run lint in an isolated CI/development environment.
- **Fix applied:** No source override or unreviewed fork was added because upstream lists no patched release and the package is not in the production dependency set. Avoiding a speculative compatibility patch is safer than asserting an unverified fix.
- **Retest result:** `pnpm audit --prod` reports no known vulnerabilities. Full `pnpm audit` exits non-zero with this single dev-tool finding. Track it as a toolchain follow-up, not as evidence of a currently reachable production endpoint.

## Reviewed controls and attack-test results

| Area / requested attack | Evidence and result |
|---|---|
| Reporter attempts to publish | Integration test exercises reporter `publish` transition and expects 403; editor workflow tests verify permitted actions. **Pass.** |
| Reader attempts admin APIs / protected routes | Anonymous protected API returns 401; reader access to admin overview, newsroom taxonomy/media and analytics returns 403. Server-side principals/permissions are checked, not just hidden UI. **Pass.** |
| Cross-user saved articles and favourites | Test supplies forged `userId`, attempts cross-account deletion, verifies the other user’s rows remain, and confirms user A sees only A’s records. **Pass.** |
| Cross-user reading history | Test creates separate histories, verifies isolation and owner-only clear behavior. **Pass.** |
| Manipulated article/user IDs | Invalid UUID rejected; reporter cannot read/submit/publish another reporter’s article; profile/preferences reject forged user IDs and preserve the other user’s data. **Pass.** |
| Notification IDOR | Forged user query only returns owner rows; another user’s notification mutation returns 404 and remains unread; wrong-origin mutation is denied. **Pass.** |
| Analytics authorization | Anonymous gets 401; reader/editor get 403; admin response contains aggregate/public content data but not the tested admin email or user ID. Date totals and top-list aggregates are tested. **Pass.** |
| SQL injection | No `queryRawUnsafe`, `executeRawUnsafe`, or dynamic raw-SQL APIs were found in source/scripts. Raw search, analytics and rate-limit SQL use Prisma tagged-template parameters. Search injection regression tests pass. **Pass by code review/tests.** |
| Stored XSS through Bengali rich text | TipTap node/mark allowlists, link protocol checks and `sanitize-html` allowlist are applied; images are rewritten to first-party verified media. Tests reject `<script>`, event attributes, `javascript:` links and attacker image URLs. Added JSON-LD regression verifies `<` cannot terminate the script element; metadata integration test passes. **Pass.** |
| Article metadata/category/tag XSS | SEO JSON-LD escapes `<`; category/tag/author data are ordinary React text/attributes, not inserted as raw HTML. Schemas bound input lengths and reject unknown object properties. No unsafe raw HTML sink is used for these fields. **Pass by code review and SEO regression.** |
| Malicious file upload | Upload requires CMS permission, trusted Origin, per-user rate limiting, UUID-bound owner intent, exact content type, a strict streamed byte ceiling, single-use quarantine transition, Sharp decode with 50-million-pixel limit, raster-only allowlist and WebP re-encoding; SVG is rejected. Integration tests exercise undersize rejection, IDOR denial, legitimate Bengali metadata, oversized-image downscaling and disguised SVG rejection. **Pass against the in-memory storage adapter; live R2 remains untested.** |
| Video URL SSRF | Provider parser accepts only HTTPS, exact YouTube hosts, no userinfo/port, and validates video IDs. Thumbnail URL must match expected YouTube host/path. Submitted URL is not fetched server-side; iframe/media URLs are constructed from validated IDs. Tests reject attacker domains and malformed URLs. **Pass.** |
| CSRF/CORS | Better Auth trusted origins and mutation Origin checks are tested; no permissive `Access-Control-Allow-Origin`/credentials policy found. **Pass for application behavior; edge configuration not tested.** |
| Authentication/session/brute force | Argon2id configuration, password minimum 12/max 128, session expiry/revocation, database-backed Better Auth limiter (sign-in 5/minute; signup 5/hour; reset 3/hour), trusted origin check, Secure/HttpOnly/SameSite=Lax cookies and logout/reset tests verified. **Pass.** |
| Error and sensitive data disclosure | CMS errors return localized generic 500 responses; reviewed database failure logs expose exception class only; user-specific APIs use `private, no-store`; API-wide no-store is now added. Admin analytics excludes tested identity fields. **Pass within reviewed paths.** |
| Secrets/Git | `.env` is ignored and not Git-tracked; `.env.example` contains placeholders only. No secret values were included in this report. **Pass by repository checks.** |

## Remaining risks and production blockers

1. **Reverse-proxy IP trust — production blocker for reliable IP-based brute-force/rate limits.** Better Auth reads `x-real-ip`. The deployment edge must strip any client-supplied value and set its own trusted value; do not expose the app directly to the Internet with arbitrary forwarded-IP headers. This could not be verified from the sandbox.
2. **Database privileges — production blocker until verified.** Code now requires a separate migration URL for production CLI use, but an operator must confirm the deployed `DATABASE_URL` role cannot create/alter schema or access unrelated databases. The production grants were not available to audit.
3. **Content Security Policy — recommended before broad public launch.** No CSP is configured. Deploy a nonce-based policy in report-only mode first, then enforce after validating Next.js rendering, embedded YouTube and image/media hosts. A naive `script-src` policy can break app rendering, so no untested CSP was added.
4. **Object-storage account controls — deployment verification required.** Tests use a memory object store. Confirm production quarantine is private, upload credentials are least-privileged, verified-object access policy is intentional, and storage lifecycle/cleanup is configured. Application-side size/type/decode checks were reviewed.
5. **External testing:** No third-party penetration test, production-edge scan, cloud IAM audit, or production PostgreSQL grant review was performed. Treat this report as an engineering hardening pass, not a certification.
6. **R2 upload protocol compatibility — code-level fix, provider retest outstanding.** The former browser upload used presigned HTML-form POST, which Cloudflare R2 does not support. It now streams through an authenticated bounded app route and uses server-side PutObject; this preserves byte ceilings and does not depend on R2 POST support. The integration suite uses a memory object store; verify actual R2 Put/Head/Get/Delete permissions, HTTPS CDN delivery and bucket isolation in staging.
7. **Direct Cloudflare Workers runtime — not a production target yet.** The app uses native `sharp`/Argon2 and Node APIs. Do not deploy via vinext/OpenNext without a separate full compatibility build, managed PostgreSQL/Hyperdrive adaptation, and authentication/media end-to-end retest.

## Retest summary

- `pnpm prisma validate` — passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — **58 tests passed** across 11 files.
- `pnpm test:integration` — **21 tests passed** across 10 files against the isolated `ajker_diganta_verify_test` database; 11 committed migrations were present, with none pending there. Tests use an in-memory object-store adapter and do not verify a live R2 account.
- `pnpm build` — passed; generated the current public/admin/CMS/API routes.
- `pnpm audit --prod` — no known production dependency vulnerabilities.
- `pnpm audit` — one high-severity, unpatched advisory in the dev-only braces lint-tool dependency (F-10).
- A standalone `prisma migrate status` read the local development DB and reported `20260930050000_admin_analytics` pending. No migration was applied. No staging credentials or endpoint were supplied, so the required staging migration and restore verification remain unperformed.
- Production Prisma migration guard — missing `MIGRATION_DATABASE_URL` rejected as expected.
- Local production HTTP smoke — `/about` 200; expected HSTS/security headers present; anonymous analytics API 401 and API no-store header present.
- `git diff --check` — no whitespace errors.

## OWASP Top 10:2025 mapping

This audit used the current OWASP categories: **A01 Broken Access Control; A02 Security Misconfiguration; A03 Software Supply Chain Failures; A04 Cryptographic Failures; A05 Injection; A06 Insecure Design; A07 Authentication Failures; A08 Software or Data Integrity Failures; A09 Security Logging and Alerting Failures; A10 Mishandling of Exceptional Conditions.** Relevant controls/findings are mapped above; the mapping is a review framework, not a claim that every category has been exhaustively penetration-tested.

## Advisory and reference links

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [GHSA-ggr8-5vv4-36mx — deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- [GHSA-3f6p-5ww8-9rcr — mysql2 auth plugin downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)
- [GHSA-rgwj-5xj2-c3m3 — mysql2 unbounded compressed inflate](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)


## 2026-10-22 current RBAC and account/PII follow-up

`category.manage` and `users.manage` are granted to ADMIN/SUPER_ADMIN only. Category and account mutation APIs/actions enforce server-side permissions; editors retain tag maintenance but cannot write categories. Protected staff login routes do not grant roles. Public registration can assign only USER. Admin-created accounts can be USER/REPORTER/EDITOR/ADMIN. Freeze revokes sessions. Removal anonymizes/revokes login credentials and roles while retaining audit, article, subscription and payment-verification relationships; self-removal, ordinary Admin mutation of SUPER_ADMIN, and removing the last active administrator are denied. Published-story removal is Admin-only and audited; Editors/Admins retain review/publish workflow.

The Admin user directory limits output to 100 active/nonremoved profiles. The separate subscriber list includes only active/unexpired plans and does not mix with the payment-verification queue. Profile phone is preferred, otherwise approved payment phone is decrypted server-side. `User.phone` itself is a normal nullable DB field and is not field-level encrypted; enforce Admin-only access, DB encryption/grants and retention/privacy review before production.

Credential pairs pasted in chat were not used, stored or included in source; rotate them before real use. Isolated tests use per-run random passwords and clean up synthetic accounts. No real email provider or external identity verification was used. Current local checks pass: typecheck, lint, 84/84 unit tests (14 files), 33/33 integration tests (14 files) on `ajker_diganta_test`, production build and `git diff --check`; 16 migrations are present with none pending on local dev/test. This is not a production audit. Reverse-proxy IP trust, CSP, least-privilege live DB grants, backup/restore, real R2/CDN, verified email, phone retention/encryption, broad accessibility/performance, monitoring, independent security review and release approval remain open.
