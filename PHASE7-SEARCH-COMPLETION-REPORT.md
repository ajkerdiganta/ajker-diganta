# Phase 7 — Bengali Search System Completion Report

**Project:** দৈনিক আজকের দিগন্ত  
**Status:** Implemented and verified  
**Route:** `/search`

## Summary

Replaced the previous article-only `ILIKE` search with a PostgreSQL-backed, multi-entity search for **Articles, Videos, Authors, Tags, and Categories**. The implementation remains within PostgreSQL and Prisma; it does not add an external search service.

## Search approach

The MVP uses PostgreSQL’s `pg_trgm` extension and GIN trigram indexes with parameterized `ILIKE` substring matching. This is a better fit than PostgreSQL full-text tokenization for the current Bengali-first requirements: it preserves Bengali Unicode, works across Bengali and English within one query, and supports partial substrings without requiring a Bengali stemming dictionary.

The query normalizer applies Unicode NFC, treats Bengali danda and Unicode punctuation/symbols as separators, collapses Unicode whitespace, trims, and bounds the query to 100 characters. Multi-word queries require every usable term to match, though terms may match different searchable fields. Short connective terms are ignored when other usable terms exist; a query with no usable two-character term returns no matches.

### Entity coverage

- **Articles:** title, subtitle, excerpt, body HTML, and linked category, tag, and author text.
- **Videos:** title, description, and linked category, tag, and author text.
- **Authors:** active, non-deleted authors with public article or video content.
- **Tags:** non-deleted tags associated with public articles or videos.
- **Categories:** active, non-deleted categories with public articles or videos.

Only published, non-deleted articles/videos are searchable. Relevance uses weighted substring matches (headline/name fields before descriptive text); results have stable tie-break ordering.

## Filters, sorting and URLs

- Content type: all, articles, videos, authors, tags, categories.
- Category, author, and date range filters.
- Date boundaries are interpreted in **Asia/Dhaka**; invalid date values are ignored, and reversed valid ranges are normalized.
- Sort choices: relevance, newest, oldest, and popular.
- Page size: 12; page numbers are bounded to 1–1000.
- Search, filters, sort, and page are represented by URL query parameters; pagination preserves active filters.
- Category, author, and date filters narrow **article and video results**. This scope is also stated in the Bengali UI; those filters do not narrow standalone author/tag/category entity results.

## Database migration and performance

Added an additive migration at `prisma/migrations/20260929041000_phase7_bengali_search/migration.sql`. It enables `pg_trgm` with `IF NOT EXISTS` and creates GIN trigram indexes for searchable article, video, author, tag, and category text columns. The corresponding raw PostgreSQL operator-class declarations are recorded in `schema.prisma` for Prisma schema/migration consistency. No existing rows are deleted or rewritten.

PostgreSQL `EXPLAIN` checks confirmed bitmap index scans are available through the trigram GIN indexes for:

- Bengali Article title substring search (`articles_search_title_trgm_idx`)
- English Video title substring search (`videos_search_title_trgm_idx`)
- Bengali Author name substring search (`authors_search_name_trgm_idx`)

Those plan checks deliberately disabled sequential scans to verify index usability; a production planner can still choose a sequential scan for small tables or low-selectivity searches. Trigram indexes are most useful for substrings with at least three characters.

## Security

- User query text and filter values are passed as bound Prisma SQL parameters; the implementation does not concatenate user input into SQL.
- `%`, `_`, and backslash are escaped in `LIKE` patterns to prevent user-entered wildcards from changing the intended substring match.
- Search type and sort values use allowlists with safe defaults.
- Public visibility/deletion constraints are enforced in the database query, not by hiding UI elements.
- Added regression coverage for SQL-injection-like query text and a malicious sort value.

## Bengali UI and error behavior

The search page includes Bengali labels for query, type, category, author, date range, and sorting; accepts Bengali or English; renders typed entity badges and article/video metadata; preserves filters through pagination; and provides an empty state, a one-character hint, and a recoverable database-error message. Search metadata is marked `noindex`.

## Validation results

Final post-edit checks all passed:

| Check | Result |
|---|---:|
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | 36 tests passed (8 files) |
| `pnpm test:integration` | 15 tests passed (6 files), including 3 new PostgreSQL search tests |
| `pnpm build` | Passed; all 33 static pages generated and `/search` built as a dynamic route |
| Prisma migration/schema validation | Passed; 10 migrations applied in the guarded integration database, no pending migrations |
| Search integration runtime | Search test suite completed in under 1 second in the final run; a 13-row paging query was below the 15-second regression ceiling |
| Live preview | Local and public preview both returned HTTP 200; Bengali search route rendered with `lang="bn-BD"` |
| Visual check | Desktop 1280px and mobile 390px screenshots checked; Bengali text and vertically stacked mobile filters rendered without horizontal overflow |

Integration test fixtures are created in the isolated `_test` database and cleaned after each test.

## Files created or updated

- `prisma/migrations/20260929041000_phase7_bengali_search/migration.sql` — additive extension/index migration.
- `prisma/schema.prisma` — GIN trigram index declarations.
- `src/lib/public-search.ts` — safe multi-entity PostgreSQL search, filters, sort, paging, and facets.
- `src/lib/public-search-normalize.ts` — database-independent Unicode query normalization.
- `src/lib/public-news.ts` — compatibility export for existing callers.
- `src/app/search/page.tsx` — Bengali search UI, result cards, filters, empty/error states, and pagination.
- `tests/unit/public-search.test.ts` — normalization unit tests.
- `tests/integration/search.test.ts` — PostgreSQL matching, entity, filter, date, sorting, paging, injection, and latency regression tests.
- `PHASE7-SEARCH-COMPLETION-REPORT.md` — this report.

## Migration/deployment note

The migration was applied to the configured development database and the isolated integration test database. Before deploying to another PostgreSQL environment, run `pnpm prisma migrate deploy` and ensure the database role is permitted to install `pg_trgm` (or have an administrator pre-install the extension).

## Known limitations

1. `pg_trgm` is substring matching, not Bengali morphological search: stemming, synonyms, phonetic matching, and Bengali/English transliteration equivalence are not implemented.
2. Queries shorter than three characters have limited trigram-index benefit; two-character terms are accepted for cases such as `AI`, but can be less selective. The UI asks users for at least two characters.
3. Category, author, and date filters apply to article/video results, not standalone author, tag, or category entity cards.
4. Article matching searches stored `bodyHtml`; result snippets continue to use the article excerpt and are not term-highlighted.
5. No production-scale corpus/load test was available in this environment. Current verification confirms index usability and functional correctness, not a production latency SLA.

## Commands used

```bash
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate deploy
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
```
