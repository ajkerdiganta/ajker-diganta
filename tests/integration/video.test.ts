import { randomBytes } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPublicVideo } from "@/lib/public-videos";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
let signupIp = 180;
const userIds: string[] = [];
const articleIds: string[] = [];
const videoIds: string[] = [];
const categoryIds: string[] = [];
const authorIds: string[] = [];
const tagIds: string[] = [];
let authorAId = "";
let categoryId = "";
let tagId = "";

type Account = { id: string; cookie: string; name: string; email: string };
async function signup(label: string): Promise<Account> {
  const name = `${label} ${suffix}`;
  const email = `${label.toLowerCase()}-${suffix}@example.test`;
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin, "x-real-ip": `203.0.${Math.floor(Math.random() * 200) + 1}.${signupIp++}` },
    body: JSON.stringify({ name, email, password: randomTestPassword() }),
  }));
  expect(response.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, name: true, email: true } });
  userIds.push(user.id);
  const session = response.headers.getSetCookie().find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(session).toBeTruthy();
  return { ...user, cookie: session!.split(";")[0]! };
}

async function grant(userId: string, code: "VIDEO_EDITOR" | "EDITOR") {
  const role = await prisma.role.findUniqueOrThrow({ where: { code } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

function request(path: string, method = "GET", cookie?: string, body?: Record<string, unknown>, trustedOrigin = origin, ip?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (trustedOrigin) headers.set("origin", trustedOrigin);
  if (body) headers.set("content-type", "application/json");
  if (ip) headers.set("x-real-ip", ip);
  return new Request(`${origin}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function fixtures(userId: string, prefix: string) {
  const category = await prisma.category.create({ data: { name: `ভিডিও বিভাগ ${suffix}`, slug: `video-category-${prefix}-${suffix}` }, select: { id: true } });
  categoryIds.push(category.id);
  const author = await prisma.author.create({ data: { name: `ভিডিও লেখক ${suffix}`, slug: `video-author-${prefix}-${suffix}`, userId }, select: { id: true } });
  authorIds.push(author.id);
  const tag = await prisma.tag.create({ data: { name: `ভিডিও ট্যাগ ${suffix}`, slug: `video-tag-${prefix}-${suffix}`, normalizedName: `video-tag-${prefix}-${suffix}` }, select: { id: true } });
  tagIds.push(tag.id);
  if (!categoryId) categoryId = category.id;
  if (!authorAId) authorAId = author.id;
  if (!tagId) tagId = tag.id;
  return { categoryId: category.id, authorId: author.id, tagId: tag.id };
}

async function publishedArticle(userId: string, slug: string) {
  const article = await prisma.article.create({ data: {
    slug, title: `ভিডিও-সম্পর্কিত সংবাদ ${suffix}`, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "বাংলা সংবাদ" }] }] }, bodyHtml: "<p>বাংলা সংবাদ</p>",
    status: "PUBLISHED", publishedAt: new Date(), approvedRevisionNumber: 1, publishedRevisionNumber: 1, approvedById: userId, publishedById: userId, createdById: userId, updatedById: userId,
  }, select: { id: true, slug: true } });
  articleIds.push(article.id);
  return article;
}

function input(refs: { categoryId: string; authorId: string; tagId: string }, extra: Record<string, unknown> = {}) {
  return {
    title: `বাংলা ভিডিও প্রতিবেদন ${suffix}`,
    description: `বাংলাদেশের গুরুত্বপূর্ণ বিষয় নিয়ে বিশ্লেষণ ${suffix}`,
    provider: "YOUTUBE",
    videoUrl: "https://youtu.be/BaW_jenozKc",
    durationSeconds: 249,
    categoryId: refs.categoryId,
    authorId: refs.authorId,
    tagIds: [refs.tagId],
    relatedArticleIds: [],
    seoTitle: "বাংলা ভিডিও মেটাডেটা",
    seoDescription: "বাংলা SEO বিবরণ",
    ...extra,
  };
}

async function cleanup() {
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (articleIds.length) {
    await prisma.relatedArticle.deleteMany({ where: { OR: [{ articleId: { in: articleIds } }, { relatedArticleId: { in: articleIds } }] } });
    await prisma.articleSlugRedirect.deleteMany({ where: { articleId: { in: articleIds } } });
    await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
  }
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (authorIds.length) await prisma.author.deleteMany({ where: { id: { in: authorIds } } });
  if (tagIds.length) await prisma.tag.deleteMany({ where: { id: { in: tagIds } } });
  for (const id of [...categoryIds].reverse()) await prisma.category.delete({ where: { id } }).catch(() => undefined);
  userIds.length = 0; videoIds.length = 0; articleIds.length = 0; authorIds.length = 0; tagIds.length = 0; categoryIds.length = 0;
  authorAId = ""; categoryId = ""; tagId = "";
}

afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("Phase 5 video platform", () => {
  it("validates YouTube input, blocks owner-IDOR, runs review/publish and returns the public related-article record", async () => {
    const creator = await signup("video-creator");
    const otherCreator = await signup("other-video-creator");
    const editor = await signup("video-editor");
    const reader = await signup("ordinary-reader");
    await grant(creator.id, "VIDEO_EDITOR");
    await grant(otherCreator.id, "VIDEO_EDITOR");
    await grant(editor.id, "EDITOR");
    const refs = await fixtures(creator.id, "owner");
    const unrelatedRefs = await fixtures(otherCreator.id, "other");
    const article = await publishedArticle(creator.id, `video-article-${suffix}`);
    const createRoute = await import("@/app/api/admin/videos/route");
    const itemInput = input(refs, { relatedArticleIds: [article.id] });

    expect((await createRoute.GET(request("/api/admin/videos", "GET", reader.cookie))).status).toBe(403);
    const badUrl = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, input(refs, { videoUrl: "https://youtube.com.evil.invalid/watch?v=BaW_jenozKc" })));
    expect(badUrl.status).toBe(400);
    const badThumbnail = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, input(refs, { thumbnailUrl: "https://attacker.invalid/image.jpg" })));
    expect(badThumbnail.status).toBe(400);
    const forgedOwner = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, input(refs, { createdById: otherCreator.id })));
    expect(forgedOwner.status).toBe(400);
    const unsupportedProvider = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, input(refs, { provider: "CLOUDFLARE_STREAM" })));
    expect(unsupportedProvider.status).toBe(400);

    const createdResponse = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, itemInput));
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).video;
    videoIds.push(created.id);
    const record = await prisma.video.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.title).toContain("বাংলা");
    expect(record.status).toBe("DRAFT");
    expect(record.slug).toMatch(/^[a-z0-9-]+$/);
    expect(record.externalId).toBe("BaW_jenozKc");
    expect(await prisma.videoRelatedArticle.count({ where: { videoId: created.id, relatedArticleId: article.id } })).toBe(1);
    expect(await prisma.videoTag.count({ where: { videoId: created.id, tagId: refs.tagId } })).toBe(1);

    const itemRoute = await import("@/app/api/admin/videos/[id]/route");
    expect((await itemRoute.GET(request(`/api/admin/videos/${created.id}`, "GET", otherCreator.cookie), { params: Promise.resolve({ id: created.id }) })).status).toBe(403);
    const deniedPatch = await itemRoute.PATCH(request(`/api/admin/videos/${created.id}`, "PATCH", otherCreator.cookie, { ...itemInput, expectedRevisionNumber: 1, userId: creator.id }), { params: Promise.resolve({ id: created.id }) });
    expect([400, 403]).toContain(deniedPatch.status);
    const deniedDelete = await itemRoute.DELETE(request(`/api/admin/videos/${created.id}`, "DELETE", otherCreator.cookie), { params: Promise.resolve({ id: created.id }) });
    expect(deniedDelete.status).toBe(403);
    const wrongReferenceUpdate = await itemRoute.PATCH(request(`/api/admin/videos/${created.id}`, "PATCH", creator.cookie, input(refs, { expectedRevisionNumber: 1, relatedArticleIds: [created.id] })), { params: Promise.resolve({ id: created.id }) });
    expect(wrongReferenceUpdate.status).toBe(400);

    const transitionRoute = await import("@/app/api/admin/videos/[id]/transition/route");
    await prisma.userPreference.upsert({ where: { userId: reader.id }, create: { userId: reader.id, inAppVideoEnabled: true }, update: { inAppVideoEnabled: true } });
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", creator.cookie, { action: "publish" }), { params: Promise.resolve({ id: created.id }) })).status).toBe(403);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", creator.cookie, { action: "submit" }), { params: Promise.resolve({ id: created.id }) })).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", editor.cookie, { action: "review" }), { params: Promise.resolve({ id: created.id }) })).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", editor.cookie, { action: "approve" }), { params: Promise.resolve({ id: created.id }) })).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", editor.cookie, { action: "publish" }), { params: Promise.resolve({ id: created.id }) })).status).toBe(200);
    const published = await prisma.video.findUniqueOrThrow({ where: { id: created.id } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedRevisionNumber).toBe(published.revisionNumber);
    const videoNotificationKey = `video:${created.id}:revision:${created.revisionNumber}`;
    expect(await prisma.notification.count({ where: { userId: reader.id, type: "VIDEO", dedupeKey: videoNotificationKey } })).toBe(1);
    await prisma.$transaction((tx) => import("@/lib/notification-service").then(({ notifyVideoPublication }) => notifyVideoPublication(tx, created.id)));
    expect(await prisma.notification.count({ where: { userId: reader.id, type: "VIDEO", dedupeKey: videoNotificationKey } })).toBe(1);
    expect(await prisma.videoWorkflowEvent.count({ where: { videoId: created.id } })).toBe(5);

    const page = await getPublicVideo(created.slug);
    expect(page?.title).toContain("বাংলা");
    expect(page?.relatedArticles.map((item) => item.id)).toContain(article.id);
    const videoPageModule = await import("@/app/video/[slug]/page");
    const metadata = await videoPageModule.generateMetadata({ params: Promise.resolve({ slug: created.slug }) });
    expect(metadata.title).toContain("বাংলা");
    expect(metadata.alternates?.canonical).toContain(`/video/${created.slug}`);
    expect((metadata.openGraph as { images?: Array<{ url?: string } | string> }).images).toBeTruthy();
    const listing = await (await import("@/lib/public-videos")).getPublicVideoIndex(1, 10);
    expect(listing.videos.map((item) => item.slug)).toContain(created.slug);
    const publicViewRoute = await import("@/app/api/public/videos/[slug]/view/route");
    const viewA = await publicViewRoute.POST(request(`/api/public/videos/${created.slug}/view`, "POST", creator.cookie, undefined, origin, "198.51.100.81"), { params: Promise.resolve({ slug: created.slug }) });
    const viewDuplicate = await publicViewRoute.POST(request(`/api/public/videos/${created.slug}/view`, "POST", creator.cookie, undefined, origin, "198.51.100.81"), { params: Promise.resolve({ slug: created.slug }) });
    expect((await viewA.json()).counted).toBe(true);
    expect((await viewDuplicate.json()).counted).toBe(false);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: created.id } })).viewCount).toBe(BigInt(1));
    expect(await prisma.videoHistory.count({ where: { userId: creator.id, videoId: created.id } })).toBe(1);

    const historyRoute = await import("@/app/api/me/video-history/route");
    const historyA = await historyRoute.GET(request("/api/me/video-history?userId=" + otherCreator.id, "GET", creator.cookie));
    const historyB = await historyRoute.GET(request("/api/me/video-history", "GET", otherCreator.cookie));
    expect((await historyA.json()).items.map((row: { video: { id: string } }) => row.video.id)).toContain(created.id);
    expect((await historyB.json()).items).toHaveLength(0);
    const dashboardRoute = await import("@/app/api/me/dashboard/route");
    const dashboard = await dashboardRoute.GET(request("/api/me/dashboard", "GET", creator.cookie));
    expect((await dashboard.json()).videoHistory.map((row: { video: { id: string } }) => row.video.id)).toContain(created.id);
    const cleared = await historyRoute.DELETE(request("/api/me/video-history", "DELETE", otherCreator.cookie));
    expect(cleared.status).toBe(200);
    expect(await prisma.videoHistory.count({ where: { userId: creator.id, videoId: created.id } })).toBe(1);
    expect((await historyRoute.GET(request("/api/me/video-history", "GET", undefined))).status).toBe(401);
    const wrongOrigin = await historyRoute.DELETE(request("/api/me/video-history", "DELETE", creator.cookie, undefined, "https://attacker.invalid"));
    expect(wrongOrigin.status).toBe(403);
    const preferenceRoute = await import("@/app/api/me/preferences/route");
    expect((await preferenceRoute.PATCH(request("/api/me/preferences", "PATCH", creator.cookie, { readingHistoryEnabled: false }))).status).toBe(200);
    expect(await prisma.videoHistory.count({ where: { userId: creator.id } })).toBe(0);
    const optedOutView = await publicViewRoute.POST(request(`/api/public/videos/${created.slug}/view`, "POST", creator.cookie, undefined, origin, "198.51.100.82"), { params: Promise.resolve({ slug: created.slug }) });
    expect((await optedOutView.json()).counted).toBe(true);
    expect(await prisma.videoHistory.count({ where: { userId: creator.id } })).toBe(0);

    // A video editor cannot read, edit, or delete another creator's draft, even when the resource UUID is known.
    const otherDraftResponse = await createRoute.POST(request("/api/admin/videos", "POST", otherCreator.cookie, input(unrelatedRefs, { videoUrl: "https://youtu.be/ScMzIvxBSi4" })));
    expect(otherDraftResponse.status).toBe(201);
    const otherDraft = (await otherDraftResponse.json()).video;
    videoIds.push(otherDraft.id);
    expect((await itemRoute.GET(request(`/api/admin/videos/${otherDraft.id}`, "GET", creator.cookie), { params: Promise.resolve({ id: otherDraft.id }) })).status).toBe(403);
  }, 90_000);

  it("prevents self-approval/publishing and permits an owner to update only their rejected draft with a revision check", async () => {
    const creator = await signup("self-editor");
    const reviewer = await signup("independent-reviewer");
    await grant(creator.id, "EDITOR");
    await grant(reviewer.id, "EDITOR");
    const refs = await fixtures(creator.id, "self");
    const createRoute = await import("@/app/api/admin/videos/route");
    const createResponse = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, input(refs)));
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()).video;
    videoIds.push(created.id);
    const transitionRoute = await import("@/app/api/admin/videos/[id]/transition/route");
    const context = { params: Promise.resolve({ id: created.id }) };
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", creator.cookie, { action: "submit" }), context)).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", reviewer.cookie, { action: "review" }), context)).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", reviewer.cookie, { action: "approve" }), context)).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", creator.cookie, { action: "publish" }), context)).status).toBe(403);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${created.id}/transition`, "POST", reviewer.cookie, { action: "publish" }), context)).status).toBe(200);

    const secondResponse = await createRoute.POST(request("/api/admin/videos", "POST", creator.cookie, input(refs, { videoUrl: "https://www.youtube.com/watch?v=5qap5aO4i9A" })));
    expect(secondResponse.status).toBe(201);
    const second = (await secondResponse.json()).video;
    videoIds.push(second.id);
    const secondContext = { params: Promise.resolve({ id: second.id }) };
    expect((await transitionRoute.POST(request(`/api/admin/videos/${second.id}/transition`, "POST", creator.cookie, { action: "submit" }), secondContext)).status).toBe(200);
    expect((await transitionRoute.POST(request(`/api/admin/videos/${second.id}/transition`, "POST", reviewer.cookie, { action: "review" }), secondContext)).status).toBe(200);
    const reject = await transitionRoute.POST(request(`/api/admin/videos/${second.id}/transition`, "POST", reviewer.cookie, { action: "reject", reason: "বাংলা বিবরণ আরও পরিষ্কার করে দিন" }), secondContext);
    expect(reject.status).toBe(200);
    const itemRoute = await import("@/app/api/admin/videos/[id]/route");
    const update = await itemRoute.PATCH(request(`/api/admin/videos/${second.id}`, "PATCH", creator.cookie, input(refs, { expectedRevisionNumber: 1, videoUrl: "https://youtu.be/5qap5aO4i9A", title: "বাংলা সংশোধিত ভিডিও প্রতিবেদন" })), secondContext);
    expect(update.status).toBe(200);
    expect((await update.json()).video.revisionNumber).toBe(2);
    const staleUpdate = await itemRoute.PATCH(request(`/api/admin/videos/${second.id}`, "PATCH", creator.cookie, input(refs, { expectedRevisionNumber: 1, videoUrl: "https://youtu.be/5qap5aO4i9A", title: "পুরোনো সংস্করণ" })), secondContext);
    expect(staleUpdate.status).toBe(409);
    const current = await prisma.video.findUniqueOrThrow({ where: { id: second.id } });
    expect(current.status).toBe("DRAFT");
    expect(current.approvedRevisionNumber).toBeNull();
    expect(current.title).toBe("বাংলা সংশোধিত ভিডিও প্রতিবেদন");
    const missingAudit = await itemRoute.PATCH(request(`/api/admin/videos/${second.id}`, "PATCH", creator.cookie, { ...input(refs, { expectedRevisionNumber: 2 }), userId: reviewer.id }), secondContext);
    expect(missingAudit.status).toBe(400);
  }, 90_000);
});
