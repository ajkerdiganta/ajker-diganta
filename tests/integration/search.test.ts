import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchPublicContent } from "@/lib/public-search";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];
const categoryIds: string[] = [];
const authorIds: string[] = [];
const tagIds: string[] = [];
const articleIds: string[] = [];
const videoIds: string[] = [];

async function createFixtures() {
  const user = await prisma.user.create({ data: { name: `Search fixture ${suffix}`, email: `search-${suffix}@example.test` }, select: { id: true } });
  userIds.push(user.id);
  const category = await prisma.category.create({ data: { name: `প্রযুক্তি ${suffix}`, slug: `search-tech-${suffix}`, description: "বাংলাদেশ প্রযুক্তি AI" }, select: { id: true, slug: true } });
  categoryIds.push(category.id);
  const author = await prisma.author.create({ data: { name: `নাসরিন ঢাকা ${suffix}`, title: "প্রতিবেদক Reporter", slug: `search-author-${suffix}`, bio: "Cyber Security বাংলা" }, select: { id: true, slug: true } });
  authorIds.push(author.id);
  const tag = await prisma.tag.create({ data: { name: `Cyber Security ${suffix}`, normalizedName: `cyber security ${suffix}`, slug: `search-tag-${suffix}` }, select: { id: true, slug: true } });
  tagIds.push(tag.id);
  const publishedAt = new Date("2026-09-29T12:00:00.000Z");
  const article = await prisma.article.create({ data: {
    slug: `search-article-${suffix}`, title: `বাংলাদেশ Cyber Security ঢাকা ${suffix}`, subtitle: "বাংলা ও English mixed headline", excerpt: "ঢাকা বিশ্ববিদ্যালয় — AI সংবাদ",
    body: { type: "doc", content: [] }, bodyHtml: "<p>বাংলাদেশ সরকার; রাজনীতি, অর্থনীতি, খেলা</p>", status: "PUBLISHED", approvedById: user.id, approvedRevisionNumber: 1, publishedRevisionNumber: 1, publishedAt,
    createdById: user.id, updatedById: user.id,
  }, select: { id: true } });
  articleIds.push(article.id);
  await prisma.articleCategory.create({ data: { articleId: article.id, categoryId: category.id, isPrimary: true } });
  await prisma.articleAuthor.create({ data: { articleId: article.id, authorId: author.id, isPrimary: true } });
  await prisma.articleTag.create({ data: { articleId: article.id, tagId: tag.id } });
  const video = await prisma.video.create({ data: {
    slug: `search-video-${suffix}`, title: `AI Dhaka ভিডিও ${suffix}`, description: "Bangladesh Cyber Security", videoUrl: "https://youtu.be/abcdefgh123", externalId: `search-${suffix}`,
    status: "PUBLISHED", publishedRevisionNumber: 1, publishedAt, categoryId: category.id, authorId: author.id,
    createdById: user.id, updatedById: user.id,
  }, select: { id: true } });
  videoIds.push(video.id);
  await prisma.videoTag.create({ data: { videoId: video.id, tagId: tag.id } });
  return { user, category, author, tag, article, video, publishedAt };
}

async function cleanup() {
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (articleIds.length) await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
  if (categoryIds.length) await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  if (tagIds.length) await prisma.tag.deleteMany({ where: { id: { in: tagIds } } });
  if (authorIds.length) await prisma.author.deleteMany({ where: { id: { in: authorIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  videoIds.length = 0; articleIds.length = 0; categoryIds.length = 0; tagIds.length = 0; authorIds.length = 0; userIds.length = 0;
}

afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("PostgreSQL Bengali multi-entity search", () => {
  it("matches Bengali, English, mixed terms, partials and related entity text", async () => {
    const fixtures = await createFixtures();
    const bengali = await searchPublicContent({ q: "বাংলাদেশ" });
    expect(bengali.results.some((result) => result.id === fixtures.article.id)).toBe(true);
    expect((await searchPublicContent({ q: "Bangladesh" })).results.some((result) => result.id === fixtures.video.id)).toBe(true);
    expect((await searchPublicContent({ q: "বাংলাদেশ Cyber" })).results.some((result) => result.id === fixtures.article.id)).toBe(true);
    expect((await searchPublicContent({ q: "Cyber Sec" })).results.some((result) => result.id === fixtures.video.id)).toBe(true);
    expect((await searchPublicContent({ q: "Dhaka" })).results.some((result) => result.id === fixtures.video.id)).toBe(true);
    expect((await searchPublicContent({ q: "AI" })).results.some((result) => result.id === fixtures.video.id)).toBe(true);
    for (const q of ["রাজনীতি", "অর্থনীতি", "খেলা", "বাংলাদেশ সরকার"]) expect((await searchPublicContent({ q })).results.some((result) => result.id === fixtures.article.id)).toBe(true);
    expect((await searchPublicContent({ q: "প্রযুক্তি" })).results.some((result) => result.type === "categories" && result.slug === fixtures.category.slug)).toBe(true);
    expect((await searchPublicContent({ q: "ভূমিকা" })).total).toBe(0);
    expect((await searchPublicContent({ q: `নাসরিন ঢাকা ${suffix}` })).results.some((result) => result.type === "authors" && result.slug === fixtures.author.slug)).toBe(true);
    expect((await searchPublicContent({ q: `Cyber Security ${suffix}`, type: "tags" })).results.some((result) => result.type === "tags" && result.slug === fixtures.tag.slug)).toBe(true);
    expect((await searchPublicContent({ q: "ঢাকা বিশ্ববিদ্যালয়" })).results.some((result) => result.id === fixtures.article.id)).toBe(true);
  });

  it("applies content type, category, author, Dhaka-local date, ordering and URL-safe paging", async () => {
    const fixtures = await createFixtures();
    const byArticle = await searchPublicContent({ q: "বাংলাদেশ", type: "articles", category: fixtures.category.slug, author: fixtures.author.slug, from: "2026-09-29", to: "2026-09-29", sort: "newest" });
    expect(byArticle.results.map(({ id }) => id)).toContain(fixtures.article.id);
    expect(byArticle.filters).toMatchObject({ type: "articles", category: fixtures.category.slug, author: fixtures.author.slug, from: "2026-09-29", to: "2026-09-29", sort: "newest" });
    expect((await searchPublicContent({ q: "বাংলাদেশ", type: "videos", category: "missing-category" })).total).toBe(0);
    const videoFilter = await searchPublicContent({ q: "AI Dhaka", type: "videos", category: fixtures.category.slug, author: fixtures.author.slug, from: "2026-09-29", to: "2026-09-29" });
    expect(videoFilter.results.map(({ id }) => id)).toContain(fixtures.video.id);
    expect((await searchPublicContent({ q: "বাংলাদেশ", from: "2030-01-01", to: "2030-01-02" })).total).toBe(0);
    expect((await searchPublicContent({ q: "বাংলাদেশ", page: 100_000 })).page).toBe(1000);
    expect((await searchPublicContent({ q: "শূন্য ফল" })).results).toHaveLength(0);
  });

  it("blocks SQL injection and handles pagination deterministically; records a bounded query time", async () => {
    const fixtures = await createFixtures();
    const attack = await searchPublicContent({ q: `Bangladesh' OR 'xx'='yy -- ${suffix}` });
    expect(attack.results).toHaveLength(0);
    const attemptedSortInjection = await searchPublicContent({ q: `বাংলাদেশ ${suffix}`, sort: "newest; DROP TABLE Article;--" });
    expect(attemptedSortInjection.filters.sort).toBe("relevance");
    const now = fixtures.publishedAt;
    for (let index = 0; index < 13; index += 1) {
      const article = await prisma.article.create({ data: {
        slug: `page-${index}-${suffix}`, title: `Pagination সংবাদ ${index} ${suffix}`, body: { type: "doc", content: [] }, bodyHtml: "", status: "PUBLISHED", approvedById: fixtures.user.id, approvedRevisionNumber: 1, publishedRevisionNumber: 1,
        publishedAt: new Date(now.getTime() + index * 60_000), createdById: fixtures.user.id, updatedById: fixtures.user.id,
      }, select: { id: true } });
      articleIds.push(article.id);
    }
    const started = performance.now();
    const firstPage = await searchPublicContent({ q: `Pagination ${suffix}`, type: "articles", sort: "newest", page: 1 });
    const secondPage = await searchPublicContent({ q: `Pagination ${suffix}`, type: "articles", sort: "newest", page: 2 });
    const elapsedMs = performance.now() - started;
    expect(firstPage.total).toBe(13);
    expect(firstPage.results).toHaveLength(12);
    expect(secondPage.results).toHaveLength(1);
    expect(firstPage.results[0]?.title).toContain("12");
    expect(new Set([...firstPage.results, ...secondPage.results].map(({ id }) => id)).size).toBe(13);
    expect(elapsedMs).toBeLessThan(15_000);
  });
});
