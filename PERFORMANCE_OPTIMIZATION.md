# Performance Optimization Pass — দৈনিক আজকের দিগন্ত

**Scope:** Targeted performance work only; no major product features, external cache, Redis, search engine, schema migration, or production-data operation was introduced.

## Summary of changes

| Area | Finding | Change | Expected / measured impact |
|---|---|---|---|
| Bengali fonts | The shared stylesheet could cause the Latin and Latin-extended font subsets to be downloaded alongside Bengali faces. | Kept self-hosted Noto Sans Bengali and Noto Serif Bengali variable fonts, but limited their `@font-face` unicode range and files to Bengali glyphs. Latin/mixed text falls back to the configured system stack. | Paired mobile Chromium samples showed font transfer falling from **353,952 B to 299,604 B** (−54,348 B, **−15.35%**). Both Bengali font families remain available. |
| Homepage / SQL | The homepage called the paginated latest-news helper, which also ran a full matching-row count that the homepage did not use. | The homepage now fetches its eight recent articles directly and preserves its existing view-model shape; `/latest` retains its total count and pagination. | Removes one aggregate/count query from each homepage data load. |
| Article, category, video detail | Metadata generation and the page can request the same public entity more than once in one render. | Added React request-scoped memoization to the shared article, category, and video lookup functions. This is request-local only, not cross-user persistent caching. | Avoids duplicate entity reads when metadata and page rendering use the same arguments. |
| Homepage cache | The public home page was rendered on every request despite being composed only of public news data. | Added a **60-second** Next.js revalidation window. | Lets Next serve the built page between refreshes and bounds normal CMS freshness lag to about a minute. Private/authenticated pages and APIs remain uncached. |
| Video detail | The route loaded a wider list of candidate videos and filtered it in memory to show four recommendations. | Added a bounded, exclude-current query that selects only fields needed for up to four published recommendations and fetches legacy fallbacks only if needed. | Less candidate transfer and JavaScript filtering on video details. |
| YouTube thumbnails | Several known YouTube thumbnails bypassed Next image optimization. | Added an exact HTTPS `i.ytimg.com/vi/**` image allowlist, limited image quality variants, and enabled quality-70 optimization for YouTube thumbnails. No arbitrary media host is allowed. | Enables appropriately sized optimized thumbnail delivery while leaving first-party/private-media authorization paths untouched. |
| CMS image processing | Verified image uploads could retain very large dimensions. | Sharp now applies EXIF rotation and caps output at **1920×1920** (inside, no enlargement), WebP quality 80, effort 4. Actual post-transform dimensions are stored. | Reduces oversized source image storage and subsequent CDN transfer; the 2600×1300 integration fixture is verified as 1920×960. |
| User dashboard | Private dashboard lists initially queried and serialized up to 30 rows each. | Initial saved, favourite, article-history, and video-history lists are capped at 12. List APIs accept a bounded `pageSize` (1–30), and the dashboard requests 12-row continuation pages to avoid gaps. | Cuts the first authenticated payload and its nested article/video selections while preserving complete pagination and server-side user scoping. |
| First-fold article image | The lead image used the older `priority` prop. | Migrated that single LCP candidate to the Next.js 16 `preload` prop. | Makes the intended early load explicit; below-fold image behavior remains lazy/native. |

**No new database indexes were added.** Existing public-content, relationship, daily-metric, and search indexes already target the inspected query patterns. Adding indexes without representative production plans or workload evidence would add write/storage cost without demonstrated benefit. The existing analytics service already calculates KPIs and popular lists in a single aggregate PostgreSQL query; it was retained.

## Production lab check

Built production app, checked with headless Chromium at **360×800**, device scale factor 1, **4× CPU slowdown**, and a simulated **150 ms RTT / 200 KiB/s download / 95 KiB/s upload** connection. These are single-run local lab samples against the verification database—not field data or a guarantee for Bangladesh networks. The homepage contained its empty/limited verification content, so its LCP is **not representative of a populated editorial homepage or a real lead image**.

| Sample | HTTP | TTFB | DOM content loaded | Load event | LCP | CLS | JS transfer | CSS transfer | Font transfer | Image transfer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Before font subset change | 200 | 42 ms | 892 ms | 3,300 ms | 916 ms | 0.00015 | 170,183 B | 10,440 B | 353,952 B | 0 B |
| After optimization | 200 | 43 ms | 894 ms | 3,013 ms | 888 ms | 0.00015 | 170,183 B | 10,216 B | 299,604 B | 0 B |

The paired sample confirms the expected font payload reduction. The small LCP/load differences are not statistically meaningful and should not be presented as a guaranteed speed-up. **No meaningful INP result was available:** the passive route load produced no qualifying interaction events, so INP needs a real interaction trace or field data. The empty home sample also had no article image to test the image-optimization transfer reduction.

Additional mobile-emulated production route smoke checks returned **200** for `/`, Bengali search, and `/video`. Chromium reported no page errors on the homepage sample. No authenticated admin/user dashboard benchmark was run; those routes require a live authorized session and are deliberately excluded from public caching.

## Validation

- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm test` — **54 unit tests passed**
- `pnpm test:integration` — **18 PostgreSQL integration tests passed**, including the new 1920-edge image assertion and 12-row pagination regression check
- `pnpm build` — passed; Next.js production build completed and reported `/` revalidating every 1 minute
- `git diff --check` — passed
- PostgreSQL schema/migrations unchanged; no production migration was run

## Remaining bottlenecks and cautions

1. **Representative-content validation:** benchmark a populated staging database with a real LCP article image, article/category/search/video result sets, and normal media storage/CDN. The current verification database does not provide a representative image payload.
2. **Field Core Web Vitals:** collect real-user LCP/CLS/INP and TTFB by device/network class after deployment. Local loopback numbers are only a regression aid.
3. **Font cost:** Bengali fonts still account for roughly **300 KB** in the measured cold mobile sample. Further subsetting or carefully chosen static font weights could save more, but must be assessed against Bengali glyph coverage and typographic quality.
4. **Image variants:** editorial uploads are now capped at 1920 px, but public first-party image URLs are still delivered through the existing media/CDN path rather than multiple server-generated responsive variants. Validate `srcset`/CDN transformations and actual article image bytes in staging before changing protected media paths.
5. **Freshness tradeoff:** public homepage content can remain cached for up to about 60 seconds. If breaking-news publication must appear immediately, add server-side invalidation on the relevant successful CMS publication/flag-change paths and verify the deployment cache handler supports it.
6. **Database capacity:** no production `EXPLAIN (ANALYZE, BUFFERS)` or connection-pool/load test was run against production. Use a safely seeded staging dataset before considering extra indexes, analytics rollups, or query rewrites.
7. **INP:** measure with interaction-driven field data or a reproducible browser scenario; the passive page-load sample cannot establish INP.

## Files changed

- `src/lib/public-news.ts`
- `src/lib/public-videos.ts`
- `src/lib/personalization.ts`
- `src/app/page.tsx`
- `src/app/video/page.tsx`
- `src/app/video/[slug]/page.tsx`
- `src/app/api/admin/media/finalize/route.ts`
- `src/app/api/me/history/route.ts`
- `src/app/api/me/collections/[collection]/route.ts`
- `src/app/api/me/video-history/route.ts`
- `src/components/public/news-components.tsx`
- `src/components/personalization/dashboard-client.tsx`
- `src/app/globals.css`
- `next.config.ts`
- `tests/integration/cms.test.ts`
- `tests/integration/personalization.test.ts`
