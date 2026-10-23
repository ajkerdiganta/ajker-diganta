import { createHash } from "node:crypto";
import { Prisma, ArticleStatus, WorkflowAction } from "@/generated/prisma/client";
import type { Principal } from "@/lib/cms-api";
import type { ArticleInput } from "@/lib/cms-schemas";
import { prisma } from "@/lib/prisma";
import { normalizeArticleBody } from "@/lib/article-content";
import { hasPermission } from "@/lib/authorization";
import { uniqueSlug } from "@/lib/slug";
import { auditCms } from "@/lib/cms-audit";
import { notifyArticlePublication, notifyBreakingFlagEnabled } from "@/lib/notification-service";

export class CmsServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const safeSnapshot = (input: ArticleInput, slug: string, bodyHtml: string) => ({
  title: input.title,
  subtitle: input.subtitle ?? null,
  excerpt: input.excerpt ?? null,
  slug,
  bodyHtml,
  categoryIds: input.categoryIds,
  primaryCategoryId: input.primaryCategoryId ?? input.categoryIds[0] ?? null,
  authorIds: input.authorIds,
  primaryAuthorId: input.primaryAuthorId ?? input.authorIds[0] ?? null,
  tagIds: input.tagIds,
  featuredImageId: input.featuredImageId ?? null,
  relatedArticleIds: input.relatedArticleIds,
  relatedVideos: input.relatedVideos,
  seoTitle: input.seoTitle ?? null,
  seoDescription: input.seoDescription ?? null,
  canonicalUrl: input.canonicalUrl ?? null,
});

function relationIds(input: ArticleInput) {
  const categoryIds = [...new Set(input.categoryIds)];
  const authorIds = [...new Set(input.authorIds)];
  const tagIds = [...new Set(input.tagIds)];
  const relatedArticleIds = [...new Set(input.relatedArticleIds)];
  const primaryCategoryId = input.primaryCategoryId ?? categoryIds[0] ?? null;
  const primaryAuthorId = input.primaryAuthorId ?? authorIds[0] ?? null;
  if (primaryCategoryId && !categoryIds.includes(primaryCategoryId)) throw new CmsServiceError(400, "প্রধান বিভাগ তালিকায় থাকতে হবে");
  if (primaryAuthorId && !authorIds.includes(primaryAuthorId)) throw new CmsServiceError(400, "প্রধান লেখক তালিকায় থাকতে হবে");
  if (relatedArticleIds.some((id) => !id)) throw new CmsServiceError(400, "সম্পর্কিত সংবাদ নির্বাচন সঠিক নয়");
  return { categoryIds, authorIds, tagIds, relatedArticleIds, primaryCategoryId, primaryAuthorId };
}

async function validateReferences(input: ArticleInput, actor: Principal, articleId?: string) {
  const relations = relationIds(input);
  if (relations.relatedArticleIds.includes(articleId ?? "")) throw new CmsServiceError(400, "সংবাদটি নিজেকেই সম্পর্কিত সংবাদ হিসেবে পেতে পারে না");
  const [categories, authors, tags, related, inlineIds] = await Promise.all([
    relations.categoryIds.length ? prisma.category.findMany({ where: { id: { in: relations.categoryIds }, isActive: true, deletedAt: null }, select: { id: true } }) : [],
    relations.authorIds.length ? prisma.author.findMany({ where: { id: { in: relations.authorIds }, isActive: true, deletedAt: null }, select: { id: true } }) : [],
    relations.tagIds.length ? prisma.tag.findMany({ where: { id: { in: relations.tagIds }, deletedAt: null }, select: { id: true } }) : [],
    relations.relatedArticleIds.length ? prisma.article.findMany({ where: { id: { in: relations.relatedArticleIds }, status: { in: ["APPROVED", "SCHEDULED", "PUBLISHED"] }, deletedAt: null }, select: { id: true } }) : [],
    normalizeArticleBody(input.body).mediaIds,
  ]);
  if (categories.length !== relations.categoryIds.length) throw new CmsServiceError(400, "একটি বা একাধিক বিভাগ আর সক্রিয় নেই");
  if (authors.length !== relations.authorIds.length) throw new CmsServiceError(400, "একটি বা একাধিক লেখক আর সক্রিয় নেই");
  if (tags.length !== relations.tagIds.length) throw new CmsServiceError(400, "একটি বা একাধিক ট্যাগ আর সক্রিয় নেই");
  if (related.length !== relations.relatedArticleIds.length) throw new CmsServiceError(400, "সম্পর্কিত সংবাদ প্রকাশযোগ্য অবস্থায় নেই");

  const mediaIds = [...new Set([...inlineIds, ...(input.featuredImageId ? [input.featuredImageId] : [])])];
  if (mediaIds.length) {
    const canReadAll = await hasPermission(actor.id, "media.read");
    const media = await prisma.media.findMany({
      where: {
        id: { in: mediaIds }, status: "VERIFIED", visibility: "PUBLIC", deletedAt: null,
        ...(canReadAll ? {} : { uploadedById: actor.id }),
      },
      select: { id: true },
    });
    if (media.length !== mediaIds.length) throw new CmsServiceError(400, "ছবি যাচাইকৃত মিডিয়া লাইব্রেরি থেকে নির্বাচন করুন");
  }
  for (const video of input.relatedVideos) {
    const url = new URL(video.url);
    if (!new Set(["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"]).has(url.hostname)) {
      throw new CmsServiceError(400, "সম্পর্কিত ভিডিও হিসেবে অনুমোদিত YouTube URL দিন");
    }
  }
  return { relations, mediaIds, normalizedBody: normalizeArticleBody(input.body) };
}

function articleErrorMessage(error: unknown): CmsServiceError | null {
  if (error instanceof CmsServiceError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return new CmsServiceError(409, "এই স্লাগ বা সম্পর্কটি আগে থেকেই ব্যবহৃত");
    if (error.code === "P2003") return new CmsServiceError(409, "সম্পর্কিত রেকর্ডটি আর পাওয়া যাচ্ছে না");
    if (error.code === "P2034") return new CmsServiceError(409, "একই সংবাদ অন্য কেউ পরিবর্তন করেছেন; পৃষ্ঠা নতুন করে লোড করুন");
  }
  return null;
}

async function saveRelations(tx: Prisma.TransactionClient, articleId: string, input: ArticleInput, relations: ReturnType<typeof relationIds>, inlineMediaIds: string[]) {
  await tx.articleCategory.deleteMany({ where: { articleId } });
  await tx.articleAuthor.deleteMany({ where: { articleId } });
  await tx.articleTag.deleteMany({ where: { articleId } });
  await tx.articleMedia.deleteMany({ where: { articleId } });
  await tx.relatedArticle.deleteMany({ where: { articleId } });
  await tx.articleRelatedVideo.deleteMany({ where: { articleId } });
  if (relations.categoryIds.length) await tx.articleCategory.createMany({ data: relations.categoryIds.map((categoryId) => ({ articleId, categoryId, isPrimary: categoryId === relations.primaryCategoryId })) });
  if (relations.authorIds.length) await tx.articleAuthor.createMany({ data: relations.authorIds.map((authorId, position) => ({ articleId, authorId, isPrimary: authorId === relations.primaryAuthorId, position })) });
  if (relations.tagIds.length) await tx.articleTag.createMany({ data: relations.tagIds.map((tagId) => ({ articleId, tagId })) });
  const mediaRows = [
    ...(input.featuredImageId ? [{ articleId, mediaId: input.featuredImageId, role: "FEATURED_IMAGE" as const, position: 0 }] : []),
    ...[...new Set(inlineMediaIds)].map((mediaId, position) => ({ articleId, mediaId, role: "INLINE" as const, position })),
  ];
  if (mediaRows.length) await tx.articleMedia.createMany({ data: mediaRows });
  if (relations.relatedArticleIds.length) await tx.relatedArticle.createMany({ data: relations.relatedArticleIds.map((relatedArticleId, position) => ({ articleId, relatedArticleId, position })) });
  if (input.relatedVideos.length) {
    await tx.articleRelatedVideo.createMany({ data: input.relatedVideos.map((video, position) => {
      const url = new URL(video.url);
      const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? "";
      if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) throw new CmsServiceError(400, "YouTube ভিডিও আইডি সঠিক নয়");
      return { articleId, title: video.title, provider: "youtube", externalId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}`, position };
    }) });
  }
}

async function makeRevision(tx: Prisma.TransactionClient, articleId: string, version: number, input: ArticleInput, slug: string, html: string, safeBody: object, actorId: string) {
  const snapshot = safeSnapshot(input, slug, html);
  await tx.articleRevision.create({
    data: {
      articleId, version, title: input.title, subtitle: input.subtitle ?? null, excerpt: input.excerpt ?? null,
      body: safeBody as Prisma.InputJsonValue, bodyHtml: html,
      seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null,
      canonicalUrl: input.canonicalUrl ?? null, snapshot: snapshot as Prisma.InputJsonValue,
      changeNote: input.changeNote ?? null, createdById: actorId,
    },
  });
}

export async function createArticle(input: ArticleInput, actor: Principal) {
  if (!(await hasPermission(actor.id, "article.create"))) throw new CmsServiceError(403, "খসড়া তৈরির অনুমতি নেই");
  const normalized = await validateReferences(input, actor);
  const relations = normalized.relations;
  const slug = input.slug ?? await uniqueSlug(input.title, (candidate) => prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean));
  try {
    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          slug, title: input.title, subtitle: input.subtitle ?? null, excerpt: input.excerpt ?? null,
          body: normalized.normalizedBody.json as Prisma.InputJsonValue, bodyHtml: normalized.normalizedBody.html,
          seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null, canonicalUrl: input.canonicalUrl ?? null,
          createdById: actor.id, updatedById: actor.id,
        },
      });
      await saveRelations(tx, created.id, input, relations, normalized.mediaIds);
      await makeRevision(tx, created.id, 1, input, slug, normalized.normalizedBody.html, normalized.normalizedBody.json, actor.id);
      await tx.articleWorkflowEvent.create({ data: { articleId: created.id, fromStatus: null, toStatus: "DRAFT", action: WorkflowAction.CREATE, actorId: actor.id } });
      await auditCms(tx, { actorId: actor.id, action: "article.create", resourceType: "Article", resourceId: created.id });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return article;
  } catch (error) {
    throw articleErrorMessage(error) ?? error;
  }
}

export async function getArticleForActor(id: string, actor: Principal) {
  const canReadAny = await hasPermission(actor.id, "article.read.any");
  const article = await prisma.article.findFirst({
    where: { id, deletedAt: null, ...(canReadAny ? {} : { createdById: actor.id }) },
    include: {
      categories: { include: { category: true }, orderBy: { category: { sortOrder: "asc" } } },
      authors: { include: { author: true }, orderBy: { position: "asc" } },
      tags: { include: { tag: true } },
      media: { include: { media: true } },
      revisions: { orderBy: { version: "desc" }, take: 30, select: { id: true, version: true, changeNote: true, createdAt: true, createdBy: { select: { id: true, name: true } } } },
      workflowEvents: { orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { id: true, name: true } } } },
      relatedArticles: { include: { relatedArticle: { select: { id: true, title: true, slug: true, status: true } } }, orderBy: { position: "asc" } },
      relatedVideos: { orderBy: { position: "asc" } },
    },
  });
  return article;
}

export async function listArticles(actor: Principal, filters: { status?: ArticleStatus; query?: string; page?: number }) {
  const canReadAny = await hasPermission(actor.id, "article.read.any");
  const page = Math.min(Math.max(filters.page ?? 1, 1), 1000);
  const query = filters.query?.normalize("NFC").trim().slice(0, 120);
  const rows = await prisma.article.findMany({
    where: {
      deletedAt: null,
      ...(canReadAny ? {} : { createdById: actor.id }),
      ...(filters.status ? { status: filters.status } : {}),
      ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 40,
    skip: (page - 1) * 40,
    select: {
      id: true, slug: true, title: true, status: true, revisionNumber: true, updatedAt: true,
      publishedAt: true, scheduledAt: true, isBreaking: true, isFeatured: true, isTrending: true,
      createdById: true,
      categories: { where: { isPrimary: true }, include: { category: { select: { id: true, name: true } } } },
      authors: { where: { isPrimary: true }, include: { author: { select: { id: true, name: true } } } },
      media: { where: { role: "FEATURED_IMAGE" }, include: { media: { select: { id: true, altText: true, caption: true } } }, take: 1 },
    },
  });
  return rows;
}

export async function updateArticle(id: string, input: ArticleInput, actor: Principal, expectedRevisionNumber: number) {
  const article = await prisma.article.findFirst({ where: { id, deletedAt: null } });
  if (!article) throw new CmsServiceError(404, "সংবাদ পাওয়া যায়নি");
  if (article.status === "ARCHIVED") throw new CmsServiceError(409, "সংরক্ষণাগারের সংবাদ সম্পাদনার জন্য নতুন খসড়া তৈরি করুন");
  const canEditAny = await hasPermission(actor.id, "article.edit.any");
  const canEditOwnDraft = await hasPermission(actor.id, "article.edit.own.draft") && article.createdById === actor.id && ["DRAFT", "REJECTED"].includes(article.status);
  if (!canEditAny && !canEditOwnDraft) throw new CmsServiceError(403, "এই সংবাদ সম্পাদনার অনুমতি নেই");
  if (article.revisionNumber !== expectedRevisionNumber) throw new CmsServiceError(409, "এই সংবাদে নতুন পরিবর্তন আছে; পৃষ্ঠা রিফ্রেশ করুন");
  if (["PUBLISHED", "ARCHIVED"].includes(article.status) && input.slug && input.slug !== article.slug) {
    throw new CmsServiceError(409, "প্রকাশিত সংবাদের স্থায়ী স্লাগ পরিবর্তন করা যাবে না");
  }
  const normalized = await validateReferences(input, actor, id);
  const relations = normalized.relations;
  const slug = input.slug ?? (input.title === article.title ? article.slug : await uniqueSlug(input.title, async (candidate) => {
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(existing && existing.id !== id);
  }));
  const needsFreshReview = ["REJECTED", "APPROVED", "SCHEDULED", "PUBLISHED"].includes(article.status);
  const nextStatus: ArticleStatus = needsFreshReview ? "DRAFT" : article.status;
  const nextAction = article.status === "REJECTED" ? WorkflowAction.EDIT_REJECTED : WorkflowAction.UPDATE;
  try {
    return await prisma.$transaction(async (tx) => {
      const update = await tx.article.updateMany({
        where: { id, revisionNumber: expectedRevisionNumber, deletedAt: null },
        data: {
          slug, title: input.title, subtitle: input.subtitle ?? null, excerpt: input.excerpt ?? null,
          body: normalized.normalizedBody.json as Prisma.InputJsonValue, bodyHtml: normalized.normalizedBody.html,
          seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null,
          canonicalUrl: input.canonicalUrl ?? null, revisionNumber: { increment: 1 },
          updatedById: actor.id, status: nextStatus,
          approvedById: needsFreshReview ? null : undefined,
          approvedRevisionNumber: needsFreshReview ? null : undefined,
          publishedById: needsFreshReview ? null : undefined,
          publishedAt: needsFreshReview ? null : undefined,
          publishedRevisionNumber: needsFreshReview ? null : undefined,
          archivedAt: needsFreshReview ? null : undefined,
          scheduledAt: needsFreshReview ? null : undefined,
        },
      });
      if (!update.count) throw new CmsServiceError(409, "একই সংবাদ অন্য কেউ পরিবর্তন করেছেন; পৃষ্ঠা নতুন করে লোড করুন");
      if (slug !== article.slug) {
        await tx.articleSlugRedirect.create({ data: { articleId: id, oldSlug: article.slug } });
      }
      await saveRelations(tx, id, input, relations, normalized.mediaIds);
      await makeRevision(tx, id, expectedRevisionNumber + 1, input, slug, normalized.normalizedBody.html, normalized.normalizedBody.json, actor.id);
      if (nextStatus !== article.status) {
        await tx.articleWorkflowEvent.create({ data: { articleId: id, fromStatus: article.status, toStatus: nextStatus, action: nextAction, actorId: actor.id } });
      } else {
        await tx.articleWorkflowEvent.create({ data: { articleId: id, fromStatus: article.status, toStatus: article.status, action: WorkflowAction.UPDATE, actorId: actor.id, metadata: { changed: ["content", "metadata", "relationships"] } } });
      }
      await auditCms(tx, { actorId: actor.id, action: "article.update", resourceType: "Article", resourceId: id, metadata: { revision: expectedRevisionNumber + 1, status: nextStatus } });
      return tx.article.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    throw articleErrorMessage(error) ?? error;
  }
}

export async function setArticleStatus(
  id: string,
  action: "submit" | "resubmit" | "review" | "approve" | "reject" | "schedule" | "cancel-schedule" | "publish" | "archive",
  actor: Principal,
  details: { reason?: string; scheduledAt?: string } = {},
) {
  const article = await prisma.article.findFirst({ where: { id, deletedAt: null } });
  if (!article) throw new CmsServiceError(404, "সংবাদ পাওয়া যায়নি");
  const reporterOwns = article.createdById === actor.id;
  const admin = await hasPermission(actor.id, "article.edit.any");
  let permission: string;
  let expected: ArticleStatus;
  let next: ArticleStatus;
  let workflow: WorkflowAction;
  switch (action) {
    case "submit": permission = "article.submit"; expected = "DRAFT"; next = "SUBMITTED"; workflow = WorkflowAction.SUBMIT; break;
    case "resubmit": permission = "article.resubmit"; expected = "DRAFT"; next = "SUBMITTED"; workflow = WorkflowAction.RESUBMIT; break;
    case "review": permission = "article.review"; expected = "SUBMITTED"; next = "UNDER_REVIEW"; workflow = WorkflowAction.REVIEW; break;
    case "approve": permission = "article.approve"; expected = "UNDER_REVIEW"; next = "APPROVED"; workflow = WorkflowAction.APPROVE; break;
    case "reject": permission = "article.reject"; expected = "UNDER_REVIEW"; next = "REJECTED"; workflow = WorkflowAction.REJECT; break;
    case "schedule": permission = "article.schedule"; expected = "APPROVED"; next = "SCHEDULED"; workflow = WorkflowAction.SCHEDULE; break;
    case "cancel-schedule": permission = "article.schedule"; expected = "SCHEDULED"; next = "APPROVED"; workflow = WorkflowAction.CANCEL_SCHEDULE; break;
    case "publish": permission = "article.publish"; expected = "APPROVED"; next = "PUBLISHED"; workflow = WorkflowAction.PUBLISH; break;
    case "archive": permission = "article.archive"; expected = "PUBLISHED"; next = "ARCHIVED"; workflow = WorkflowAction.ARCHIVE; break;
  }
  if (!(await hasPermission(actor.id, permission))) throw new CmsServiceError(403, "এই সম্পাদকীয় কাজের অনুমতি নেই");
  if ((action === "submit" || action === "resubmit") && !reporterOwns && !admin) throw new CmsServiceError(403, "শুধু নিজের সংবাদ জমা দেওয়া যাবে");
  if ((action === "submit" || action === "resubmit") && article.createdById !== actor.id && !(await hasPermission(actor.id, "article.edit.any"))) throw new CmsServiceError(403, "শুধু নিজের সংবাদ জমা দেওয়া যাবে");
  if (article.status !== expected) throw new CmsServiceError(409, `এই কাজটি ${article.status} অবস্থায় করা যাবে না`);
  if ((action === "approve" || action === "publish" || action === "schedule") && article.createdById === actor.id) throw new CmsServiceError(403, "নিজের লেখা নিজে অনুমোদন বা প্রকাশ করা যাবে না");
  if (action === "reject" && (!details.reason || details.reason.trim().length < 8)) throw new CmsServiceError(400, "ফেরত দেওয়ার কারণ লিখুন");
  if (action === "submit" || action === "resubmit") {
    const [hasPrimaryCategory, hasPrimaryAuthor] = await Promise.all([
      prisma.articleCategory.count({ where: { articleId: id, isPrimary: true } }),
      prisma.articleAuthor.count({ where: { articleId: id, isPrimary: true } }),
    ]);
    if (!article.title.trim() || !article.bodyHtml.replace(/<[^>]+>/g, " ").trim() || !hasPrimaryCategory || !hasPrimaryAuthor) {
      throw new CmsServiceError(400, "জমা দেওয়ার আগে সংবাদের লেখা, প্রধান বিভাগ ও লেখক নির্বাচন করুন");
    }
  }
  const scheduledAt = action === "schedule" ? new Date(details.scheduledAt ?? "") : null;
  if (action === "schedule" && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date(Date.now() + 60_000))) throw new CmsServiceError(400, "প্রকাশের সময় অন্তত এক মিনিট পরে দিন");
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.article.updateMany({
        where: { id, status: expected, revisionNumber: article.revisionNumber, deletedAt: null },
        data: {
          status: next,
          updatedById: actor.id,
          scheduledAt,
          publishedAt: next === "PUBLISHED" ? now : action === "archive" ? article.publishedAt : null,
          archivedAt: next === "ARCHIVED" ? now : null,
          approvedById: action === "approve" ? actor.id : action === "resubmit" ? null : undefined,
          approvedRevisionNumber: action === "approve" ? article.revisionNumber : action === "resubmit" ? null : undefined,
          publishedRevisionNumber: action === "publish" ? article.revisionNumber : undefined,
          publishedById: action === "publish" ? actor.id : undefined,
        },
      });
      if (!updated.count) throw new CmsServiceError(409, "সংবাদটি ইতিমধ্যে অন্য কেউ পরিবর্তন করেছেন");
      await tx.articleWorkflowEvent.create({ data: { articleId: id, fromStatus: expected, toStatus: next, action: workflow, actorId: actor.id, reason: details.reason } });
      await auditCms(tx, { actorId: actor.id, action: `article.${action}`, resourceType: "Article", resourceId: id, metadata: action === "schedule" ? { scheduledAt: scheduledAt?.toISOString() } : undefined });
      if (action === "publish") await notifyArticlePublication(tx, id);
      return tx.article.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    throw articleErrorMessage(error) ?? error;
  }
}

export async function setArticleFlag(id: string, flag: "breaking" | "featured" | "trending", enabled: boolean, untilInput: string | undefined, actor: Principal) {
  const permission = flag === "breaking" ? "article.breaking" : "article.feature";
  if (!(await hasPermission(actor.id, permission))) throw new CmsServiceError(403, "এই ফিচার পরিচালনার অনুমতি নেই");
  const article = await prisma.article.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true, revisionNumber: true } });
  if (!article) throw new CmsServiceError(404, "সংবাদ পাওয়া যায়নি");
  if (!["PUBLISHED", "ARCHIVED"].includes(article.status)) throw new CmsServiceError(409, "প্রকাশিত সংবাদেই এই ফিচার চালু করা যাবে");
  const until = enabled ? untilInput ? new Date(untilInput) : new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
  if (enabled && (!until || !Number.isFinite(until.getTime()) || until <= new Date())) throw new CmsServiceError(400, "ভবিষ্যতের মেয়াদ নির্ধারণ করুন");
  const data = flag === "breaking" ? { isBreaking: enabled, breakingUntil: until } : flag === "featured" ? { isFeatured: enabled, featuredUntil: until } : { isTrending: enabled, trendingUntil: until };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.article.updateMany({ where: { id, status: article.status, revisionNumber: article.revisionNumber }, data: { ...data, updatedById: actor.id } });
    if (!updated.count) throw new CmsServiceError(409, "সংবাদটি অন্য কেউ পরিবর্তন করেছেন");
    await tx.articleWorkflowEvent.create({ data: { articleId: id, fromStatus: article.status, toStatus: article.status, action: WorkflowAction.UPDATE, actorId: actor.id, metadata: { flag, enabled, until: until?.toISOString() ?? null } } });
    await auditCms(tx, { actorId: actor.id, action: `article.${flag}.${enabled ? "enable" : "disable"}`, resourceType: "Article", resourceId: id, metadata: { until: until?.toISOString() ?? null } });
    if (flag === "breaking" && enabled) await notifyBreakingFlagEnabled(tx, id);
    return tx.article.findUniqueOrThrow({ where: { id } });
  });
}

export async function listDueScheduledArticles(now = new Date(), batchSize = 100) {
  return prisma.article.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now }, deletedAt: null }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: Math.min(batchSize, 100), select: { id: true, revisionNumber: true, approvedRevisionNumber: true, scheduledAt: true, approvedById: true, createdById: true } });
}

export async function publishDueArticles(now = new Date()) {
  const due = await listDueScheduledArticles(now);
  const published: string[] = [];
  for (const item of due) {
    if (item.approvedRevisionNumber !== item.revisionNumber) continue;
    const actorId = item.approvedById ?? item.createdById;
    await prisma.$transaction(async (tx) => {
      const update = await tx.article.updateMany({ where: { id: item.id, status: "SCHEDULED", scheduledAt: { lte: now }, revisionNumber: item.revisionNumber, approvedRevisionNumber: item.revisionNumber, deletedAt: null }, data: { status: "PUBLISHED", scheduledAt: null, publishedAt: now, publishedRevisionNumber: item.revisionNumber, publishedById: actorId } });
      if (!update.count) return;
      await tx.articleWorkflowEvent.create({ data: { articleId: item.id, fromStatus: "SCHEDULED", toStatus: "PUBLISHED", action: WorkflowAction.PUBLISH, actorId, metadata: { scheduledPublisher: true } } });
      await auditCms(tx, { actorId, action: "article.publish.scheduled", resourceType: "Article", resourceId: item.id });
      await notifyArticlePublication(tx, item.id);
      published.push(item.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  return published;
}

export function checksum(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
