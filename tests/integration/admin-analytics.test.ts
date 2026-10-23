import { randomBytes } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAnalyticsRange } from "@/lib/admin-analytics-range";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
let ipCounter = 20;
const userIds: string[] = [];
const articleIds: string[] = [];
const videoIds: string[] = [];
const categoryIds: string[] = [];
const authorIds: string[] = [];

async function signup(label: string) {
  const email = `${label}-${suffix}@example.test`;
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `198.18.${Math.floor(Math.random() * 200) + 1}.${ipCounter++}` },
    body: JSON.stringify({ name: `পরিসংখ্যান ${label}`, email, password: randomTestPassword() }),
  }));
  expect(response.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  userIds.push(user.id);
  const session = response.headers.getSetCookie().find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(session).toBeTruthy();
  return { id: user.id, email, cookie: session!.split(";")[0]! };
}

async function grant(userId: string, code: "ADMIN" | "EDITOR") {
  const role = await prisma.role.findUniqueOrThrow({ where: { code } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

function request(cookie?: string, query = "") {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${origin}/api/admin/analytics${query}`, { headers });
}

async function cleanup() {
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (articleIds.length) await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (authorIds.length) await prisma.author.deleteMany({ where: { id: { in: authorIds } } });
  if (categoryIds.length) await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  videoIds.length = 0; articleIds.length = 0; userIds.length = 0; authorIds.length = 0; categoryIds.length = 0;
}

afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("Phase 8 admin analytics", () => {
  it("rejects anonymous, reader, and editorial access; exposes only aggregate metrics to admins", async () => {
    const route = await import("@/app/api/admin/analytics/route");
    expect((await route.GET(request())).status).toBe(401);
    const reader = await signup("reader");
    const editor = await signup("editor");
    const admin = await signup("admin");
    await grant(editor.id, "EDITOR");
    await grant(admin.id, "ADMIN");
    expect((await route.GET(request(reader.cookie))).status).toBe(403);
    expect((await route.GET(request(editor.cookie))).status).toBe(403);

    const started = performance.now();
    const response = await route.GET(request(admin.cookie, "?period=7d"));
    const elapsedMs = performance.now() - started;
    expect(response.status).toBe(200);
    expect(elapsedMs).toBeLessThan(3_000);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toMatchObject({ period: expect.objectContaining({ period: "7d" }) });
    expect(payload).toHaveProperty("totalArticles");
    expect(payload).toHaveProperty("popularArticles");
    expect(payload).toHaveProperty("popularVideos");
    expect(payload).toHaveProperty("popularCategories");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(admin.email);
    expect(serialized).not.toContain(admin.id);
  });

  it("aggregates published-only view metrics, saves/favourites, new users and popular category within the selected dates", async () => {
    const route = await import("@/app/api/admin/analytics/route");
    const range = resolveAnalyticsRange({ period: "today" });
    const previousDate = new Date(range.fromDate.getTime() - 86_400_000);
    const from = previousDate.toISOString().slice(0, 10);
    const to = range.to;
    const admin = await signup("aggregate-admin");
    await grant(admin.id, "ADMIN");
    const category = await prisma.category.create({ data: { name: `পরিসংখ্যান বিভাগ ${suffix}`, slug: `analytics-category-${suffix}`, isActive: true } });
    categoryIds.push(category.id);
    const author = await prisma.author.create({ data: { name: `পরিসংখ্যান লেখক ${suffix}`, slug: `analytics-author-${suffix}`, userId: admin.id } });
    authorIds.push(author.id);

    const article = await prisma.article.create({ data: {
      slug: `analytics-story-${suffix}`, title: `বিশেষ পরীক্ষামূলক সংবাদ ${suffix}`,
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "বাংলা সংবাদ" }] }] },
      bodyHtml: "<p>বাংলা সংবাদ</p>", status: "PUBLISHED", publishedAt: new Date(), approvedRevisionNumber: 1,
      publishedRevisionNumber: 1, approvedById: admin.id, publishedById: admin.id, createdById: admin.id, updatedById: admin.id,
      categories: { create: { categoryId: category.id, isPrimary: true } },
    } });
    articleIds.push(article.id);
    const draft = await prisma.article.create({ data: {
      slug: `analytics-draft-${suffix}`, title: `পরীক্ষামূলক খসড়া ${suffix}`,
      body: { type: "doc", content: [] }, bodyHtml: "", status: "DRAFT", createdById: admin.id, updatedById: admin.id,
    } });
    articleIds.push(draft.id);
    await prisma.article.create({ data: {
      slug: `analytics-submitted-${suffix}`, title: `পর্যালোচনার অপেক্ষা ${suffix}`,
      body: { type: "doc", content: [] }, bodyHtml: "", status: "SUBMITTED", createdById: admin.id, updatedById: admin.id,
    } }).then((record) => articleIds.push(record.id));
    const video = await prisma.video.create({ data: {
      slug: `analytics-video-${suffix}`, title: `জনপ্রিয় পরীক্ষামূলক ভিডিও ${suffix}`, description: "বাংলা ভিডিও বিবরণ",
      provider: "YOUTUBE", videoUrl: "https://youtu.be/BaW_jenozKc", externalId: `analytics-${suffix}`,
      status: "PUBLISHED", approvedRevisionNumber: 1, publishedRevisionNumber: 1, publishedAt: new Date(),
      categoryId: category.id, authorId: author.id, createdById: admin.id, updatedById: admin.id,
      approvedById: admin.id, publishedById: admin.id,
    } });
    videoIds.push(video.id);

    await prisma.articleDailyMetric.createMany({ data: [
      { articleId: article.id, metricDate: previousDate, views: BigInt(120) },
      { articleId: article.id, metricDate: range.fromDate, views: BigInt(45) },
      { articleId: draft.id, metricDate: range.fromDate, views: BigInt(999) },
    ] });
    await prisma.videoDailyMetric.create({ data: { videoId: video.id, metricDate: range.fromDate, views: BigInt(35) } });
    await prisma.savedArticle.create({ data: { userId: admin.id, articleId: article.id } });
    await prisma.favouriteArticle.create({ data: { userId: admin.id, articleId: article.id } });

    const response = await route.GET(request(admin.cookie, `?period=custom&from=${from}&to=${to}`));
    expect(response.status).toBe(200);
    const data = await response.json() as {
      totalArticles: number; publishedArticles: number; draftArticles: number; pendingReviewArticles: number;
      totalVideos: number; totalUsers: number; newUsers: number; articleViews: string; videoViews: string;
      savedArticles: number; favouriteArticles: number;
      popularArticles: Array<{ slug: string; views: string }>;
      popularVideos: Array<{ slug: string; views: string }>;
      popularCategories: Array<{ slug: string; views: string }>;
    };
    expect(data.totalArticles).toBeGreaterThanOrEqual(3);
    expect(data.publishedArticles).toBeGreaterThanOrEqual(1);
    expect(data.draftArticles).toBeGreaterThanOrEqual(1);
    expect(data.pendingReviewArticles).toBeGreaterThanOrEqual(1);
    expect(data.totalVideos).toBeGreaterThanOrEqual(1);
    expect(data.totalUsers).toBeGreaterThanOrEqual(1);
    expect(data.newUsers).toBeGreaterThanOrEqual(1);
    expect(BigInt(data.articleViews)).toBeGreaterThanOrEqual(BigInt(165));
    expect(BigInt(data.videoViews)).toBeGreaterThanOrEqual(BigInt(35));
    expect(data.savedArticles).toBeGreaterThanOrEqual(1);
    expect(data.favouriteArticles).toBeGreaterThanOrEqual(1);
    expect(data.popularArticles.find((item) => item.slug === article.slug)?.views).toBe("165");
    expect(data.popularVideos.find((item) => item.slug === video.slug)?.views).toBe("35");
    expect(data.popularCategories.find((item) => item.slug === category.slug)?.views).toBe("200");
  });
});
