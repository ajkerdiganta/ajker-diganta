import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveAnalyticsRange } from "@/lib/admin-analytics-range";

export { ANALYTICS_PERIODS, resolveAnalyticsRange } from "@/lib/admin-analytics-range";
export type { AnalyticsPeriod, AnalyticsRange } from "@/lib/admin-analytics-range";

export type PopularAnalyticsItem = { title: string; slug: string; views: string };
export type PopularCategoryItem = { name: string; slug: string; views: string };
export type AdminAnalytics = {
  period: ReturnType<typeof resolveAnalyticsRange>;
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  pendingReviewArticles: number;
  totalVideos: number;
  totalUsers: number;
  newUsers: number;
  articleViews: string;
  videoViews: string;
  savedArticles: number;
  favouriteArticles: number;
  popularArticles: PopularAnalyticsItem[];
  popularVideos: PopularAnalyticsItem[];
  popularCategories: PopularCategoryItem[];
};

type AggregateRow = {
  total_articles: bigint;
  published_articles: bigint;
  draft_articles: bigint;
  pending_review_articles: bigint;
  total_videos: bigint;
  total_users: bigint;
  new_users: bigint;
  article_views: bigint;
  video_views: bigint;
  saved_articles: bigint;
  favourite_articles: bigint;
  popular_articles: PopularAnalyticsItem[];
  popular_videos: PopularAnalyticsItem[];
  popular_categories: PopularCategoryItem[];
};

const publicArticle = Prisma.sql`a."status" = 'PUBLISHED' AND a."publishedAt" IS NOT NULL AND a."publishedRevisionNumber" IS NOT NULL AND a."deletedAt" IS NULL`;
const publicVideo = Prisma.sql`v."status" = 'PUBLISHED' AND v."publishedAt" IS NOT NULL AND v."publishedRevisionNumber" IS NOT NULL AND v."deletedAt" IS NULL`;

export async function getAdminAnalytics(input: { period?: string; from?: string; to?: string }, now = new Date()): Promise<AdminAnalytics> {
  const range = resolveAnalyticsRange(input, now);
  const [row] = await prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
    WITH article_period_views AS (
      SELECT a."id", a."title", a."slug", m."views"
      FROM "ArticleDailyMetric" m
      JOIN "Article" a ON a."id" = m."articleId"
      WHERE m."metricDate" >= ${range.from}::date
        AND m."metricDate" <= ${range.to}::date
        AND ${publicArticle}
    ),
    video_period_views AS (
      SELECT v."id", v."title", v."slug", v."categoryId", m."views"
      FROM "video_daily_metrics" m
      JOIN "Video" v ON v."id" = m."videoId"
      JOIN "Category" c ON c."id" = v."categoryId" AND c."isActive" = TRUE AND c."deletedAt" IS NULL
      WHERE m."metricDate" >= ${range.from}::date
        AND m."metricDate" <= ${range.to}::date
        AND ${publicVideo}
    ),
    category_period_views AS (
      SELECT c."id", c."name", c."slug", SUM(apv."views") AS views
      FROM article_period_views apv
      JOIN "ArticleCategory" ac ON ac."articleId" = apv."id" AND ac."isPrimary" = TRUE
      JOIN "Category" c ON c."id" = ac."categoryId" AND c."isActive" = TRUE AND c."deletedAt" IS NULL
      GROUP BY c."id", c."name", c."slug"
      UNION ALL
      SELECT c."id", c."name", c."slug", SUM(vpv."views") AS views
      FROM video_period_views vpv
      JOIN "Category" c ON c."id" = vpv."categoryId" AND c."isActive" = TRUE AND c."deletedAt" IS NULL
      GROUP BY c."id", c."name", c."slug"
    ),
    category_totals AS (
      SELECT "id", "name", "slug", SUM("views")::bigint AS views
      FROM category_period_views
      GROUP BY "id", "name", "slug"
    )
    SELECT
      (SELECT COUNT(*) FROM "Article" WHERE "deletedAt" IS NULL)::bigint AS total_articles,
      (SELECT COUNT(*) FROM "Article" WHERE "deletedAt" IS NULL AND "status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "publishedRevisionNumber" IS NOT NULL)::bigint AS published_articles,
      (SELECT COUNT(*) FROM "Article" WHERE "deletedAt" IS NULL AND "status" = 'DRAFT')::bigint AS draft_articles,
      (SELECT COUNT(*) FROM "Article" WHERE "deletedAt" IS NULL AND "status" IN ('SUBMITTED', 'UNDER_REVIEW'))::bigint AS pending_review_articles,
      (SELECT COUNT(*) FROM "Video" WHERE "deletedAt" IS NULL)::bigint AS total_videos,
      (SELECT COUNT(*) FROM "user" WHERE "status" = 'ACTIVE')::bigint AS total_users,
      (SELECT COUNT(*) FROM "user" WHERE "status" = 'ACTIVE' AND "createdAt" >= ${range.startAt} AND "createdAt" < ${range.endExclusive})::bigint AS new_users,
      COALESCE((SELECT SUM("views") FROM article_period_views), 0)::bigint AS article_views,
      COALESCE((SELECT SUM("views") FROM video_period_views), 0)::bigint AS video_views,
      (SELECT COUNT(*) FROM "saved_articles" s JOIN "Article" a ON a."id" = s."articleId" WHERE s."createdAt" >= ${range.startAt} AND s."createdAt" < ${range.endExclusive} AND ${publicArticle})::bigint AS saved_articles,
      (SELECT COUNT(*) FROM "favourite_articles" f JOIN "Article" a ON a."id" = f."articleId" WHERE f."createdAt" >= ${range.startAt} AND f."createdAt" < ${range.endExclusive} AND ${publicArticle})::bigint AS favourite_articles,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('title', ranked."title", 'slug', ranked."slug", 'views', ranked.views::text) ORDER BY ranked.views DESC, ranked."title" ASC) FROM (
        SELECT "id", "title", "slug", SUM("views")::bigint AS views
        FROM article_period_views GROUP BY "id", "title", "slug"
        HAVING SUM("views") > 0 ORDER BY SUM("views") DESC, "title" ASC LIMIT 5
      ) ranked), '[]'::jsonb) AS popular_articles,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('title', ranked."title", 'slug', ranked."slug", 'views', ranked.views::text) ORDER BY ranked.views DESC, ranked."title" ASC) FROM (
        SELECT "id", "title", "slug", SUM("views")::bigint AS views
        FROM video_period_views GROUP BY "id", "title", "slug"
        HAVING SUM("views") > 0 ORDER BY SUM("views") DESC, "title" ASC LIMIT 5
      ) ranked), '[]'::jsonb) AS popular_videos,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('name', ranked."name", 'slug', ranked."slug", 'views', ranked.views::text) ORDER BY ranked.views DESC, ranked."name" ASC) FROM (
        SELECT "id", "name", "slug", SUM("views")::bigint AS views
        FROM category_totals GROUP BY "id", "name", "slug", views
        HAVING SUM("views") > 0 ORDER BY SUM("views") DESC, "name" ASC LIMIT 5
      ) ranked), '[]'::jsonb) AS popular_categories
  `);

  if (!row) throw new Error("Analytics aggregation returned no row");
  return {
    period: range,
    totalArticles: Number(row.total_articles),
    publishedArticles: Number(row.published_articles),
    draftArticles: Number(row.draft_articles),
    pendingReviewArticles: Number(row.pending_review_articles),
    totalVideos: Number(row.total_videos),
    totalUsers: Number(row.total_users),
    newUsers: Number(row.new_users),
    articleViews: row.article_views.toString(),
    videoViews: row.video_views.toString(),
    savedArticles: Number(row.saved_articles),
    favouriteArticles: Number(row.favourite_articles),
    popularArticles: row.popular_articles ?? [],
    popularVideos: row.popular_videos ?? [],
    popularCategories: row.popular_categories ?? [],
  };
}
