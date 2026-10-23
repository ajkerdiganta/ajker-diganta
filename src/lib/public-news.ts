import { Prisma } from "@/generated/prisma/client";
import { cache } from "react";
import { videoRouteSlug } from "@/lib/public-video";
import { listVideos as listCmsVideos } from "@/lib/public-videos";
import { prisma } from "@/lib/prisma";

export { searchPublicContent as searchPublicArticles } from "@/lib/public-search";

export { videoRouteSlug };

const publicWhere = {
  status: "PUBLISHED" as const,
  publishedAt: { not: null },
  publishedRevisionNumber: { not: null },
  deletedAt: null,
};

export const articleCardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  excerpt: true,
  seoTitle: true,
  seoDescription: true,
  canonicalUrl: true,
  publishedAt: true,
  updatedAt: true,
  isBreaking: true,
  isFeatured: true,
  isTrending: true,
  categories: {
    where: { isPrimary: true, category: { isActive: true, deletedAt: null } },
    select: { category: { select: { name: true, slug: true } } },
    take: 1,
  },
  authors: {
    where: { isPrimary: true, author: { isActive: true, deletedAt: null } },
    select: { author: { select: { name: true, slug: true, title: true } } },
    take: 1,
  },
  media: {
    where: { role: "FEATURED_IMAGE", media: { status: "VERIFIED", visibility: "PUBLIC", deletedAt: null } },
    select: { altOverride: true, media: { select: { id: true, altText: true, width: true, height: true, caption: true } } },
    take: 1,
  },
} satisfies Prisma.ArticleSelect;

export type PublicArticleCard = Prisma.ArticleGetPayload<{ select: typeof articleCardSelect }>;

const articleDetailSelect = {
  ...articleCardSelect,
  bodyHtml: true,
  tags: { where: { tag: { deletedAt: null } }, select: { tag: { select: { name: true, slug: true } } }, take: 20 },
  media: {
    where: { media: { status: "VERIFIED", visibility: "PUBLIC", deletedAt: null } },
    select: { role: true, altOverride: true, position: true, media: { select: { id: true, altText: true, width: true, height: true, caption: true, credit: true, visibility: true, objectKey: true } } },
    orderBy: { position: "asc" },
  },
  relatedArticles: {
    where: { relatedArticle: publicWhere },
    select: { position: true, relatedArticle: { select: articleCardSelect } },
    orderBy: { position: "asc" }, take: 8,
  },
  relatedVideos: { select: { title: true, provider: true, externalId: true, canonicalUrl: true }, orderBy: { position: "asc" }, take: 8 },
} satisfies Prisma.ArticleSelect;

export type PublicArticle = Omit<Prisma.ArticleGetPayload<{ select: typeof articleDetailSelect }>, "relatedVideos"> & { relatedVideos: Array<Prisma.ArticleGetPayload<{ select: typeof articleDetailSelect }>["relatedVideos"][number] & { slug: string }>; viewCount: bigint };

export async function getHomeData() {
  const now = new Date();
  const activeBreaking = { OR: [{ breakingUntil: null }, { breakingUntil: { gt: now } }] };
  const activeFeatured = { OR: [{ featuredUntil: null }, { featuredUntil: { gt: now } }] };
  const [breaking, featured, latest, trending, mostRead, categories, videos] = await Promise.all([
    prisma.article.findMany({ where: { ...publicWhere, isBreaking: true, ...activeBreaking }, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 5 }),
    prisma.article.findMany({ where: { ...publicWhere, isFeatured: true, ...activeFeatured }, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 8 }),
    prisma.article.findMany({ where: publicWhere, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 8 }),
    getTrendingArticles(6),
    getMostReadArticles(6),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null, parentId: null, articles: { some: { article: publicWhere } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 5, select: { id: true, name: true, slug: true, description: true } }),
    listCmsVideos(4),
  ]);
  const categorySections = await Promise.all(categories.map(async (category) => ({
    category,
    articles: await prisma.article.findMany({ where: { ...publicWhere, categories: { some: { categoryId: category.id } } }, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 4 }),
  })));
  return { breaking, featured, latest: { articles: latest, page: 1, pageSize: 8, total: latest.length, totalPages: 1 }, trending, mostRead, categorySections: categorySections.filter(({ articles }) => articles.length), videos };
}

export async function getLatestArticles(page = 1, pageSize = 12) {
  const safePage = Math.max(1, Math.min(1000, Math.trunc(page || 1)));
  const [articles, total] = await Promise.all([
    prisma.article.findMany({ where: publicWhere, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: pageSize, skip: (safePage - 1) * pageSize }),
    prisma.article.count({ where: publicWhere }),
  ]);
  return { articles, page: safePage, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const getPublicArticle = cache(async function getPublicArticle(slug: string) {
  const article = await prisma.article.findFirst({ where: { ...publicWhere, slug }, select: articleDetailSelect });
  if (!article) return null;
  const [aggregate, canonicalVideos] = await Promise.all([
    prisma.articleDailyMetric.aggregate({ where: { articleId: article.id }, _sum: { views: true } }),
    article.relatedVideos.length ? prisma.video.findMany({ where: { provider: "YOUTUBE", externalId: { in: article.relatedVideos.map(({ externalId }) => externalId) }, status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null }, select: { externalId: true, slug: true } }) : [],
  ]);
  const slugByExternalId = new Map(canonicalVideos.map((video) => [video.externalId, video.slug]));
  return { ...article, relatedVideos: article.relatedVideos.map((video) => ({ ...video, slug: slugByExternalId.get(video.externalId) ?? videoRouteSlug(video.title, video.externalId) })), viewCount: aggregate._sum.views ?? BigInt(0) };
});

export async function getArticleRedirect(slug: string) {
  return prisma.articleSlugRedirect.findUnique({ where: { oldSlug: slug }, select: { article: { select: { slug: true, status: true, deletedAt: true } } } });
}

export const getCategoryBySlug = cache(async function getCategoryBySlug(slug: string, page = 1) {
  const category = await prisma.category.findFirst({ where: { slug, isActive: true, deletedAt: null }, select: { id: true, slug: true, name: true, description: true, seoTitle: true, seoDescription: true, parent: { select: { slug: true, name: true } }, children: { where: { isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } });
  if (!category) return null;
  const safePage = Math.max(1, Math.min(1000, Math.trunc(page || 1)));
  const where: Prisma.ArticleWhereInput = { ...publicWhere, categories: { some: { categoryId: category.id } } };
  const [articles, total] = await Promise.all([
    prisma.article.findMany({ where, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 12, skip: (safePage - 1) * 12 }),
    prisma.article.count({ where }),
  ]);
  return { ...category, articles, page: safePage, total, totalPages: Math.max(1, Math.ceil(total / 12)) };
});

export async function getPublicAuthor(slug: string, page = 1) {
  const author = await prisma.author.findFirst({ where: { slug, isActive: true, deletedAt: null }, select: { id: true, slug: true, name: true, title: true, bio: true } });
  if (!author) return null;
  const safePage = Math.max(1, Math.min(1000, Math.trunc(page || 1)));
  const [rows, total] = await Promise.all([
    prisma.article.findMany({ where: { ...publicWhere, authors: { some: { authorId: author.id } } }, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 12, skip: (safePage - 1) * 12 }),
    prisma.article.count({ where: { ...publicWhere, authors: { some: { authorId: author.id } } } }),
  ]);
  return { author, page: safePage, total, totalPages: Math.max(1, Math.ceil(total / 12)), articles: rows };
}

export async function getTrendingArticles(take = 8) {
  const now = new Date();
  const flagged = await prisma.article.findMany({ where: { ...publicWhere, isTrending: true, OR: [{ trendingUntil: null }, { trendingUntil: { gt: now } }] }, select: articleCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take });
  if (flagged.length >= Math.min(3, take)) return flagged;
  const filled = new Set(flagged.map(({ id }) => id));
  const recentSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const aggregates = await prisma.articleDailyMetric.groupBy({ by: ["articleId"], where: { metricDate: { gte: recentSince }, article: publicWhere }, _sum: { views: true }, orderBy: { _sum: { views: "desc" } }, take: take + flagged.length });
  const moreIds = aggregates.map(({ articleId }) => articleId).filter((id) => !filled.has(id)).slice(0, take - flagged.length);
  if (!moreIds.length) return flagged;
  const more = await prisma.article.findMany({ where: { ...publicWhere, id: { in: moreIds } }, select: articleCardSelect });
  const byId = new Map(more.map((article) => [article.id, article]));
  return [...flagged, ...moreIds.flatMap((id) => byId.has(id) ? [byId.get(id)!] : [])];
}

export async function getMostReadArticles(take = 8) {
  const today = dhakaDayStart(new Date());
  const since = new Date(today.getTime() - 6 * 86_400_000);
  const aggregates = await prisma.articleDailyMetric.groupBy({ by: ["articleId"], where: { metricDate: { gte: since }, article: publicWhere }, _sum: { views: true }, orderBy: { _sum: { views: "desc" } }, take });
  const ids = aggregates.map(({ articleId }) => articleId);
  if (!ids.length) return [] as PublicArticleCard[];
  const articles = await prisma.article.findMany({ where: { ...publicWhere, id: { in: ids } }, select: articleCardSelect });
  const byId = new Map(articles.map((article) => [article.id, article]));
  return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}

export async function listVideos(take = 20) {
  const rows = await prisma.articleRelatedVideo.findMany({ where: { article: publicWhere, provider: "youtube" }, select: { title: true, externalId: true, canonicalUrl: true, article: { select: { slug: true, title: true, publishedAt: true } } }, orderBy: [{ article: { publishedAt: "desc" } }, { position: "asc" }], take: 100 });
  const seen = new Set<string>();
  return rows.filter((row) => !seen.has(row.externalId) && Boolean(seen.add(row.externalId))).slice(0, take).map((row) => ({ ...row, slug: videoRouteSlug(row.title, row.externalId) }));
}

export async function getPublicVideo(routeSlug: string) {
  const match = routeSlug.match(/--yt-([A-Za-z0-9_-]{6,32})$/);
  if (!match) return null;
  const externalId = match[1]!;
  const items = await prisma.articleRelatedVideo.findMany({ where: { externalId, provider: "youtube", article: publicWhere }, select: { title: true, externalId: true, canonicalUrl: true, article: { select: { slug: true, title: true, publishedAt: true } } }, orderBy: { article: { publishedAt: "desc" } }, take: 20 });
  if (!items.length) return null;
  const video = items[0]!;
  return { ...video, slug: videoRouteSlug(video.title, video.externalId), relatedArticles: [...new Map(items.map(({ article }) => [article.slug, article])).values()] };
}

export async function getPublicSitemapData() {
  const [articles, categories, authors, videos] = await Promise.all([
    prisma.article.findMany({ where: publicWhere, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5000 }),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null, articles: { some: { article: publicWhere } } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1000 }),
    prisma.author.findMany({ where: { isActive: true, deletedAt: null, articles: { some: { article: publicWhere } } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 2000 }),
    listCmsVideos(2000),
  ]);
  return { articles, categories, authors, videos };
}

export function dhakaDayStart(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "1970";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}
