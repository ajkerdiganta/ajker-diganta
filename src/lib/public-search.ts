import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSearchQuery } from "@/lib/public-search-normalize";

export { normalizeSearchQuery } from "@/lib/public-search-normalize";

export const SEARCH_PAGE_SIZE = 12;
export const SEARCH_TYPES = ["all", "articles", "videos", "authors", "tags", "categories"] as const;
export const SEARCH_SORTS = ["relevance", "newest", "oldest", "popular"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchSort = (typeof SEARCH_SORTS)[number];
export type SearchEntityType = Exclude<SearchType, "all">;

type SearchFilters = {
  q?: string;
  page?: number;
  type?: string;
  category?: string;
  author?: string;
  from?: string;
  to?: string;
  sort?: string;
};

type SearchRow = {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: Date | null;
  category_name: string | null;
  category_slug: string | null;
  author_name: string | null;
  author_slug: string | null;
  score: number;
  popularity: bigint;
};

export type SearchResult = {
  id: string;
  type: SearchEntityType;
  title: string;
  slug: string;
  href: string;
  excerpt: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  authorSlug: string | null;
};

export type PublicSearchResult = {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: { type: SearchType; category: string; author: string; from: string; to: string; sort: SearchSort };
  results: SearchResult[];
};

const publicArticle = Prisma.sql`a."status" = 'PUBLISHED' AND a."publishedAt" IS NOT NULL AND a."publishedRevisionNumber" IS NOT NULL AND a."deletedAt" IS NULL`;
const publicVideo = Prisma.sql`v."status" = 'PUBLISHED' AND v."publishedAt" IS NOT NULL AND v."publishedRevisionNumber" IS NOT NULL AND v."deletedAt" IS NULL`;
const publicAuthor = Prisma.sql`x."isActive" = TRUE AND x."deletedAt" IS NULL`;
const publicTag = Prisma.sql`x."deletedAt" IS NULL`;
const publicCategory = Prisma.sql`x."isActive" = TRUE AND x."deletedAt" IS NULL`;

function codePointLength(value: string) { return Array.from(value).length; }
function escapeLike(value: string) { return value.replace(/[\\%_]/gu, (character) => `\\${character}`); }
function like(value: string) { return `%${escapeLike(value)}%`; }
function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}
function dhakaStart(value: string) { return new Date(`${value}T00:00:00.000+06:00`); }
function dhakaNextDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return dhakaStart(date.toISOString().slice(0, 10));
}
function enumValue<T extends readonly string[]>(value: string | undefined, choices: T, fallback: T[number]): T[number] {
  return choices.includes(value as T[number]) ? value as T[number] : fallback;
}

function termMatches(columns: Prisma.Sql[], term: string) {
  const pattern = like(term);
  return Prisma.sql`(${Prisma.join(columns.map((column) => Prisma.sql`${column} ILIKE ${pattern}`), " OR ")})`;
}

function scoreFor(columns: Array<{ column: Prisma.Sql; weight: number }>, terms: string[]) {
  const scores = terms.flatMap((term) => columns.map(({ column, weight }) => Prisma.sql`(CASE WHEN ${column} ILIKE ${like(term)} THEN ${weight} ELSE 0 END)`));
  return scores.length ? Prisma.sql`(${Prisma.join(scores, " + ")})::integer` : Prisma.sql`0::integer`;
}

function allTermsMatch(columns: Prisma.Sql[], terms: string[]) {
  return Prisma.join(terms.map((term) => termMatches(columns, term)), " AND ");
}

function addQueryMatcher(columns: Prisma.Sql[], terms: string[]) {
  return Prisma.sql`(${allTermsMatch(columns, terms)})`;
}

function articleBranch(terms: string[], category: string, author: string, from: string, to: string) {
  const categoryJoin = Prisma.sql`EXISTS (SELECT 1 FROM "ArticleCategory" ac JOIN "Category" c ON c."id" = ac."categoryId" WHERE ac."articleId" = a."id" AND c."isActive" = TRUE AND c."deletedAt" IS NULL AND ${addQueryMatcher([Prisma.sql`c."name"`, Prisma.sql`c."description"`], terms)})`;
  const tagJoin = Prisma.sql`EXISTS (SELECT 1 FROM "ArticleTag" atg JOIN "Tag" t ON t."id" = atg."tagId" WHERE atg."articleId" = a."id" AND t."deletedAt" IS NULL AND ${addQueryMatcher([Prisma.sql`t."name"`], terms)})`;
  const authorJoin = Prisma.sql`EXISTS (SELECT 1 FROM "ArticleAuthor" aa JOIN "Author" au ON au."id" = aa."authorId" WHERE aa."articleId" = a."id" AND au."isActive" = TRUE AND au."deletedAt" IS NULL AND ${addQueryMatcher([Prisma.sql`au."name"`, Prisma.sql`au."title"`], terms)})`;
  const contentMatch = addQueryMatcher([Prisma.sql`a."title"`, Prisma.sql`a."subtitle"`, Prisma.sql`a."excerpt"`, Prisma.sql`a."bodyHtml"`], terms);
  const filters: Prisma.Sql[] = [publicArticle, Prisma.sql`(${contentMatch} OR ${categoryJoin} OR ${tagJoin} OR ${authorJoin})`];
  if (category) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM "ArticleCategory" fc WHERE fc."articleId" = a."id" AND fc."categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = ${category} AND "isActive" = TRUE AND "deletedAt" IS NULL LIMIT 1))`);
  if (author) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM "ArticleAuthor" fa WHERE fa."articleId" = a."id" AND fa."authorId" = (SELECT "id" FROM "Author" WHERE "slug" = ${author} AND "isActive" = TRUE AND "deletedAt" IS NULL LIMIT 1))`);
  if (from) filters.push(Prisma.sql`a."publishedAt" >= ${dhakaStart(from)}`);
  if (to) filters.push(Prisma.sql`a."publishedAt" < ${dhakaNextDay(to)}`);
  const score = scoreFor([{ column: Prisma.sql`a."title"`, weight: 8 }, { column: Prisma.sql`a."subtitle"`, weight: 4 }, { column: Prisma.sql`a."excerpt"`, weight: 2 }, { column: Prisma.sql`a."bodyHtml"`, weight: 1 }], terms);
  return Prisma.sql`SELECT a."id"::text AS id, 'articles'::text AS entity_type, a."title" AS title, a."slug" AS slug, a."excerpt" AS excerpt, a."publishedAt" AS published_at, (SELECT c."name" FROM "ArticleCategory" ac JOIN "Category" c ON c."id" = ac."categoryId" WHERE ac."articleId" = a."id" AND ac."isPrimary" = TRUE AND c."isActive" = TRUE AND c."deletedAt" IS NULL LIMIT 1) AS category_name, (SELECT c."slug" FROM "ArticleCategory" ac JOIN "Category" c ON c."id" = ac."categoryId" WHERE ac."articleId" = a."id" AND ac."isPrimary" = TRUE AND c."isActive" = TRUE AND c."deletedAt" IS NULL LIMIT 1) AS category_slug, (SELECT au."name" FROM "ArticleAuthor" aa JOIN "Author" au ON au."id" = aa."authorId" WHERE aa."articleId" = a."id" AND aa."isPrimary" = TRUE AND au."isActive" = TRUE AND au."deletedAt" IS NULL ORDER BY aa."position" LIMIT 1) AS author_name, (SELECT au."slug" FROM "ArticleAuthor" aa JOIN "Author" au ON au."id" = aa."authorId" WHERE aa."articleId" = a."id" AND aa."isPrimary" = TRUE AND au."isActive" = TRUE AND au."deletedAt" IS NULL ORDER BY aa."position" LIMIT 1) AS author_slug, ${score} AS score, COALESCE((SELECT SUM(dm."views") FROM "ArticleDailyMetric" dm WHERE dm."articleId" = a."id"), 0)::bigint AS popularity FROM "Article" a WHERE ${Prisma.join(filters, " AND ")}`;
}

function videoBranch(terms: string[], category: string, author: string, from: string, to: string) {
  const filters: Prisma.Sql[] = [publicVideo, addQueryMatcher([Prisma.sql`v."title"`, Prisma.sql`v."description"`], terms)];
  if (category) filters.push(Prisma.sql`v."categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = ${category} AND "isActive" = TRUE AND "deletedAt" IS NULL LIMIT 1)`);
  if (author) filters.push(Prisma.sql`v."authorId" = (SELECT "id" FROM "Author" WHERE "slug" = ${author} AND "isActive" = TRUE AND "deletedAt" IS NULL LIMIT 1)`);
  if (from) filters.push(Prisma.sql`v."publishedAt" >= ${dhakaStart(from)}`);
  if (to) filters.push(Prisma.sql`v."publishedAt" < ${dhakaNextDay(to)}`);
  const categoryMatch = addQueryMatcher([Prisma.sql`c."name"`, Prisma.sql`c."description"`], terms);
  const authorMatch = addQueryMatcher([Prisma.sql`au."name"`, Prisma.sql`au."title"`], terms);
  const tagMatch = Prisma.sql`EXISTS (SELECT 1 FROM "video_tags" vt JOIN "Tag" t ON t."id" = vt."tagId" WHERE vt."videoId" = v."id" AND t."deletedAt" IS NULL AND ${addQueryMatcher([Prisma.sql`t."name"`], terms)})`;
  filters[1] = Prisma.sql`(${filters[1]} OR (${categoryMatch}) OR (${authorMatch}) OR ${tagMatch})`;
  const score = scoreFor([{ column: Prisma.sql`v."title"`, weight: 8 }, { column: Prisma.sql`v."description"`, weight: 1 }], terms);
  return Prisma.sql`SELECT v."id"::text AS id, 'videos'::text AS entity_type, v."title" AS title, v."slug" AS slug, v."description" AS excerpt, v."publishedAt" AS published_at, c."name" AS category_name, c."slug" AS category_slug, au."name" AS author_name, au."slug" AS author_slug, ${score} AS score, v."viewCount"::bigint AS popularity FROM "Video" v JOIN "Category" c ON c."id" = v."categoryId" JOIN "Author" au ON au."id" = v."authorId" WHERE ${Prisma.join(filters, " AND ")} AND c."isActive" = TRUE AND c."deletedAt" IS NULL AND au."isActive" = TRUE AND au."deletedAt" IS NULL`;
}

function entityBranches(terms: string[], type: SearchType, filters: { category: string; author: string; from: string; to: string }) {
  if (filters.category || filters.author || filters.from || filters.to) return [];
  const branches: Prisma.Sql[] = [];
  if (type === "all" || type === "authors") {
    const match = addQueryMatcher([Prisma.sql`x."name"`, Prisma.sql`x."title"`, Prisma.sql`x."bio"`], terms);
    const score = scoreFor([{ column: Prisma.sql`x."name"`, weight: 8 }, { column: Prisma.sql`x."title"`, weight: 4 }, { column: Prisma.sql`x."bio"`, weight: 1 }], terms);
    branches.push(Prisma.sql`SELECT x."id"::text AS id, 'authors'::text AS entity_type, x."name" AS title, x."slug" AS slug, x."bio" AS excerpt, (SELECT MAX(a."publishedAt") FROM "ArticleAuthor" aa JOIN "Article" a ON a."id" = aa."articleId" WHERE aa."authorId" = x."id" AND ${publicArticle}) AS published_at, NULL::text AS category_name, NULL::text AS category_slug, x."name" AS author_name, x."slug" AS author_slug, ${score} AS score, COALESCE((SELECT SUM(dm."views") FROM "ArticleAuthor" aa JOIN "Article" a ON a."id" = aa."articleId" JOIN "ArticleDailyMetric" dm ON dm."articleId" = a."id" WHERE aa."authorId" = x."id" AND ${publicArticle}), 0)::bigint AS popularity FROM "Author" x WHERE ${publicAuthor} AND ${match} AND (EXISTS (SELECT 1 FROM "ArticleAuthor" aa JOIN "Article" a ON a."id" = aa."articleId" WHERE aa."authorId" = x."id" AND ${publicArticle}) OR EXISTS (SELECT 1 FROM "Video" v WHERE v."authorId" = x."id" AND ${publicVideo}))`);
  }
  if (type === "all" || type === "tags") {
    const match = addQueryMatcher([Prisma.sql`x."name"`], terms);
    const score = scoreFor([{ column: Prisma.sql`x."name"`, weight: 8 }], terms);
    branches.push(Prisma.sql`SELECT x."id"::text AS id, 'tags'::text AS entity_type, x."name" AS title, x."slug" AS slug, NULL::text AS excerpt, NULL::timestamptz AS published_at, NULL::text AS category_name, NULL::text AS category_slug, NULL::text AS author_name, NULL::text AS author_slug, ${score} AS score, 0::bigint AS popularity FROM "Tag" x WHERE ${publicTag} AND ${match} AND (EXISTS (SELECT 1 FROM "ArticleTag" atg JOIN "Article" a ON a."id" = atg."articleId" WHERE atg."tagId" = x."id" AND ${publicArticle}) OR EXISTS (SELECT 1 FROM "video_tags" vt JOIN "Video" v ON v."id" = vt."videoId" WHERE vt."tagId" = x."id" AND ${publicVideo}))`);
  }
  if (type === "all" || type === "categories") {
    const match = addQueryMatcher([Prisma.sql`x."name"`, Prisma.sql`x."description"`], terms);
    const score = scoreFor([{ column: Prisma.sql`x."name"`, weight: 8 }, { column: Prisma.sql`x."description"`, weight: 1 }], terms);
    branches.push(Prisma.sql`SELECT x."id"::text AS id, 'categories'::text AS entity_type, x."name" AS title, x."slug" AS slug, x."description" AS excerpt, (SELECT MAX(a."publishedAt") FROM "ArticleCategory" ac JOIN "Article" a ON a."id" = ac."articleId" WHERE ac."categoryId" = x."id" AND ${publicArticle}) AS published_at, x."name" AS category_name, x."slug" AS category_slug, NULL::text AS author_name, NULL::text AS author_slug, ${score} AS score, COALESCE((SELECT SUM(dm."views") FROM "ArticleCategory" ac JOIN "Article" a ON a."id" = ac."articleId" JOIN "ArticleDailyMetric" dm ON dm."articleId" = a."id" WHERE ac."categoryId" = x."id" AND ${publicArticle}), 0)::bigint AS popularity FROM "Category" x WHERE ${publicCategory} AND ${match} AND (EXISTS (SELECT 1 FROM "ArticleCategory" ac JOIN "Article" a ON a."id" = ac."articleId" WHERE ac."categoryId" = x."id" AND ${publicArticle}) OR EXISTS (SELECT 1 FROM "Video" v WHERE v."categoryId" = x."id" AND ${publicVideo}))`);
  }
  return branches;
}

function sortOrder(sort: SearchSort) {
  switch (sort) {
    case "newest": return Prisma.sql`published_at DESC NULLS LAST, score DESC, entity_type ASC, id ASC`;
    case "oldest": return Prisma.sql`published_at ASC NULLS LAST, score DESC, entity_type ASC, id ASC`;
    case "popular": return Prisma.sql`popularity DESC, published_at DESC NULLS LAST, score DESC, entity_type ASC, id ASC`;
    default: return Prisma.sql`score DESC, published_at DESC NULLS LAST, entity_type ASC, id ASC`;
  }
}

function hrefFor(row: SearchRow) {
  switch (row.entity_type) {
    case "articles": return `/news/${encodeURIComponent(row.slug)}`;
    case "videos": return `/video/${encodeURIComponent(row.slug)}`;
    case "authors": return `/author/${encodeURIComponent(row.slug)}`;
    case "categories": return `/category/${encodeURIComponent(row.slug)}`;
    case "tags": return `/search?q=${encodeURIComponent(row.title)}&type=all`;
  }
}

export async function searchPublicContent(input: SearchFilters): Promise<PublicSearchResult> {
  const query = normalizeSearchQuery(input.q ?? "");
  const page = Math.max(1, Math.min(1000, Math.trunc(input.page || 1)));
  const type = enumValue(input.type, SEARCH_TYPES, "all");
  const sort = enumValue(input.sort, SEARCH_SORTS, "relevance");
  const category = (input.category ?? "").normalize("NFC").trim().slice(0, 100);
  const author = (input.author ?? "").normalize("NFC").trim().slice(0, 100);
  let from = validDate(input.from);
  let to = validDate(input.to);
  if (from && to && from > to) [from, to] = [to, from];
  const filters = { type, category, author, from, to, sort };
  const terms = query.split(" ").filter((term) => codePointLength(term) >= 2);
  if (codePointLength(query) < 2 || terms.length === 0) {
    return { query, page, pageSize: SEARCH_PAGE_SIZE, total: 0, totalPages: 1, filters, results: [] };
  }
  const branches: Prisma.Sql[] = [];
  if (type === "all" || type === "articles") branches.push(articleBranch(terms, category, author, from, to));
  if (type === "all" || type === "videos") branches.push(videoBranch(terms, category, author, from, to));
  branches.push(...entityBranches(terms, type, { category, author, from, to }));
  if (!branches.length) return { query, page, pageSize: SEARCH_PAGE_SIZE, total: 0, totalPages: 1, filters, results: [] };
  const union = Prisma.join(branches, " UNION ALL ");
  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total FROM (${union}) AS search_results`),
    prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT * FROM (${union}) AS search_results ORDER BY ${sortOrder(sort)} LIMIT ${SEARCH_PAGE_SIZE} OFFSET ${(page - 1) * SEARCH_PAGE_SIZE}`),
  ]);
  const total = Number(countRows[0]?.total ?? BigInt(0));
  const results = rows.map((row) => ({ id: row.id, type: row.entity_type, title: row.title, slug: row.slug, href: hrefFor(row), excerpt: row.excerpt, publishedAt: row.published_at, categoryName: row.category_name, categorySlug: row.category_slug, authorName: row.author_name, authorSlug: row.author_slug }));
  return { query, page, pageSize: SEARCH_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)), filters, results };
}

export async function getPublicSearchFacets() {
  const [categories, authors] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, deletedAt: null, OR: [{ articles: { some: { article: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null } } } }, { videos: { some: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null } } }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true, slug: true } }),
    prisma.author.findMany({ where: { isActive: true, deletedAt: null, OR: [{ articles: { some: { article: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null } } } }, { videos: { some: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null } } }] }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
  ]);
  return { categories, authors };
}
