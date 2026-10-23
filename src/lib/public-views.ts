import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { dhakaDayStart } from "@/lib/public-news";
import { prisma } from "@/lib/prisma";

const VIEW_PREFIX = "public-view-v1:";
const VIEW_WINDOW_MS = 30 * 60 * 1000;

export async function recordPublicArticleView(slug: string, rawIp: string | null) {
  const article = await prisma.article.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null }, select: { id: true } });
  if (!article) return false;
  if (!rawIp || !isIP(rawIp)) return false;
  const key = VIEW_PREFIX + createHmac("sha256", env.BETTER_AUTH_SECRET).update(`${article.id}:${rawIp}`).digest("hex");
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
  await prisma.articleDailyMetric.upsert({
    where: { articleId_metricDate: { articleId: article.id, metricDate } },
    create: { articleId: article.id, metricDate, views: BigInt(1) },
    update: { views: { increment: BigInt(1) } },
  });
  return true;
}

export async function cleanupPublicViewDedupKeys(now = BigInt(Date.now())) {
  const result = await prisma.rateLimit.deleteMany({ where: { key: { startsWith: VIEW_PREFIX }, lastRequest: { lt: now - BigInt(14 * 86_400_000) } } });
  return result.count;
}
