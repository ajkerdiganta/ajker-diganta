import "server-only";
import { Prisma, VideoStatus, VideoWorkflowAction } from "@/generated/prisma/client";
import type { Principal } from "@/lib/cms-api";
import type { VideoInput, VideoTransitionInput } from "@/lib/video-schemas";
import { isValidVideoThumbnailUrl, parseHostedVideoUrl, videoThumbnailUrl } from "@/lib/video-provider";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { auditCms } from "@/lib/cms-audit";
import { notifyVideoPublication } from "@/lib/notification-service";

export class VideoServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const videoSelect = {
  id: true, slug: true, title: true, description: true, thumbnailUrl: true, provider: true,
  videoUrl: true, externalId: true, durationSeconds: true, status: true, seoTitle: true,
  seoDescription: true, revisionNumber: true, approvedRevisionNumber: true,
  publishedRevisionNumber: true, viewCount: true, publishedAt: true, categoryId: true,
  authorId: true, createdById: true, updatedById: true, approvedById: true,
  publishedById: true, createdAt: true, updatedAt: true, deletedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  author: { select: { id: true, name: true, slug: true, title: true, isActive: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  relatedArticles: { orderBy: { position: "asc" as const }, select: { position: true, relatedArticle: { select: { id: true, slug: true, title: true, publishedAt: true } } } },
  workflowEvents: { orderBy: { createdAt: "desc" as const }, take: 25, select: { fromStatus: true, toStatus: true, action: true, reason: true, createdAt: true, actor: { select: { id: true, name: true } } } },
} satisfies Prisma.VideoSelect;

const publicArticleWhere: Prisma.ArticleWhereInput = {
  status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null,
};

function validateVideoInput(input: VideoInput) {
  if (input.provider !== "YOUTUBE") throw new VideoServiceError(400, "এই ভিডিও সরবরাহকারী এখন সমর্থিত নয়");
  const parsed = parseHostedVideoUrl(input.videoUrl);
  if (!parsed) throw new VideoServiceError(400, "HTTPS YouTube ভিডিও লিংক সঠিক নয়");
  const thumbnailUrl = input.thumbnailUrl ?? videoThumbnailUrl(parsed.provider, parsed.externalId);
  if (!thumbnailUrl || !isValidVideoThumbnailUrl(thumbnailUrl, parsed.provider, parsed.externalId)) {
    throw new VideoServiceError(400, "এই YouTube ভিডিওর অনুমোদিত thumbnail URL দিন");
  }
  const relatedArticleIds = [...new Set(input.relatedArticleIds)];
  const tagIds = [...new Set(input.tagIds)];
  return { parsed, thumbnailUrl, relatedArticleIds, tagIds };
}

async function validateVideoReferences(input: VideoInput) {
  const { relatedArticleIds, tagIds } = validateVideoInput(input);
  const [category, author, tags, articles] = await Promise.all([
    prisma.category.findFirst({ where: { id: input.categoryId, isActive: true, deletedAt: null }, select: { id: true } }),
    prisma.author.findFirst({ where: { id: input.authorId, isActive: true, deletedAt: null }, select: { id: true } }),
    tagIds.length ? prisma.tag.findMany({ where: { id: { in: tagIds }, deletedAt: null }, select: { id: true } }) : [],
    relatedArticleIds.length ? prisma.article.findMany({ where: { id: { in: relatedArticleIds }, ...publicArticleWhere }, select: { id: true } }) : [],
  ]);
  if (!category) throw new VideoServiceError(400, "একটি সক্রিয় ভিডিও বিভাগ নির্বাচন করুন");
  if (!author) throw new VideoServiceError(400, "একজন সক্রিয় ভিডিও লেখক নির্বাচন করুন");
  if (tags.length !== tagIds.length) throw new VideoServiceError(400, "একটি বা একাধিক ভিডিও ট্যাগ আর সক্রিয় নেই");
  if (articles.length !== relatedArticleIds.length) throw new VideoServiceError(400, "সম্পর্কিত সংবাদ প্রকাশিত অবস্থায় থাকতে হবে");
  return { ...validateVideoInput(input), tagIds, relatedArticleIds };
}

function toVideoServiceError(error: unknown): VideoServiceError | null {
  if (error instanceof VideoServiceError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return new VideoServiceError(409, "এই video URL বা স্লাগ আগে থেকেই newsroom-এ যুক্ত আছে");
    if (error.code === "P2003") return new VideoServiceError(409, "সম্পর্কিত বিভাগ, লেখক, ট্যাগ বা সংবাদ আর পাওয়া যাচ্ছে না");
    if (error.code === "P2034") return new VideoServiceError(409, "ভিডিওটি অন্য কেউ পরিবর্তন করেছেন; আবার লোড করুন");
  }
  return null;
}

async function saveVideoRelations(tx: Prisma.TransactionClient, videoId: string, refs: Awaited<ReturnType<typeof validateVideoReferences>>) {
  await tx.videoTag.deleteMany({ where: { videoId } });
  await tx.videoRelatedArticle.deleteMany({ where: { videoId } });
  if (refs.tagIds.length) await tx.videoTag.createMany({ data: refs.tagIds.map((tagId) => ({ videoId, tagId })) });
  if (refs.relatedArticleIds.length) await tx.videoRelatedArticle.createMany({ data: refs.relatedArticleIds.map((relatedArticleId, position) => ({ videoId, relatedArticleId, position })) });
}

export async function listAdminVideos(actor: Principal, options: { status?: VideoStatus; query?: string; page?: number } = {}) {
  const canReadAny = await hasPermission(actor.id, "video.read.any");
  if (!canReadAny && !(await hasPermission(actor.id, "video.read.own"))) throw new VideoServiceError(403, "ভিডিও তালিকা দেখার অনুমতি নেই");
  const query = options.query?.normalize("NFC").trim().slice(0, 100);
  const where: Prisma.VideoWhereInput = {
    deletedAt: null,
    ...(options.status ? { status: options.status } : {}),
    ...(!canReadAny ? { createdById: actor.id } : {}),
    ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const page = Math.max(1, Math.min(1000, Math.trunc(options.page ?? 1)));
  const [videos, total] = await Promise.all([
    prisma.video.findMany({ where, select: videoSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 40, skip: (page - 1) * 40 }),
    prisma.video.count({ where }),
  ]);
  return { videos: videos.map((video) => ({ ...video, viewCount: video.viewCount.toString() })), page, pageSize: 40, total, totalPages: Math.max(1, Math.ceil(total / 40)) };
}

export async function getVideoPermissions(actorId: string) {
  const permissions = {
    create: "video.create", editAny: "video.edit.any", editOwn: "video.edit.own.draft",
    deleteAny: "video.delete.any", deleteOwn: "video.delete.own", submit: "video.submit",
    resubmit: "video.resubmit", review: "video.review", approve: "video.approve",
    reject: "video.reject", publish: "video.publish", archive: "video.archive",
  } as const;
  const entries = await Promise.all(Object.entries(permissions).map(async ([key, code]) => [key, await hasPermission(actorId, code)] as const));
  return Object.fromEntries(entries) as { [K in keyof typeof permissions]: boolean };
}

export async function getAdminVideo(actor: Principal, id: string) {
  const video = await prisma.video.findFirst({ where: { id, deletedAt: null }, select: videoSelect });
  if (!video) throw new VideoServiceError(404, "ভিডিও পাওয়া যায়নি");
  if (!(await hasPermission(actor.id, "video.read.any")) && (video.createdById !== actor.id || !(await hasPermission(actor.id, "video.read.own")))) throw new VideoServiceError(403, "এই ভিডিও দেখার অনুমতি নেই");
  return { ...video, viewCount: video.viewCount.toString() };
}

export async function createVideo(input: VideoInput, actor: Principal) {
  if (!(await hasPermission(actor.id, "video.create"))) throw new VideoServiceError(403, "ভিডিও খসড়া তৈরির অনুমতি নেই");
  const refs = await validateVideoReferences(input);
  const slug = input.slug ?? await uniqueSlug(input.title, (candidate) => prisma.video.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean));
  try {
    const video = await prisma.$transaction(async (tx) => {
      const created = await tx.video.create({ data: {
        slug, title: input.title.normalize("NFC"), description: input.description.normalize("NFC"),
        provider: refs.parsed.provider, videoUrl: refs.parsed.canonicalUrl, externalId: refs.parsed.externalId,
        thumbnailUrl: refs.thumbnailUrl, durationSeconds: input.durationSeconds ?? null,
        categoryId: input.categoryId, authorId: input.authorId, createdById: actor.id, updatedById: actor.id,
        seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null,
      } });
      await saveVideoRelations(tx, created.id, refs);
      await tx.videoWorkflowEvent.create({ data: { videoId: created.id, fromStatus: null, toStatus: "DRAFT", action: VideoWorkflowAction.CREATE, actorId: actor.id } });
      await auditCms(tx, { actorId: actor.id, action: "video.create", resourceType: "Video", resourceId: created.id });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return video;
  } catch (error) { throw toVideoServiceError(error) ?? error; }
}

export async function updateVideo(id: string, input: VideoInput & { expectedRevisionNumber: number }, actor: Principal) {
  const video = await prisma.video.findFirst({ where: { id, deletedAt: null } });
  if (!video) throw new VideoServiceError(404, "ভিডিও পাওয়া যায়নি");
  const canEditAny = await hasPermission(actor.id, "video.edit.any");
  if (!canEditAny && (video.createdById !== actor.id || !(await hasPermission(actor.id, "video.edit.own.draft")))) throw new VideoServiceError(403, "এই ভিডিও সম্পাদনার অনুমতি নেই");
  if (!(["DRAFT", "REJECTED"] as VideoStatus[]).includes(video.status)) throw new VideoServiceError(409, "জমা বা প্রকাশিত ভিডিও সম্পাদনার আগে workflow থেকে খসড়ায় ফিরিয়ে আনুন");
  if (input.expectedRevisionNumber !== video.revisionNumber) throw new VideoServiceError(409, "ভিডিওটি অন্য কেউ পরিবর্তন করেছেন; আবার লোড করুন");
  if (input.slug && input.slug !== video.slug) throw new VideoServiceError(400, "ভিডিও URL slug স্থায়ী; প্রকাশনার পরে এটি বদলানো যাবে না");
  const refs = await validateVideoReferences(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.video.updateMany({
        where: { id, revisionNumber: video.revisionNumber, status: video.status, deletedAt: null },
        data: {
          title: input.title.normalize("NFC"), description: input.description.normalize("NFC"),
          provider: refs.parsed.provider, videoUrl: refs.parsed.canonicalUrl, externalId: refs.parsed.externalId,
          thumbnailUrl: refs.thumbnailUrl, durationSeconds: input.durationSeconds ?? null,
          categoryId: input.categoryId, authorId: input.authorId, seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null, revisionNumber: { increment: 1 },
          approvedRevisionNumber: null, publishedRevisionNumber: null, approvedById: null,
          publishedById: null, publishedAt: null, status: "DRAFT", updatedById: actor.id,
        },
      });
      if (!updated.count) throw new VideoServiceError(409, "ভিডিওটি অন্য কেউ পরিবর্তন করেছেন; আবার লোড করুন");
      await saveVideoRelations(tx, id, refs);
      await tx.videoWorkflowEvent.create({ data: { videoId: id, fromStatus: video.status, toStatus: "DRAFT", action: VideoWorkflowAction.UPDATE, actorId: actor.id, metadata: { revision: video.revisionNumber + 1 } } });
      await auditCms(tx, { actorId: actor.id, action: "video.update", resourceType: "Video", resourceId: id, metadata: { revision: video.revisionNumber + 1 } });
      return tx.video.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { throw toVideoServiceError(error) ?? error; }
}

export async function transitionVideo(id: string, action: VideoTransitionInput["action"], actor: Principal, reason?: string) {
  const video = await prisma.video.findFirst({ where: { id, deletedAt: null } });
  if (!video) throw new VideoServiceError(404, "ভিডিও পাওয়া যায়নি");
  const transitions = {
    submit: ["video.submit", "DRAFT", "SUBMITTED", VideoWorkflowAction.SUBMIT],
    resubmit: ["video.resubmit", "DRAFT", "SUBMITTED", VideoWorkflowAction.RESUBMIT],
    review: ["video.review", "SUBMITTED", "UNDER_REVIEW", VideoWorkflowAction.REVIEW],
    approve: ["video.approve", "UNDER_REVIEW", "APPROVED", VideoWorkflowAction.APPROVE],
    reject: ["video.reject", "UNDER_REVIEW", "REJECTED", VideoWorkflowAction.REJECT],
    publish: ["video.publish", "APPROVED", "PUBLISHED", VideoWorkflowAction.PUBLISH],
    archive: ["video.archive", "PUBLISHED", "ARCHIVED", VideoWorkflowAction.ARCHIVE],
  } as const;
  const [permission, fromStatus, toStatus, workflowAction] = transitions[action];
  if (!(await hasPermission(actor.id, permission))) throw new VideoServiceError(403, "এই ভিডিও workflow কাজের অনুমতি নেই");
  if ((action === "submit" || action === "resubmit") && video.createdById !== actor.id && !(await hasPermission(actor.id, "video.edit.any"))) throw new VideoServiceError(403, "শুধু নিজের ভিডিও জমা দেওয়া যাবে");
  if ((action === "approve" || action === "publish") && video.createdById === actor.id) throw new VideoServiceError(403, "নিজের তৈরি ভিডিও নিজে অনুমোদন বা প্রকাশ করা যাবে না");
  if (video.status !== fromStatus) throw new VideoServiceError(409, `এই কাজটি ${video.status} অবস্থায় করা যাবে না`);
  if (action === "publish" && video.approvedRevisionNumber !== video.revisionNumber) throw new VideoServiceError(409, "সর্বশেষ ভিডিও সংস্করণ অনুমোদিত নয়");
  if (action === "reject" && (!reason || reason.trim().length < 8)) throw new VideoServiceError(400, "সংশোধনের কারণ অন্তত ৮ অক্ষরে লিখুন");
  if ((action === "submit" || action === "resubmit") && (!video.title.trim() || !video.description.trim() || !video.externalId || !video.categoryId || !video.authorId)) throw new VideoServiceError(400, "ভিডিও জমা দেওয়ার আগে শিরোনাম, বিবরণ, লিংক, বিভাগ ও লেখক দিন");
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.video.updateMany({
        where: { id, status: fromStatus, revisionNumber: video.revisionNumber, deletedAt: null },
        data: {
          status: toStatus, updatedById: actor.id,
          ...(action === "approve" ? { approvedById: actor.id, approvedRevisionNumber: video.revisionNumber } : {}),
          ...(action === "resubmit" ? { approvedById: null, approvedRevisionNumber: null, publishedById: null, publishedRevisionNumber: null, publishedAt: null } : {}),
          ...(action === "publish" ? { publishedById: actor.id, publishedRevisionNumber: video.revisionNumber, publishedAt: new Date() } : {}),
          ...(action === "archive" ? { publishedAt: video.publishedAt } : {}),
        },
      });
      if (!result.count) throw new VideoServiceError(409, "ভিডিওটি অন্য কেউ পরিবর্তন করেছেন; আবার চেষ্টা করুন");
      await tx.videoWorkflowEvent.create({ data: { videoId: id, fromStatus, toStatus, action: workflowAction, actorId: actor.id, reason: action === "reject" ? reason?.trim() : undefined } });
      await auditCms(tx, { actorId: actor.id, action: `video.${action}`, resourceType: "Video", resourceId: id });
      if (action === "publish") await notifyVideoPublication(tx, id);
      return tx.video.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { throw toVideoServiceError(error) ?? error; }
}

export async function deleteVideo(id: string, actor: Principal) {
  const video = await prisma.video.findFirst({ where: { id, deletedAt: null } });
  if (!video) throw new VideoServiceError(404, "ভিডিও পাওয়া যায়নি");
  const canDeleteAny = await hasPermission(actor.id, "video.delete.any");
  if (!canDeleteAny && (video.createdById !== actor.id || !(await hasPermission(actor.id, "video.delete.own")))) throw new VideoServiceError(403, "এই ভিডিও অপসারণের অনুমতি নেই");
  if (!( ["DRAFT", "REJECTED", "ARCHIVED"] as VideoStatus[]).includes(video.status)) throw new VideoServiceError(409, "প্রকাশিত ভিডিও আগে সংরক্ষণাগারে নিন");
  return prisma.$transaction(async (tx) => {
    const result = await tx.video.updateMany({ where: { id, status: video.status, revisionNumber: video.revisionNumber, deletedAt: null }, data: { deletedAt: new Date(), updatedById: actor.id } });
    if (!result.count) throw new VideoServiceError(409, "ভিডিওটি অন্য কেউ পরিবর্তন করেছেন; আবার চেষ্টা করুন");
    await tx.videoWorkflowEvent.create({ data: { videoId: id, fromStatus: video.status, toStatus: video.status, action: VideoWorkflowAction.UPDATE, actorId: actor.id, metadata: { deleted: true } } });
    await auditCms(tx, { actorId: actor.id, action: "video.delete", resourceType: "Video", resourceId: id });
    return { id, deleted: true };
  });
}
