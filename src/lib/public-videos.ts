import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Prisma } from "@/generated/prisma/client";
import { cache } from "react";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { videoRouteSlug, videoThumbnailUrl } from "@/lib/video-provider";

const VIEW_PREFIX = "public-video-view-v1:";
const VIEW_WINDOW_MS = 30 * 60 * 1000;

function dhakaDayStart(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "1970";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}

const publishedWhere: Prisma.VideoWhereInput = {
  status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null,
};
const publicArticleWhere: Prisma.ArticleWhereInput = {
  status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null,
};

const videoCardSelect = {
  id: true, slug: true, title: true, description: true, thumbnailUrl: true, provider: true,
  videoUrl: true, externalId: true, durationSeconds: true, viewCount: true, publishedAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true, title: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  relatedArticles: { where: { relatedArticle: publicArticleWhere }, orderBy: { position: "asc" as const }, take: 8, select: { position: true, relatedArticle: { select: { id: true, slug: true, title: true, publishedAt: true } } } },
} satisfies Prisma.VideoSelect;

type VideoCard = Prisma.VideoGetPayload<{ select: typeof videoCardSelect }>;

type LegacyArticle = { id: string; slug: string; title: string; publishedAt: Date | null };
export type PublicVideoCard = {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  provider: "YOUTUBE";
  videoUrl: string;
  externalId: string;
  durationSeconds: number | null;
  viewCount: bigint;
  publishedAt: Date | null;
  updatedAt: Date;
  category: { id: string; name: string; slug: string } | null;
  author: { id: string; name: string; slug: string; title: string | null } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  relatedArticles: LegacyArticle[];
  article: LegacyArticle | null;
};

function mapVideo(video: VideoCard): PublicVideoCard {
  const relatedArticles = video.relatedArticles.map(({ relatedArticle }) => relatedArticle);
  return {
    id: video.id, slug: video.slug, title: video.title, description: video.description,
    thumbnailUrl: video.thumbnailUrl ?? videoThumbnailUrl(video.provider, video.externalId),
    provider: "YOUTUBE", videoUrl: video.videoUrl, externalId: video.externalId,
    durationSeconds: video.durationSeconds, viewCount: video.viewCount,
    publishedAt: video.publishedAt, updatedAt: video.updatedAt,
    category: video.category, author: video.author,
    tags: video.tags.map(({ tag }) => tag), relatedArticles, article: relatedArticles[0] ?? null,
  };
}

function mapLegacy(title: string, canonicalUrl: string, externalId: string, article: LegacyArticle, updatedAt = article.publishedAt ?? new Date(0)): PublicVideoCard {
  return {
    id: null, slug: videoRouteSlug(title, externalId), title, description: article.title,
    thumbnailUrl: videoThumbnailUrl("YOUTUBE", externalId), provider: "YOUTUBE",
    videoUrl: canonicalUrl, externalId, durationSeconds: null, viewCount: BigInt(0),
    publishedAt: article.publishedAt, updatedAt, category: null, author: null, tags: [],
    relatedArticles: [article], article,
  };
}

async function legacyVideos(take: number, omitIds: Set<string> = new Set()) {
  const rows = await prisma.articleRelatedVideo.findMany({
    where: { provider: "youtube", article: publicArticleWhere },
    select: { title: true, externalId: true, canonicalUrl: true, article: { select: { id: true, slug: true, title: true, publishedAt: true } } },
    orderBy: [{ article: { publishedAt: "desc" } }, { position: "asc" }], take: 500,
  });
  const seen = new Set(omitIds);
  const result: PublicVideoCard[] = [];
  for (const row of rows) {
    if (seen.has(row.externalId)) continue;
    seen.add(row.externalId);
    result.push(mapLegacy(row.title, row.canonicalUrl, row.externalId, row.article));
    if (result.length >= take) break;
  }
  return result;
}

export async function listVideos(take = 20) {
  const safeTake = Math.max(1, Math.min(2000, Math.trunc(take)));
  const records = await prisma.video.findMany({ where: publishedWhere, select: videoCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: safeTake });
  const videos = records.map(mapVideo);
  if (videos.length >= safeTake) return videos;
  const fallback = await legacyVideos(safeTake - videos.length, new Set(videos.map(({ externalId }) => externalId)));
  return [...videos, ...fallback];
}

export async function getRelatedPublicVideos(excludeExternalId: string, take = 4) {
  const safeTake = Math.max(1, Math.min(8, Math.trunc(take)));
  const records = await prisma.video.findMany({
    where: { ...publishedWhere, externalId: { not: excludeExternalId } },
    select: { id: true, slug: true, title: true, thumbnailUrl: true, provider: true, externalId: true },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: safeTake,
  });
  const result: Array<{ id: string | null; externalId: string; slug: string; title: string; thumbnailUrl: string | null }> = records.map((video) => ({ id: video.id, externalId: video.externalId, slug: video.slug, title: video.title, thumbnailUrl: video.thumbnailUrl ?? videoThumbnailUrl(video.provider, video.externalId) }));
  if (result.length >= safeTake) return result;

  const rows = await prisma.articleRelatedVideo.findMany({
    where: { provider: "youtube", externalId: { notIn: [excludeExternalId, ...records.map(({ externalId }) => externalId)] }, article: publicArticleWhere },
    select: { title: true, externalId: true },
    orderBy: [{ article: { publishedAt: "desc" } }, { position: "asc" }],
    take: 40,
  });
  const seen = new Set([excludeExternalId, ...records.map(({ externalId }) => externalId)]);
  for (const row of rows) {
    if (seen.has(row.externalId)) continue;
    seen.add(row.externalId);
    result.push({ id: null, externalId: row.externalId, slug: videoRouteSlug(row.title, row.externalId), title: row.title, thumbnailUrl: videoThumbnailUrl("YOUTUBE", row.externalId) });
    if (result.length >= safeTake) break;
  }
  return result;
}

export async function getPublicVideoIndex(page = 1, pageSize = 24, categorySlug?: string) {
  const safePage = Math.max(1, Math.min(1000, Math.trunc(page || 1)));
  const safePageSize = Math.max(1, Math.min(48, Math.trunc(pageSize || 24)));
  const category = categorySlug ? await prisma.category.findFirst({ where: { slug: categorySlug, isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true } }) : null;
  if (categorySlug && !category) return { category: null, categories: [], videos: [], page: safePage, total: 0, totalPages: 1 };
  const where: Prisma.VideoWhereInput = { ...publishedWhere, ...(category ? { categoryId: category.id } : {}) };
  const [records, total, categories] = await Promise.all([
    prisma.video.findMany({ where, select: videoCardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: safePageSize, skip: (safePage - 1) * safePageSize }),
    prisma.video.count({ where }),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null, videos: { some: publishedWhere } }, select: { id: true, name: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  let videos = records.map(mapVideo);
  let adjustedTotal = total;
  if (safePage === 1 && !category && videos.length < safePageSize) {
    const fallback = await legacyVideos(safePageSize - videos.length, new Set(videos.map(({ externalId }) => externalId)));
    videos = [...videos, ...fallback];
    adjustedTotal += fallback.length;
  }
  return { category, categories, videos, page: safePage, total: adjustedTotal, totalPages: Math.max(1, Math.ceil(adjustedTotal / safePageSize)) };
}

export const getPublicVideo = cache(async function getPublicVideo(routeSlug: string) {
  const record = await prisma.video.findFirst({ where: { ...publishedWhere, slug: routeSlug }, select: {
    ...videoCardSelect,
    seoTitle: true,
    seoDescription: true,
  } });
  if (record) return { ...mapVideo(record), seoTitle: record.seoTitle, seoDescription: record.seoDescription };

  const match = routeSlug.match(/--yt-([A-Za-z0-9_-]{11})$/);
  if (!match) return null;
  const externalId = match[1]!;
  const items = await prisma.articleRelatedVideo.findMany({ where: { externalId, provider: "youtube", article: publicArticleWhere }, select: { title: true, canonicalUrl: true, article: { select: { id: true, slug: true, title: true, publishedAt: true } } }, orderBy: { article: { publishedAt: "desc" } }, take: 20 });
  if (!items.length) return null;
  const lead = items[0]!;
  const relatedArticles = [...new Map(items.map(({ article }) => [article.slug, article])).values()];
  return { ...mapLegacy(lead.title, lead.canonicalUrl, externalId, lead.article), relatedArticles, seoTitle: null, seoDescription: lead.article.title };
});

export async function recordPublicVideoView(slug: string, rawIp: string | null) {
  const video = await prisma.video.findFirst({ where: { ...publishedWhere, slug }, select: { id: true } });
  if (!video) return false;
  if (!rawIp || !isIP(rawIp)) return false;
  const key = VIEW_PREFIX + createHmac("sha256", env.BETTER_AUTH_SECRET).update(`${video.id}:${rawIp}`).digest("hex");
  const now = BigInt(Date.now());
  const cutoff = now - BigInt(VIEW_WINDOW_MS);
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (gen_random_uuid(), ${key}, 1, ${now})
    ON CONFLICT ("key") DO NOTHING
    RETURNING "id"
  `);
  let counted = inserted.length > 0;
  if (!counted) {
    const refreshed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "rateLimit" SET "count" = 1, "lastRequest" = ${now}
      WHERE "key" = ${key} AND "lastRequest" < ${cutoff}
      RETURNING "id"
    `);
    counted = refreshed.length > 0;
  }
  if (!counted) return false;
  const metricDate = dhakaDayStart(new Date());
  await prisma.$transaction([
    prisma.video.update({ where: { id: video.id }, data: { viewCount: { increment: BigInt(1) } } }),
    prisma.videoDailyMetric.upsert({
      where: { videoId_metricDate: { videoId: video.id, metricDate } },
      create: { videoId: video.id, metricDate, views: BigInt(1) },
      update: { views: { increment: BigInt(1) } },
    }),
  ]);
  return true;
}
