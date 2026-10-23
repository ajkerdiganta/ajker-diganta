import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
let signupIp = 90;
const createdUserIds: string[] = [];
const createdArticleIds: string[] = [];
let categoryId = "";
let topicId = "";

type Account = { id: string; cookie: string; name: string; email: string };
async function signup(label: string): Promise<Account> {
  const name = `${label} ${suffix}`;
  const email = `${label.toLowerCase()}-${suffix}@example.test`;
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `203.0.${Math.floor(Math.random() * 200) + 1}.${signupIp++}` },
    body: JSON.stringify({ name, email, password: "নিরাপদ-Personal-123!" }),
  }));
  expect(response.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, name: true, email: true } });
  createdUserIds.push(user.id);
  const session = response.headers.getSetCookie().find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(session).toBeTruthy();
  return { ...user, cookie: session!.split(";")[0]! };
}

function request(path: string, method = "GET", cookie?: string, body?: Record<string, unknown>, trustedOrigin = origin, ip?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (trustedOrigin) headers.set("origin", trustedOrigin);
  if (body) headers.set("content-type", "application/json");
  if (ip) headers.set("x-real-ip", ip);
  return new Request(`${origin}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function createPublishedArticle(userId: string, slug: string, title: string) {
  const article = await prisma.article.create({ data: {
    slug, title, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] }, bodyHtml: `<p>${title}</p>`,
    status: "PUBLISHED", publishedAt: new Date(), approvedRevisionNumber: 1, publishedRevisionNumber: 1, approvedById: userId, publishedById: userId, createdById: userId, updatedById: userId,
  }, select: { id: true, slug: true } });
  createdArticleIds.push(article.id);
  if (categoryId) await prisma.articleCategory.create({ data: { articleId: article.id, categoryId, isPrimary: true } });
  if (topicId) await prisma.articleTag.create({ data: { articleId: article.id, tagId: topicId } });
  return article;
}

async function cleanup() {
  if (createdArticleIds.length) await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
  if (topicId) await prisma.tag.deleteMany({ where: { id: topicId } });
  createdArticleIds.length = 0; createdUserIds.length = 0; categoryId = ""; topicId = "";
}

afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("Phase 4 user personalization authorization", () => {
  it("keeps saves separate from favourites and blocks cross-account reads and manipulated user IDs", async () => {
    const userA = await signup("reader-a");
    const userB = await signup("reader-b");
    categoryId = (await prisma.category.create({ data: { name: `ব্যবসা ${suffix}`, slug: `personal-category-${suffix}` }, select: { id: true } })).id;
    topicId = (await prisma.tag.create({ data: { name: `অর্থনীতি ${suffix}`, slug: `personal-topic-${suffix}`, normalizedName: `personal-topic-${suffix}` }, select: { id: true } })).id;
    const articleA = await createPublishedArticle(userA.id, `personal-a-${suffix}`, "ব্যবহারকারী ক-এর সংবাদ");
    const articleB = await createPublishedArticle(userB.id, `personal-b-${suffix}`, "ব্যবহারকারী খ-এর সংবাদ");
    const collectionRoute = await import("@/app/api/me/articles/[id]/[collection]/route");

    const saved = await collectionRoute.PUT(request(`/api/me/articles/${articleA.id}/saved`, "PUT", userA.cookie), { params: Promise.resolve({ id: articleA.id, collection: "saved" }) });
    expect(saved.status).toBe(200);
    const favourite = await collectionRoute.PUT(request(`/api/me/articles/${articleA.id}/favourite`, "PUT", userA.cookie), { params: Promise.resolve({ id: articleA.id, collection: "favourite" }) });
    expect(favourite.status).toBe(200);
    const otherSaved = await collectionRoute.PUT(request(`/api/me/articles/${articleB.id}/saved`, "PUT", userB.cookie), { params: Promise.resolve({ id: articleB.id, collection: "saved" }) });
    expect(otherSaved.status).toBe(200);
    const otherFavourite = await collectionRoute.PUT(request(`/api/me/articles/${articleB.id}/favourite`, "PUT", userB.cookie), { params: Promise.resolve({ id: articleB.id, collection: "favourite" }) });
    expect(otherFavourite.status).toBe(200);
    const idorSavedDelete = await collectionRoute.DELETE(request(`/api/me/articles/${articleB.id}/saved`, "DELETE", userA.cookie, { userId: userB.id }), { params: Promise.resolve({ id: articleB.id, collection: "saved" }) });
    const idorFavouriteDelete = await collectionRoute.DELETE(request(`/api/me/articles/${articleB.id}/favourite`, "DELETE", userA.cookie, { userId: userB.id }), { params: Promise.resolve({ id: articleB.id, collection: "favourite" }) });
    expect(idorSavedDelete.status).toBe(200); expect(idorFavouriteDelete.status).toBe(200);
    expect(await prisma.savedArticle.count({ where: { userId: userB.id, articleId: articleB.id } })).toBe(1);
    expect(await prisma.favouriteArticle.count({ where: { userId: userB.id, articleId: articleB.id } })).toBe(1);

    expect(await prisma.savedArticle.count({ where: { userId: userA.id } })).toBe(1);
    expect(await prisma.favouriteArticle.count({ where: { userId: userA.id } })).toBe(1);
    const dashboardRoute = await import("@/app/api/me/dashboard/route");
    const dashboardA = await dashboardRoute.GET(request("/api/me/dashboard", "GET", userA.cookie));
    expect(dashboardA.status).toBe(200);
    const dataA = await dashboardA.json();
    expect(dataA.savedArticles.map((row: { article: { id: string } }) => row.article.id)).toEqual([articleA.id]);
    expect(dataA.favouriteArticles.map((row: { article: { id: string } }) => row.article.id)).toEqual([articleA.id]);
    expect(dataA.savedArticles[0].article.id).not.toBe(articleB.id);
    expect(dataA.favouriteArticles[0].article.id).not.toBe(articleB.id);
    const collectionListRoute = await import("@/app/api/me/collections/[collection]/route");
    const attackerQueryList = await collectionListRoute.GET(request(`/api/me/collections/saved?userId=${userB.id}`, "GET", userA.cookie), { params: Promise.resolve({ collection: "saved" }) });
    expect(attackerQueryList.status).toBe(200);
    expect((await attackerQueryList.json()).items.map((row: { article: { id: string } }) => row.article.id)).toEqual([articleA.id]);
    const smallPage = await collectionListRoute.GET(request(`/api/me/collections/saved?page=1&pageSize=1`, "GET", userA.cookie), { params: Promise.resolve({ collection: "saved" }) });
    expect((await smallPage.json()).pageSize).toBe(1);
    expect((await collectionListRoute.GET(request("/api/me/collections/favourite", "GET", undefined), { params: Promise.resolve({ collection: "favourite" }) })).status).toBe(401);
    expect((await collectionListRoute.GET(request("/api/me/collections/combined", "GET", userA.cookie), { params: Promise.resolve({ collection: "combined" }) })).status).toBe(404);

    const removeSaved = await collectionRoute.DELETE(request(`/api/me/articles/${articleA.id}/saved`, "DELETE", userA.cookie), { params: Promise.resolve({ id: articleA.id, collection: "saved" }) });
    expect(removeSaved.status).toBe(200);
    expect(await prisma.savedArticle.count({ where: { userId: userA.id, articleId: articleA.id } })).toBe(0);
    expect(await prisma.favouriteArticle.count({ where: { userId: userA.id, articleId: articleA.id } })).toBe(1);
    expect(await prisma.savedArticle.count({ where: { userId: userB.id, articleId: articleB.id } })).toBe(1);
    expect((await dashboardRoute.GET(request("/api/me/dashboard", "GET", undefined))).status).toBe(401);

    const invalidArticle = await collectionRoute.PUT(request(`/api/me/articles/not-a-uuid/saved`, "PUT", userA.cookie), { params: Promise.resolve({ id: "not-a-uuid", collection: "saved" }) });
    expect(invalidArticle.status).toBe(404);
    const badOrigin = await collectionRoute.PUT(request(`/api/me/articles/${articleA.id}/saved`, "PUT", userA.cookie, undefined, "https://attacker.invalid"), { params: Promise.resolve({ id: articleA.id, collection: "saved" }) });
    expect(badOrigin.status).toBe(403);
  }, 60_000);

  it("isolates topic/category follows, reading history and clear-history by session owner", async () => {
    const userA = await signup("follow-reader-a");
    const userB = await signup("follow-reader-b");
    categoryId = (await prisma.category.create({ data: { name: `বিভাগ ${suffix}`, slug: `follow-category-${suffix}` }, select: { id: true } })).id;
    topicId = (await prisma.tag.create({ data: { name: `বিষয় ${suffix}`, slug: `follow-topic-${suffix}`, normalizedName: `follow-topic-${suffix}` }, select: { id: true } })).id;
    const articleA = await createPublishedArticle(userA.id, `history-a-${suffix}`, "ব্যবহারকারী ক-এর পাঠ");
    const articleB = await createPublishedArticle(userB.id, `history-b-${suffix}`, "ব্যবহারকারী খ-এর পাঠ");

    const topicRoute = await import("@/app/api/me/topics/[id]/route");
    const categoryRoute = await import("@/app/api/me/categories/[id]/route");
    expect((await topicRoute.PUT(request(`/api/me/topics/${topicId}`, "PUT", userA.cookie), { params: Promise.resolve({ id: topicId }) })).status).toBe(200);
    expect((await categoryRoute.PUT(request(`/api/me/categories/${categoryId}`, "PUT", userA.cookie), { params: Promise.resolve({ id: categoryId }) })).status).toBe(200);
    expect((await topicRoute.PUT(request(`/api/me/topics/${topicId}`, "PUT", userB.cookie), { params: Promise.resolve({ id: topicId }) })).status).toBe(200);
    expect((await categoryRoute.PUT(request(`/api/me/categories/${categoryId}`, "PUT", userB.cookie), { params: Promise.resolve({ id: categoryId }) })).status).toBe(200);
    expect(await prisma.followedTopic.count({ where: { userId: userA.id, tagId: topicId } })).toBe(1);
    expect(await prisma.followedCategory.count({ where: { userId: userB.id, categoryId } })).toBe(1);
    expect((await topicRoute.DELETE(request(`/api/me/topics/${topicId}`, "DELETE", userA.cookie, { userId: userB.id }), { params: Promise.resolve({ id: topicId }) })).status).toBe(200);
    expect((await categoryRoute.DELETE(request(`/api/me/categories/${categoryId}`, "DELETE", userA.cookie, { userId: userB.id }), { params: Promise.resolve({ id: categoryId }) })).status).toBe(200);
    expect(await prisma.followedTopic.count({ where: { userId: userA.id, tagId: topicId } })).toBe(0);
    expect(await prisma.followedCategory.count({ where: { userId: userA.id, categoryId } })).toBe(0);
    expect(await prisma.followedTopic.count({ where: { userId: userB.id, tagId: topicId } })).toBe(1);
    expect(await prisma.followedCategory.count({ where: { userId: userB.id, categoryId } })).toBe(1);

    const viewRoute = await import("@/app/api/public/articles/[slug]/view/route");
    const viewWithoutIp = await viewRoute.POST(request(`/api/public/articles/${articleB.slug}/view`, "POST", userB.cookie), { params: Promise.resolve({ slug: articleB.slug }) });
    expect(viewWithoutIp.status).toBe(200);
    expect(await viewWithoutIp.json()).toEqual({ counted: false });
    expect(await prisma.readingHistory.count({ where: { userId: userB.id, articleId: articleB.id } })).toBe(1);
    const viewA = await viewRoute.POST(request(`/api/public/articles/${articleA.slug}/view`, "POST", userA.cookie, undefined, origin, "198.51.100.41"), { params: Promise.resolve({ slug: articleA.slug }) });
    const viewB = await viewRoute.POST(request(`/api/public/articles/${articleB.slug}/view`, "POST", userB.cookie, undefined, origin, "198.51.100.42"), { params: Promise.resolve({ slug: articleB.slug }) });
    expect(viewA.status).toBe(200); expect(viewB.status).toBe(200);
    expect(await prisma.readingHistory.count({ where: { userId: userA.id, articleId: articleA.id } })).toBe(1);
    expect(await prisma.readingHistory.count({ where: { userId: userA.id, articleId: articleB.id } })).toBe(0);

    const historyRoute = await import("@/app/api/me/history/route");
    const historyA = await historyRoute.GET(request("/api/me/history", "GET", userA.cookie));
    const historyB = await historyRoute.GET(request("/api/me/history", "GET", userB.cookie));
    expect((await historyA.json()).items.map((row: { article: { id: string } }) => row.article.id)).toContain(articleA.id);
    expect((await historyRoute.GET(request("/api/me/history", "GET", undefined))).status).toBe(401);
    expect((await historyB.json()).items.map((row: { article: { id: string } }) => row.article.id)).not.toContain(articleA.id);

    const clear = await historyRoute.DELETE(request("/api/me/history", "DELETE", userA.cookie));
    expect(clear.status).toBe(200);
    expect(await prisma.readingHistory.count({ where: { userId: userA.id } })).toBe(0);
    expect(await prisma.readingHistory.count({ where: { userId: userB.id, articleId: articleB.id } })).toBe(1);
    const badOrigin = await historyRoute.DELETE(request("/api/me/history", "DELETE", userA.cookie, undefined, "https://attacker.invalid"));
    expect(badOrigin.status).toBe(403);
    const prefsRoute = await import("@/app/api/me/preferences/route");
    expect((await prefsRoute.PATCH(request("/api/me/preferences", "PATCH", userA.cookie, { readingHistoryEnabled: false }))).status).toBe(200);
    const afterOptOut = await viewRoute.POST(request(`/api/public/articles/${articleA.slug}/view`, "POST", userA.cookie, undefined, origin, "198.51.100.43"), { params: Promise.resolve({ slug: articleA.slug }) });
    expect(afterOptOut.status).toBe(200);
    expect(await prisma.readingHistory.count({ where: { userId: userA.id, articleId: articleA.id } })).toBe(0);
  }, 60_000);

  it("rejects profile/preferences user-ID manipulation and preserves another user’s preference", async () => {
    const userA = await signup("profile-reader-a");
    const userB = await signup("profile-reader-b");
    await prisma.userPreference.upsert({ where: { userId: userB.id }, create: { userId: userB.id, fontScale: "large", lowBandwidthMode: true }, update: { fontScale: "large", lowBandwidthMode: true } });
    const prefsRoute = await import("@/app/api/me/preferences/route");
    const profileRoute = await import("@/app/api/me/profile/route");

    const preferencesBefore = await prisma.userPreference.findUniqueOrThrow({ where: { userId: userB.id } });
    const attackPreferences = await prefsRoute.PATCH(request("/api/me/preferences", "PATCH", userA.cookie, { userId: userB.id, fontScale: "comfortable", lowBandwidthMode: false }));
    expect(attackPreferences.status).toBe(400);
    const invalidPreferences = await prefsRoute.PATCH(request("/api/me/preferences", "PATCH", userA.cookie, { userId: userB.id, fontScale: "huge" }));
    expect(invalidPreferences.status).toBe(400);
    const preferencesAfter = await prisma.userPreference.findUniqueOrThrow({ where: { userId: userB.id } });
    expect(preferencesAfter.fontScale).toBe(preferencesBefore.fontScale);
    expect(preferencesAfter.lowBandwidthMode).toBe(preferencesBefore.lowBandwidthMode);

    const attackProfile = await profileRoute.PATCH(request("/api/me/profile", "PATCH", userA.cookie, { userId: userB.id, name: "আক্রমণকারী" }));
    expect(attackProfile.status).toBe(400);
    const profileAfter = await prisma.user.findUniqueOrThrow({ where: { id: userB.id }, select: { name: true } });
    expect(profileAfter.name).toBe(userB.name);
    expect((await profileRoute.PATCH(request("/api/me/profile", "PATCH", undefined, { name: "অজ্ঞাত" }))).status).toBe(401);

    const ownPreferences = await prefsRoute.PATCH(request("/api/me/preferences", "PATCH", userA.cookie, { fontScale: "large", lowBandwidthMode: true, readingHistoryEnabled: false }));
    expect(ownPreferences.status).toBe(200);
    const changed = await prisma.userPreference.findUniqueOrThrow({ where: { userId: userA.id } });
    expect(changed).toMatchObject({ fontScale: "large", lowBandwidthMode: true, readingHistoryEnabled: false });
    expect((await prefsRoute.PATCH(request("/api/me/preferences", "PATCH", undefined, { fontScale: "comfortable" }))).status).toBe(401);
  }, 60_000);
});
