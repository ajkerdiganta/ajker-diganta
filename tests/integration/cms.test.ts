import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setMediaStoreForTests, type MediaObjectStore } from "@/lib/media-storage";
import { articleMetadata, articleJsonLd, jsonLdScript } from "@/lib/article-seo";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
const accounts = {
  reporter: { name: "রিপোর্টার বাংলা — Reporter", email: `cms-reporter-${suffix}@example.test`, password: randomTestPassword() },
  editor: { name: "সম্পাদক বাংলা — Editor", email: `cms-editor-${suffix}@example.test`, password: randomTestPassword() },
  reader: { name: "পাঠক বাংলা", email: `cms-reader-${suffix}@example.test`, password: randomTestPassword() },
  admin: { name: "অ্যাডমিন বাংলা — Admin", email: `cms-admin-${suffix}@example.test`, password: randomTestPassword() },
};
const createdUserIds: string[] = [];
const articleIds: string[] = [];
const categoryIds: string[] = [];
const tagIds: string[] = [];
const authorIds: string[] = [];
const mediaIds: string[] = [];
let signupIpCounter = 20;
const signupIpPrefix = Math.floor(Math.random() * 254) + 1;
const mailOrigin = origin;

class MemoryMediaStore implements MediaObjectStore {
  readonly files = new Map<string, Uint8Array>();
  lastKey = "";
  bucketName() { return "integration-test-bucket"; }
  async putQuarantine(key: string, body: Uint8Array) { this.lastKey = key; this.files.set(key, new Uint8Array(body)); }
  async head(key: string) { const body = this.files.get(key); return body ? { size: body.byteLength, contentType: "image/png" } : null; }
  async read(key: string) { const body = this.files.get(key); if (!body) throw new Error("missing object"); return body; }
  async putVerified(key: string, body: Uint8Array) { this.files.set(key, new Uint8Array(body)); }
  async remove(key: string) { this.files.delete(key); }
  async readUrl(key: string) { return `https://media.integration.test/${key}`; }
  publicUrl() { return null; }
}
const mediaStore = new MemoryMediaStore();
setMediaStoreForTests(mediaStore);

type SignupResult = { cookie: string; userId: string };
type HttpInput = { method?: string; body?: Record<string, unknown>; cookie?: string; originHeader?: string; ip?: string };
async function api(path: string, input: HttpInput = {}) {
  const headers = new Headers();
  if (input.cookie) headers.set("cookie", input.cookie);
  if (input.originHeader !== "") headers.set("origin", input.originHeader ?? origin);
  if (input.body) headers.set("content-type", "application/json");
  if (input.ip) headers.set("x-real-ip", input.ip);
  return new Request(`${origin}${path}`, { method: input.method ?? "GET", headers, ...(input.body ? { body: JSON.stringify(input.body) } : {}) });
}
function binaryApi(path: string, bytes: Uint8Array, cookie: string, contentType: string) {
  return new Request(`${origin}${path}`, { method: "PUT", headers: { cookie, origin, "content-type": contentType }, body: Buffer.from(bytes) });
}
async function authSignup(name: string, email: string, password: string): Promise<SignupResult> {
  const response = await auth.handler(new Request(`${mailOrigin}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: mailOrigin, "x-real-ip": `203.0.${signupIpPrefix}.${signupIpCounter++}` },
    body: JSON.stringify({ name, email, password }),
  }));
  expect(response.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  const setCookies = response.headers.getSetCookie();
  const session = setCookies.find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(session).toBeTruthy();
  expect(session).toMatch(/HttpOnly/i);
  return { cookie: session!.split(";")[0], userId: user.id };
}
async function grant(userId: string, roleCode: "REPORTER" | "EDITOR" | "ADMIN") {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

const dynamicRoute = async (id: string, request: Request, method: "GET" | "PATCH" | "DELETE") => {
  const route = await import("@/app/api/admin/articles/[id]/route");
  return route[method](request, { params: Promise.resolve({ id }) });
};
const workflow = async (id: string, request: Request) => {
  const route = await import("@/app/api/admin/articles/[id]/transition/route");
  return route.POST(request, { params: Promise.resolve({ id }) });
};

async function cleanup() {
  if (articleIds.length) {
    await prisma.relatedArticle.deleteMany({ where: { OR: [{ articleId: { in: articleIds } }, { relatedArticleId: { in: articleIds } }] } });
    await prisma.articleSlugRedirect.deleteMany({ where: { articleId: { in: articleIds } } });
    await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
  }
  for (const id of [...categoryIds].reverse()) await prisma.category.delete({ where: { id } }).catch(() => undefined);
  if (tagIds.length) await prisma.tag.deleteMany({ where: { id: { in: tagIds } } });
  if (authorIds.length) await prisma.author.deleteMany({ where: { id: { in: authorIds } } });
  if (mediaIds.length) await prisma.media.deleteMany({ where: { id: { in: mediaIds } } });
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  articleIds.length = 0; categoryIds.length = 0; tagIds.length = 0; authorIds.length = 0; mediaIds.length = 0; createdUserIds.length = 0;
  mediaStore.files.clear();
  setMediaStoreForTests(undefined);
}

afterEach(cleanup);
afterAll(async () => { setMediaStoreForTests(undefined); await prisma.$disconnect(); });

describe("Phase 2 newsroom CMS integration", () => {
  it("enforces taxonomy/account RBAC; verifies/quarantines media; runs reporter/editor article revision workflow and scheduled publish", async () => {
    const reporter = await authSignup(accounts.reporter.name, accounts.reporter.email, accounts.reporter.password);
    const editor = await authSignup(accounts.editor.name, accounts.editor.email, accounts.editor.password);
    const reader = await authSignup(accounts.reader.name, accounts.reader.email, accounts.reader.password);
    const admin = await authSignup(accounts.admin.name, accounts.admin.email, accounts.admin.password);
    await grant(reporter.userId, "REPORTER");
    await grant(editor.userId, "EDITOR");
    await grant(admin.userId, "ADMIN");

    const categoriesRoute = await import("@/app/api/admin/categories/route");
    const tagsRoute = await import("@/app/api/admin/tags/route");
    const authorsRoute = await import("@/app/api/admin/authors/route");
    const mediaIntentRoute = await import("@/app/api/admin/media/intent/route");
    const mediaUploadRoute = await import("@/app/api/admin/media/upload/route");
    const finalizeRoute = await import("@/app/api/admin/media/finalize/route");
    const denyCategory = await categoriesRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: reporter.cookie, body: { name: "অবৈধ বিভাগ", isActive: true, sortOrder: 0 } }));
    expect(denyCategory.status).toBe(403);
    const denyReaderTaxonomy = await categoriesRoute.GET(await api("/api/admin/categories", { cookie: reader.cookie }));
    expect(denyReaderTaxonomy.status).toBe(403);
    const denyReaderMedia = await (await import("@/app/api/admin/media/route")).GET(await api("/api/admin/media", { cookie: reader.cookie }));
    expect(denyReaderMedia.status).toBe(403);
    expect((await tagsRoute.POST(await api("/api/admin/tags", { method: "POST", cookie: reporter.cookie, body: { name: "অবৈধ ট্যাগ" } }))).status).toBe(403);
    expect((await authorsRoute.POST(await api("/api/admin/authors", { method: "POST", cookie: reporter.cookie, body: { name: "অবৈধ লেখক" } }))).status).toBe(403);
    const denyReaderIntent = await mediaIntentRoute.POST(await api("/api/admin/media/intent", { method: "POST", cookie: reader.cookie, body: { filename: "reader.png", contentType: "image/png", size: 32 } }));
    expect(denyReaderIntent.status).toBe(403);
    expect((await (await import("@/app/api/internal/jobs/publish-due/route")).POST(await api("/api/internal/jobs/publish-due", { method: "POST" }))).status).toBe(503);
    const csrf = await categoriesRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: editor.cookie, originHeader: "", body: { name: "অবিশ্বস্ত origin", isActive: true, sortOrder: 0 } }));
    expect(csrf.status).toBe(403);
    const denyEditorCategory = await categoriesRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: editor.cookie, body: { name: "সম্পাদকীয় বিভাগ", isActive: true, sortOrder: 0 } }));
    expect(denyEditorCategory.status).toBe(403);

    const categoryResponse = await categoriesRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: admin.cookie, body: { name: "জাতীয়", description: "জাতীয় সংবাদ", isActive: true, sortOrder: 1, seoTitle: "জাতীয় সংবাদ", seoDescription: "বাংলাদেশের জাতীয় সংবাদ" } }));
    expect(categoryResponse.status).toBe(201);
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    const category = (await categoryResponse.json() as { category: { id: string; slug: string } }).category;
    categoryIds.push(category.id);
    expect(category.slug).toMatch(/^[a-z0-9-]+$/);
    const categorySchemaRoute = await import("@/app/api/admin/categories/route");
    const childResponse = await categorySchemaRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: admin.cookie, body: { name: "ঢাকা", parentId: category.id, isActive: true, sortOrder: 0 } }));
    expect(childResponse.status).toBe(201);
    const child = (await childResponse.json() as { category: { id: string; parentId: string } }).category;
    categoryIds.push(child.id);
    const tooDeep = await categorySchemaRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: admin.cookie, body: { name: "পুরান ঢাকা", parentId: child.id, isActive: true, sortOrder: 0 } }));
    expect(tooDeep.status).toBe(400);
    const updateCategoryRoute = await import("@/app/api/admin/categories/[id]/route");
    const denyCategoryPatch = await updateCategoryRoute.PATCH!(await api(`/api/admin/categories/${child.id}`, { method: "PATCH", cookie: reporter.cookie, body: { name: "অননুমোদিত বিভাগ", isActive: true, sortOrder: 1 } }), { params: Promise.resolve({ id: child.id }) });
    if (!denyCategoryPatch) throw new Error("Category PATCH handler returned no response");
    expect(denyCategoryPatch.status).toBe(403);
    const denyEditorPatch = await updateCategoryRoute.PATCH!(await api(`/api/admin/categories/${child.id}`, { method: "PATCH", cookie: editor.cookie, body: { name: "অননুমোদিত সম্পাদনা", parentId: category.id, isActive: true, sortOrder: 1 } }), { params: Promise.resolve({ id: child.id }) });
    if (!denyEditorPatch) throw new Error("Category PATCH handler returned no response");
    expect(denyEditorPatch.status).toBe(403);
    const denyEditorDelete = await updateCategoryRoute.DELETE!(await api(`/api/admin/categories/${child.id}`, { method: "DELETE", cookie: editor.cookie }), { params: Promise.resolve({ id: child.id }) });
    if (!denyEditorDelete) throw new Error("Category DELETE handler returned no response");
    expect(denyEditorDelete.status).toBe(403);
    const updateCategory = await updateCategoryRoute.PATCH!(await api(`/api/admin/categories/${child.id}`, { method: "PATCH", cookie: admin.cookie, body: { name: "রাজধানী ঢাকা", parentId: category.id, isActive: true, sortOrder: 1 } }), { params: Promise.resolve({ id: child.id }) });
    if (!updateCategory) throw new Error("Category PATCH handler returned no response");
    expect(updateCategory.status).toBe(200);

    const tagResponse = await tagsRoute.POST(await api("/api/admin/tags", { method: "POST", cookie: editor.cookie, body: { name: "নির্বাচন ২০২৬" } }));
    expect(tagResponse.status).toBe(201);
    const tag = (await tagResponse.json() as { tag: { id: string; slug: string } }).tag;
    tagIds.push(tag.id);
    expect(tag.slug).toMatch(/^[a-z0-9-]+$/);
    const duplicateTag = await tagsRoute.POST(await api("/api/admin/tags", { method: "POST", cookie: editor.cookie, body: { name: "নির্বাচন ২০২৬" } }));
    expect(duplicateTag.status).toBe(409);
    const tagRoute = await import("@/app/api/admin/tags/[id]/route");
    const denyTagPatch = await tagRoute.PATCH!(await api(`/api/admin/tags/${tag.id}`, { method: "PATCH", cookie: reporter.cookie, body: { name: "অননুমোদিত ট্যাগ" } }), { params: Promise.resolve({ id: tag.id }) });
    if (!denyTagPatch) throw new Error("Tag PATCH handler returned no response");
    expect(denyTagPatch.status).toBe(403);
    const editedTag = await tagRoute.PATCH!(await api(`/api/admin/tags/${tag.id}`, { method: "PATCH", cookie: editor.cookie, body: { name: "নির্বাচন সংবাদ" } }), { params: Promise.resolve({ id: tag.id }) });
    if (!editedTag) throw new Error("Tag PATCH handler returned no response");
    expect(editedTag.status).toBe(200);

    const authorResponse = await authorsRoute.POST(await api("/api/admin/authors", { method: "POST", cookie: editor.cookie, body: { name: "নাসরিন আক্তার — Nasrin", title: "জ্যেষ্ঠ প্রতিবেদক", bio: "বাংলা ও ইংরেজি সংবাদ লেখেন।", email: `author-${suffix}@example.test` } }));
    expect(authorResponse.status).toBe(201);
    const author = (await authorResponse.json() as { author: { id: string; slug: string; email: string } }).author;
    authorIds.push(author.id);
    expect(author.slug).toMatch(/^[a-z0-9-]+$/);
    const redactedAuthors = await authorsRoute.GET(await api("/api/admin/authors", { cookie: reporter.cookie }));
    const redacted = (await redactedAuthors.json() as { authors: Array<Record<string, unknown>> }).authors.find((row) => row.id === author.id);
    expect(redacted).toBeDefined();
    expect(redacted).not.toHaveProperty("email");
    const authorRoute = await import("@/app/api/admin/authors/[id]/route");
    const denyAuthorPatch = await authorRoute.PATCH!(await api(`/api/admin/authors/${author.id}`, { method: "PATCH", cookie: reporter.cookie, body: { name: "অননুমোদিত লেখক" } }), { params: Promise.resolve({ id: author.id }) });
    if (!denyAuthorPatch) throw new Error("Author PATCH handler returned no response");
    expect(denyAuthorPatch.status).toBe(403);
    const editedAuthor = await authorRoute.PATCH!(await api(`/api/admin/authors/${author.id}`, { method: "PATCH", cookie: editor.cookie, body: { name: "নাসরিন আক্তার — Nasrin", title: "সম্পাদকীয় প্রতিবেদক", bio: "বাংলা newsroom reporter", email: `author-${suffix}@example.test` } }), { params: Promise.resolve({ id: author.id }) });
    if (!editedAuthor) throw new Error("Author PATCH handler returned no response");
    expect(editedAuthor.status).toBe(200);

    const png = await sharp({ create: { width: 2600, height: 1300, channels: 3, background: { r: 12, g: 80, b: 52 } } }).png().toBuffer();
    const unauthIntent = await mediaIntentRoute.POST(await api("/api/admin/media/intent", { method: "POST", body: { filename: "test.png", contentType: "image/png", size: png.byteLength } }));
    expect(unauthIntent.status).toBe(401);
    expect((await finalizeRoute.POST(await api("/api/admin/media/finalize", { method: "POST", body: { mediaId: "00000000-0000-4000-8000-000000000000" } }))).status).toBe(401);
    const mediaIntent = await mediaIntentRoute.POST(await api("/api/admin/media/intent", { method: "POST", cookie: reporter.cookie, body: { filename: "বাংলা-ছবি.png", contentType: "image/png", size: png.byteLength, altText: "বাংলা সংবাদ ছবি", caption: "ঢাকায় সংবাদ সম্মেলন", credit: "ছবি: নিউজরুম" } }));
    expect(mediaIntent.status).toBe(201);
    const intent = (await mediaIntent.json()) as { mediaId: string };
    mediaIds.push(intent.mediaId);
    expect((await mediaUploadRoute.PUT(binaryApi(`/api/admin/media/upload?mediaId=${intent.mediaId}`, png.slice(0, -1), reporter.cookie, "image/png"))).status).toBe(413);
    expect((await prisma.media.findUniqueOrThrow({ where: { id: intent.mediaId } })).status).toBe("UPLOADING");
    expect((await mediaUploadRoute.PUT(binaryApi(`/api/admin/media/upload?mediaId=${intent.mediaId}`, png, reader.cookie, "image/png"))).status).toBe(403);
    expect((await mediaUploadRoute.PUT(binaryApi(`/api/admin/media/upload?mediaId=${intent.mediaId}`, png, reporter.cookie, "image/png"))).status).toBe(200);
    const finalized = await finalizeRoute.POST(await api("/api/admin/media/finalize", { method: "POST", cookie: reporter.cookie, body: { mediaId: intent.mediaId } }));
    expect(finalized.status).toBe(200);
    const finalizedPayload = (await finalized.json()) as { media: { id: string; width: number; height: number; status: string } };
    expect(finalizedPayload.media).toMatchObject({ id: intent.mediaId, width: 1920, height: 960, status: "VERIFIED" });
    const verified = await prisma.media.findUniqueOrThrow({ where: { id: intent.mediaId } });
    expect(verified.mimeType).toBe("image/webp");
    expect(verified.objectKey).toMatch(/^verified\//);
    expect(verified.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(mediaStore.files.has(verified.objectKey)).toBe(true);
    const mediaLibraryRoute = await import("@/app/api/admin/media/route");
    const library = await mediaLibraryRoute.GET(await api("/api/admin/media", { cookie: reporter.cookie }));
    expect(library.status).toBe(200);
    const mediaManageRoute = await import("@/app/api/admin/media/[id]/route");
    const denyMediaPatch = await mediaManageRoute.PATCH!(await api(`/api/admin/media/${intent.mediaId}`, { method: "PATCH", cookie: reader.cookie, body: { altText: "অননুমোদিত" } }), { params: Promise.resolve({ id: intent.mediaId }) });
    if (!denyMediaPatch) throw new Error("Media PATCH handler returned no response");
    expect(denyMediaPatch.status).toBe(403);
    const denyMediaDelete = await mediaManageRoute.DELETE!(await api(`/api/admin/media/${intent.mediaId}`, { method: "DELETE", cookie: editor.cookie }), { params: Promise.resolve({ id: intent.mediaId }) });
    if (!denyMediaDelete) throw new Error("Media DELETE handler returned no response");
    expect(denyMediaDelete.status).toBe(403);
    const imageRoute = await import("@/app/api/media/[id]/route");
    const delivered = await imageRoute.GET(await api(`/api/media/${intent.mediaId}`), { params: Promise.resolve({ id: intent.mediaId }) });
    expect(delivered.status).toBe(302);
    const unsafeSvgIntent = await mediaIntentRoute.POST(await api("/api/admin/media/intent", { method: "POST", cookie: reporter.cookie, body: { filename: "unsafe.svg", contentType: "image/svg+xml", size: 64 } }));
    expect(unsafeSvgIntent.status).toBe(400);

    const hostileImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>');
    const disguisedIntentResponse = await mediaIntentRoute.POST(await api("/api/admin/media/intent", { method: "POST", cookie: reporter.cookie, body: { filename: "news.png", contentType: "image/png", size: hostileImage.byteLength } }));
    expect(disguisedIntentResponse.status).toBe(201);
    const disguisedIntent = await disguisedIntentResponse.json() as { mediaId: string };
    mediaIds.push(disguisedIntent.mediaId);
    expect((await mediaUploadRoute.PUT(binaryApi(`/api/admin/media/upload?mediaId=${disguisedIntent.mediaId}`, hostileImage, reporter.cookie, "image/png"))).status).toBe(200);
    const rejectedHostileImage = await finalizeRoute.POST(await api("/api/admin/media/finalize", { method: "POST", cookie: reporter.cookie, body: { mediaId: disguisedIntent.mediaId } }));
    expect(rejectedHostileImage.status).toBe(400);
    expect(await prisma.media.findUniqueOrThrow({ where: { id: disguisedIntent.mediaId } }).then((row) => row.status)).not.toBe("VERIFIED");
    const rejectedDelivery = await (await import("@/app/api/media/[id]/route")).GET(await api(`/api/media/${disguisedIntent.mediaId}`), { params: Promise.resolve({ id: disguisedIntent.mediaId }) });
    expect(rejectedDelivery.status).toBe(404);

    const articleCollection = await import("@/app/api/admin/articles/route");
    const body = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "বাংলা শিরোনাম — mixed newsroom" }] },
        { type: "paragraph", content: [{ type: "text", text: "<script>alert('xss')</script> — আজকের খবর" }] },
        { type: "paragraph", content: [{ type: "text", text: "সম্পূর্ণ প্রতিবেদন পড়ুন", marks: [{ type: "link", attrs: { href: "javascript:alert(document.cookie)", target: "_blank" } }] }] },
        { type: "image", attrs: { mediaId: intent.mediaId, src: "https://attacker.invalid/untrusted.jpg", alt: "ঢাকার বাংলা সংবাদ সম্মেলন", caption: "সংবাদ সম্মেলনে বক্তব্য" } },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "‘সত্য · সময় · সমাজ’" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "বাংলা তালিকা" }] }] }] },
      ],
    };
    const relatedCreate = await articleCollection.POST(await api("/api/admin/articles", { method: "POST", cookie: reporter.cookie, body: {
      title: "সম্পর্কিত সংবাদ — বাংলা",
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "প্রাসঙ্গিক প্রকাশিত সংবাদের সারাংশ" }] }] },
      categoryIds: [child.id], primaryCategoryId: child.id, authorIds: [author.id], primaryAuthorId: author.id,
      tagIds: [], relatedArticleIds: [], relatedVideos: [],
    } }));
    expect(relatedCreate.status).toBe(201);
    const relatedArticle = (await relatedCreate.json() as { article: { id: string } }).article;
    articleIds.push(relatedArticle.id);
    expect((await workflow(relatedArticle.id, await api(`/api/admin/articles/${relatedArticle.id}/transition`, { method: "POST", cookie: reporter.cookie, body: { action: "submit" } }))).status).toBe(200);
    expect((await workflow(relatedArticle.id, await api(`/api/admin/articles/${relatedArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "review" } }))).status).toBe(200);
    expect((await workflow(relatedArticle.id, await api(`/api/admin/articles/${relatedArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "approve" } }))).status).toBe(200);
    expect((await workflow(relatedArticle.id, await api(`/api/admin/articles/${relatedArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "publish" } }))).status).toBe(200);

    const createArticleResponse = await articleCollection.POST(await api("/api/admin/articles", { method: "POST", cookie: reporter.cookie, body: {
      title: "বাংলা শিরোনাম — mixed newsroom",
      subtitle: "বাংলা উপশিরোনাম · Breaking News",
      excerpt: "বাংলা ইংরেজি mixed সংবাদ বিবরণ",
      body,
      categoryIds: [child.id], primaryCategoryId: child.id,
      authorIds: [author.id], primaryAuthorId: author.id,
      tagIds: [tag.id], featuredImageId: intent.mediaId,
      relatedArticleIds: [relatedArticle.id], relatedVideos: [{ title: "সাক্ষাৎকার", url: "https://youtu.be/abcdefgh123" }],
      seoTitle: "বাংলা SEO শিরোনাম", seoDescription: "বাংলা মেটা বিবরণ · Dhaka news",
      canonicalUrl: "https://news.example.test/stable/canonical",
    } }));
    expect(createArticleResponse.status).toBe(201);
    const createdArticle = (await createArticleResponse.json() as { article: { id: string; slug: string; status: string; revisionNumber: number } }).article;
    articleIds.push(createdArticle.id);
    expect(createdArticle).toMatchObject({ status: "DRAFT", revisionNumber: 1 });
    expect(createdArticle.slug).toMatch(/^[a-z0-9-]+$/);
    expect(createdArticle.slug).not.toContain("বাংলা");
    const { getPublicArticle, getPublicVideo, getMostReadArticles, videoRouteSlug } = await import("@/lib/public-news");
    expect(await getPublicArticle(createdArticle.slug)).toBeNull();
    expect((await getMostReadArticles()).some(({ id }) => id === createdArticle.id)).toBe(false);
    const publicClip = await getPublicVideo(videoRouteSlug("সাক্ষাৎকার", "abcdefgh123"));
    expect(publicClip).toBeNull();
    let stored = await prisma.article.findUniqueOrThrow({ where: { id: createdArticle.id } });
    expect(stored.bodyHtml).toContain("বাংলা শিরোনাম");
    expect(stored.bodyHtml).not.toMatch(/<script|javascript:|attacker\.invalid|onerror|document\.cookie/i);
    expect(stored.bodyHtml).toContain(`/api/media/${intent.mediaId}`);
    const revisionOne = await prisma.articleRevision.findFirstOrThrow({ where: { articleId: createdArticle.id, version: 1 } });
    expect(revisionOne.bodyHtml).toBe(stored.bodyHtml);
    expect(await prisma.relatedArticle.findUnique({ where: { articleId_relatedArticleId: { articleId: createdArticle.id, relatedArticleId: relatedArticle.id } } })).not.toBeNull();

    const readerCreate = await articleCollection.POST(await api("/api/admin/articles", { method: "POST", cookie: reader.cookie, body: { title: "পাঠকের অযোগ্য খসড়া", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "বিষয়" }] }] }, categoryIds: [], authorIds: [], tagIds: [], relatedArticleIds: [], relatedVideos: [] } }));
    expect(readerCreate.status).toBe(403);
    const readerPublish = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: reader.cookie, body: { action: "publish" } }));
    expect(readerPublish.status).toBe(403);
    const anonymousList = await articleCollection.GET(await api("/api/admin/articles"));
    expect(anonymousList.status).toBe(401);
    expect((await articleCollection.GET(await api("/api/admin/articles", { cookie: reader.cookie }))).status).toBe(403);
    const editorOwnList = await articleCollection.GET(await api("/api/admin/articles", { cookie: editor.cookie }));
    expect(editorOwnList.status).toBe(200);
    const editorArticles = (await editorOwnList.json() as { articles: Array<{ id: string }> }).articles;
    expect(editorArticles.map((item) => item.id)).toContain(createdArticle.id);
    const detailRoute = await import("@/app/api/admin/articles/[id]/route");
    const readerDetail = await detailRoute.GET(await api(`/api/admin/articles/${createdArticle.id}`, { cookie: reader.cookie }), { params: Promise.resolve({ id: createdArticle.id }) });
    expect(readerDetail.status).toBe(403);

    const patchArticleResponse = await dynamicRoute(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}`, { method: "PATCH", cookie: reporter.cookie, body: {
      expectedRevisionNumber: 1,
      title: "বাংলা শিরোনাম সংশোধিত — mixed newsroom",
      subtitle: "প্রতিবেদকের সংশোধিত বাংলা উপশিরোনাম",
      excerpt: "নতুন বাংলা সারাংশ",
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "বাংলা ও English—সংশোধিত নিরাপদ মূল লেখা" }] }] },
      categoryIds: [child.id], primaryCategoryId: child.id,
      authorIds: [author.id], primaryAuthorId: author.id, tagIds: [tag.id], featuredImageId: intent.mediaId,
      relatedArticleIds: [relatedArticle.id], relatedVideos: [{ title: "সাক্ষাৎকার", url: "https://www.youtube.com/watch?v=abcdefgh123" }],
      seoTitle: "সংশোধিত SEO title", seoDescription: "বাংলা মেটা বিবরণ", canonicalUrl: "https://news.example.test/stable/canonical", changeNote: "প্রতিবেদকের সংশোধন",
    } }), "PATCH");
    expect(patchArticleResponse.status).toBe(200);
    expect((await patchArticleResponse.json() as { article: { revisionNumber: number } }).article.revisionNumber).toBe(2);
    const staleEdit = await dynamicRoute(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}`, { method: "PATCH", cookie: reporter.cookie, body: { expectedRevisionNumber: 1, title: "stale — বাংলা", body, categoryIds: [child.id], primaryCategoryId: child.id, authorIds: [author.id], primaryAuthorId: author.id, tagIds: [], relatedArticleIds: [], relatedVideos: [] } }), "PATCH");
    expect(staleEdit.status).toBe(409);

    const submit = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: reporter.cookie, body: { action: "submit" } }));
    expect(submit.status).toBe(200);
    expect((await submit.json() as { article: { status: string } }).article.status).toBe("SUBMITTED");
    const reporterPublish = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: reporter.cookie, body: { action: "publish" } }));
    expect(reporterPublish.status).toBe(403);
    const review = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "review" } }));
    expect(review.status).toBe(200);
    const reject = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "reject", reason: "প্রাথমিক সূত্র ও তথ্য যাচাই করে সংশোধন করুন" } }));
    expect(reject.status).toBe(200);
    expect((await reject.json() as { article: { status: string } }).article.status).toBe("REJECTED");

    const rejectedEdit = await dynamicRoute(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}`, { method: "PATCH", cookie: reporter.cookie, body: {
      expectedRevisionNumber: 2, title: "সংশোধিত প্রতিবেদন — বাংলা",
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "সম্পাদকের পরামর্শে সংশোধিত বাংলা ও English প্রতিবেদন" }] }] },
      categoryIds: [child.id], primaryCategoryId: child.id, authorIds: [author.id], primaryAuthorId: author.id,
      tagIds: [tag.id], featuredImageId: intent.mediaId, relatedArticleIds: [relatedArticle.id], relatedVideos: [{ title: "সাক্ষাৎকার", url: "https://youtu.be/abcdefgh123" }],
      seoTitle: "সংশোধিত প্রতিবেদন", seoDescription: "বাংলা সংবাদ", canonicalUrl: "https://news.example.test/stable/canonical", changeNote: "সম্পাদকের পরামর্শে সংশোধন",
    } }), "PATCH");
    expect(rejectedEdit.status).toBe(200);
    expect((await rejectedEdit.json() as { article: { status: string; revisionNumber: number } }).article).toMatchObject({ status: "DRAFT", revisionNumber: 3 });
    const resubmit = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: reporter.cookie, body: { action: "resubmit" } }));
    expect(resubmit.status).toBe(200);
    expect((await resubmit.json() as { article: { status: string } }).article.status).toBe("SUBMITTED");

    expect((await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "review" } }))).status).toBe(200);
    const approve = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "approve" } }));
    expect(approve.status).toBe(200);
    stored = await prisma.article.findUniqueOrThrow({ where: { id: createdArticle.id } });
    expect(stored).toMatchObject({ status: "APPROVED", approvedRevisionNumber: 3 });
    const scheduleAt = new Date(Date.now() + 2 * 60_000).toISOString();
    const schedule = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "schedule", scheduledAt: scheduleAt } }));
    expect(schedule.status).toBe(200);
    expect((await schedule.json() as { article: { status: string } }).article.status).toBe("SCHEDULED");
    const future = new Date(scheduleAt);
    future.setSeconds(future.getSeconds() + 1);
    await prisma.followedTopic.create({ data: { userId: reader.userId, tagId: tag.id } });
    await prisma.followedCategory.create({ data: { userId: reader.userId, categoryId: child.id } });
    const { publishDueArticles } = await import("@/lib/article-service");
    const published = await publishDueArticles(future);
    expect(published).toContain(createdArticle.id);
    expect(await publishDueArticles(future)).not.toContain(createdArticle.id);
    stored = await prisma.article.findUniqueOrThrow({ where: { id: createdArticle.id } });
    expect(stored).toMatchObject({ status: "PUBLISHED", publishedRevisionNumber: 3, approvedRevisionNumber: 3 });
    const { notifyArticlePublication } = await import("@/lib/notification-service");
    await prisma.$transaction((tx) => notifyArticlePublication(tx, createdArticle.id));
    await prisma.$transaction((tx) => notifyArticlePublication(tx, createdArticle.id));
    const topicNotifications = await prisma.notification.findMany({ where: { userId: reader.userId, type: "TOPIC", dedupeKey: `topic:article:${createdArticle.id}:revision:3` } });
    expect(topicNotifications).toHaveLength(1);
    expect(topicNotifications[0]?.payload).toMatchObject({ headline: "সংশোধিত প্রতিবেদন — বাংলা", topic: expect.any(String) });
    const viewRoute = await import("@/app/api/public/articles/[slug]/view/route");
    expect((await viewRoute.POST(await api(`/api/public/articles/${stored.slug}/view`, { method: "POST", originHeader: "", ip: "198.51.100.84" }), { params: Promise.resolve({ slug: stored.slug }) })).status).toBe(403);
    const viewRequest = () => api(`/api/public/articles/${stored.slug}/view`, { method: "POST", ip: "198.51.100.84" });
    const firstView = await viewRoute.POST(await viewRequest(), { params: Promise.resolve({ slug: stored.slug }) });
    expect(firstView.status).toBe(200);
    expect(await firstView.json()).toEqual({ counted: true });
    const duplicateView = await viewRoute.POST(await viewRequest(), { params: Promise.resolve({ slug: stored.slug }) });
    expect(await duplicateView.json()).toEqual({ counted: false });
    const { dhakaDayStart } = await import("@/lib/public-news");
    const metric = await prisma.articleDailyMetric.findUniqueOrThrow({ where: { articleId_metricDate: { articleId: createdArticle.id, metricDate: dhakaDayStart(new Date()) } } });
    expect(metric.views).toBe(BigInt(1));
    const publicArticle = await getPublicArticle(stored.slug);
    expect(publicArticle?.bodyHtml).not.toMatch(/<script|javascript:|attacker\.invalid|document\.cookie/i);
    expect((await getPublicVideo(videoRouteSlug("সাক্ষাৎকার", "abcdefgh123")))?.externalId).toBe("abcdefgh123");
    expect((await getMostReadArticles()).map(({ id }) => id)).toContain(createdArticle.id);

    const flag = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "breaking", enabled: true } }));
    expect(flag.status).toBe(200);
    stored = await prisma.article.findUniqueOrThrow({ where: { id: createdArticle.id } });
    expect(stored.isBreaking).toBe(true);
    const breakingNotifications = await prisma.notification.findMany({ where: { userId: reader.userId, type: "BREAKING_NEWS", dedupeKey: `breaking:article:${createdArticle.id}:revision:3` } });
    expect(breakingNotifications).toHaveLength(1);
    expect(breakingNotifications[0]?.priority).toBe("URGENT");
    expect((await import("@/lib/notification-service")).renderNotification("article.breaking", breakingNotifications[0]!.payload).title).toBe("নতুন ব্রেকিং নিউজ");
    const toggleFlag = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "featured", enabled: true } }));
    expect(toggleFlag.status).toBe(200);
    const trendFlag = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "trending", enabled: true } }));
    expect(trendFlag.status).toBe(200);

    const seoArticle = await prisma.article.findUniqueOrThrow({ where: { id: createdArticle.id }, include: { authors: { include: { author: true } }, categories: { include: { category: true } }, media: { include: { media: true } } } });
    const meta = articleMetadata(seoArticle);
    expect(meta.title).toBe("সংশোধিত প্রতিবেদন");
    expect(meta.alternates?.canonical).toBe("https://news.example.test/stable/canonical");
    const jsonLd = articleJsonLd(seoArticle);
    expect(jsonLd["@type"]).toBe("NewsArticle");
    expect(jsonLd.inLanguage).toBe("bn-BD");
    expect(jsonLd.headline).toBe("সংশোধিত প্রতিবেদন");
    const hostileField = "</script><script>alert(document.cookie)</script>";
    const hostileJsonLd = jsonLdScript(articleJsonLd({
      ...seoArticle,
      seoTitle: hostileField,
      seoDescription: hostileField,
      authors: seoArticle.authors.map((entry) => ({ ...entry, author: { ...entry.author, name: hostileField } })),
      categories: seoArticle.categories.map((entry) => ({ ...entry, category: { ...entry.category, name: hostileField } })),
    }));
    expect(hostileJsonLd).not.toContain("</script>");
    expect(hostileJsonLd).toContain("\\u003c/script>");

    const authorInUseDelete = await authorRoute.DELETE!(await api(`/api/admin/authors/${author.id}`, { method: "DELETE", cookie: editor.cookie }), { params: Promise.resolve({ id: author.id }) });
    if (!authorInUseDelete) throw new Error("Author DELETE handler returned no response");
    expect(authorInUseDelete.status).toBe(409);
    const tagInUseDelete = await tagRoute.DELETE!(await api(`/api/admin/tags/${tag.id}`, { method: "DELETE", cookie: editor.cookie }), { params: Promise.resolve({ id: tag.id }) });
    if (!tagInUseDelete) throw new Error("Tag DELETE handler returned no response");
    expect(tagInUseDelete.status).toBe(409);
    const categoryInUseDelete = await updateCategoryRoute.DELETE!(await api(`/api/admin/categories/${child.id}`, { method: "DELETE", cookie: admin.cookie }), { params: Promise.resolve({ id: child.id }) });
    if (!categoryInUseDelete) throw new Error("Category DELETE handler returned no response");
    expect(categoryInUseDelete.status).toBe(409);

    const archive = await workflow(createdArticle.id, await api(`/api/admin/articles/${createdArticle.id}/transition`, { method: "POST", cookie: editor.cookie, body: { action: "archive" } }));
    expect(archive.status).toBe(200);
    stored = await prisma.article.findUniqueOrThrow({ where: { id: createdArticle.id } });
    expect(stored).toMatchObject({ status: "ARCHIVED", publishedRevisionNumber: 3, approvedRevisionNumber: 3 });

    const detail = await detailRoute.GET(await api(`/api/admin/articles/${createdArticle.id}`, { cookie: editor.cookie }), { params: Promise.resolve({ id: createdArticle.id }) });
    expect(detail.status).toBe(200);
    const detailJson = await detail.json() as { article: { revisions: Array<{ version: number }>; workflowEvents: Array<{ toStatus: string }> } };
    expect(detailJson.article.revisions.map(({ version }) => version)).toEqual([3, 2, 1]);
    expect(detailJson.article.workflowEvents.some((event) => event.toStatus === "REJECTED")).toBe(true);

    const editorDeletePublished = await dynamicRoute(relatedArticle.id, await api(`/api/admin/articles/${relatedArticle.id}`, { method: "DELETE", cookie: editor.cookie }), "DELETE");
    expect(editorDeletePublished.status).toBe(403);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: relatedArticle.id } })).deletedAt).toBeNull();
    const adminDeletePublished = await dynamicRoute(relatedArticle.id, await api(`/api/admin/articles/${relatedArticle.id}`, { method: "DELETE", cookie: admin.cookie }), "DELETE");
    expect(adminDeletePublished.status).toBe(200);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: relatedArticle.id } })).deletedAt).not.toBeNull();
  }, 120_000);

  it("supports own-draft CRUD and denies unrelated reporter reads/publishing", async () => {
    const owner = await authSignup(`নিজস্ব প্রতিবেদক ${suffix}`, `owner-${suffix}@example.test`, randomTestPassword());
    const other = await authSignup(`অন্য প্রতিবেদক ${suffix}`, `other-${suffix}@example.test`, randomTestPassword());
    await grant(owner.userId, "REPORTER"); await grant(other.userId, "REPORTER");
    const categoriesRoute = await import("@/app/api/admin/categories/route");
    const categoryResponse = await categoriesRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: (await authSignup(`সম্পাদক ${suffix}`, `secondary-editor-${suffix}@example.test`, randomTestPassword())).cookie, body: { name: `নিজস্ব বিভাগ ${suffix}`, isActive: true, sortOrder: 1 } }));
    expect(categoryResponse.status).toBe(403);
    // Only an administrator may create the category; an editor still creates the author and article draft.
    const editorAccount = await authSignup(`সম্পাদক ${suffix}`, `own-editor-${suffix}@example.test`, randomTestPassword()); await grant(editorAccount.userId, "EDITOR");
    const transientAdminPassword = `${randomBytes(24).toString("base64url")}A!`;
    const adminAccount = await authSignup(`অ্যাডমিন ${suffix}`, `category-admin-${suffix}@example.test`, transientAdminPassword); await grant(adminAccount.userId, "ADMIN");
    const categoryCreate = await categoriesRoute.POST(await api("/api/admin/categories", { method: "POST", cookie: adminAccount.cookie, body: { name: `নিজস্ব বিভাগ ${suffix}`, isActive: true, sortOrder: 1 } }));
    expect(categoryCreate.status).toBe(201);
    const ownCategory = (await categoryCreate.json() as { category: { id: string } }).category; categoryIds.push(ownCategory.id);
    const authorApi = await import("@/app/api/admin/authors/route");
    const authorCreate = await authorApi.POST(await api("/api/admin/authors", { method: "POST", cookie: editorAccount.cookie, body: { name: `নিজস্ব লেখক ${suffix}` } }));
    expect(authorCreate.status).toBe(201);
    const ownAuthor = (await authorCreate.json() as { author: { id: string } }).author; authorIds.push(ownAuthor.id);
    const articleCollection = await import("@/app/api/admin/articles/route");
    const create = await articleCollection.POST(await api("/api/admin/articles", { method: "POST", cookie: owner.cookie, body: { title: `নিজস্ব খসড়া ${suffix}`, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "নিজস্ব লেখা" }] }] }, categoryIds: [ownCategory.id], primaryCategoryId: ownCategory.id, authorIds: [ownAuthor.id], primaryAuthorId: ownAuthor.id, tagIds: [], relatedArticleIds: [], relatedVideos: [] } }));
    expect(create.status).toBe(201);
    const created = (await create.json() as { article: { id: string } }).article; articleIds.push(created.id);
    const otherDetail = await dynamicRoute(created.id, await api(`/api/admin/articles/${created.id}`, { cookie: other.cookie }), "GET");
    expect(otherDetail.status).toBe(404);
    const otherSubmit = await workflow(created.id, await api(`/api/admin/articles/${created.id}/transition`, { method: "POST", cookie: other.cookie, body: { action: "submit" } }));
    expect(otherSubmit.status).toBe(403);
    const remove = await dynamicRoute(created.id, await api(`/api/admin/articles/${created.id}`, { method: "DELETE", cookie: owner.cookie }), "DELETE");
    expect(remove.status).toBe(200);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: created.id } })).deletedAt).not.toBeNull();
  }, 60_000);
});
