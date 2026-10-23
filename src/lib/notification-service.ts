import "server-only";
import { NotificationPriority, NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type NotificationTemplateKey = "article.breaking" | "article.topic" | "video.published" | "system.message";
export type NotificationText = { title: string; message: string };
export type NotificationPayload = Record<string, string | number | boolean | null>;

type Recipient = { userId: string; inApp: boolean; email: boolean; topic?: string };

export function renderNotification(templateKey: string, payload: Prisma.JsonValue): NotificationText {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, Prisma.JsonValue> : {};
  const headline = typeof data.headline === "string" ? data.headline : "";
  switch (templateKey) {
    case "article.breaking": return { title: "নতুন ব্রেকিং নিউজ", message: headline ? `ব্রেকিং নিউজ: ${headline}` : "একটি নতুন ব্রেকিং নিউজ প্রকাশিত হয়েছে।" };
    case "article.topic": {
      const topic = typeof data.topic === "string" ? data.topic : "আপনার অনুসরণ করা বিষয়ে";
      return { title: "আপনার অনুসরণ করা বিষয়ে নতুন সংবাদ", message: `${topic} বিষয়ে নতুন সংবাদ প্রকাশিত হয়েছে${headline ? `: ${headline}` : "।"}` };
    }
    case "video.published": return { title: "নতুন ভিডিও প্রকাশিত", message: headline ? `নতুন ভিডিও: ${headline}` : "আপনার জন্য নতুন ভিডিও প্রকাশিত হয়েছে।" };
    case "system.message": return {
      title: typeof data.title === "string" ? data.title : "সিস্টেম বিজ্ঞপ্তি",
      message: typeof data.message === "string" ? data.message : "আপনার অ্যাকাউন্টে একটি নতুন বিজ্ঞপ্তি আছে।",
    };
    default: return { title: "নতুন বিজ্ঞপ্তি", message: "আপনার জন্য একটি নতুন বিজ্ঞপ্তি আছে।" };
  }
}

function asInputJson(value: NotificationPayload): Prisma.InputJsonObject {
  return value;
}

async function persistNotifications(
  tx: Prisma.TransactionClient,
  input: { type: NotificationType; priority: NotificationPriority; templateKey: NotificationTemplateKey; payload: NotificationPayload; href: string; dedupeKey: string; recipients: Recipient[] },
) {
  const uniqueRecipients = new Map<string, Recipient>();
  for (const recipient of input.recipients) {
    const previous = uniqueRecipients.get(recipient.userId);
    if (!previous) uniqueRecipients.set(recipient.userId, recipient);
    else uniqueRecipients.set(recipient.userId, {
      userId: recipient.userId,
      inApp: previous.inApp || recipient.inApp,
      email: previous.email || recipient.email,
      topic: previous.topic ?? recipient.topic,
    });
  }
  const recipients = [...uniqueRecipients.values()];
  const notificationRows = recipients.filter((row) => row.inApp).map((row) => ({
    userId: row.userId,
    type: input.type,
    priority: input.priority,
    templateKey: input.templateKey,
    payload: asInputJson(row.topic ? { ...input.payload, topic: row.topic } : input.payload),
    href: input.href,
    dedupeKey: input.dedupeKey,
  }));
  const emailOutboxEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
  const emailRows = emailOutboxEnabled ? recipients.filter((row) => row.email).map((row) => ({
    userId: row.userId,
    dedupeKey: input.dedupeKey,
    templateKey: input.templateKey,
    payload: asInputJson(row.topic ? { ...input.payload, topic: row.topic } : input.payload),
    locale: "bn-BD",
  })) : [];
  const [notifications, emails] = await Promise.all([
    notificationRows.length ? tx.notification.createMany({ data: notificationRows, skipDuplicates: true }) : Promise.resolve({ count: 0 }),
    emailRows.length ? tx.emailOutbox.createMany({ data: emailRows, skipDuplicates: true }) : Promise.resolve({ count: 0 }),
  ]);
  return { notificationsCreated: notifications.count, emailsQueued: emails.count };
}

const publishedArticleSelect = {
  id: true, slug: true, title: true, excerpt: true, revisionNumber: true, isBreaking: true,
  categories: { select: { category: { select: { id: true, name: true } } } },
  tags: { select: { tag: { select: { id: true, name: true } } }, orderBy: { tag: { name: "asc" as const } } },
} satisfies Prisma.ArticleSelect;

export async function notifyArticlePublication(tx: Prisma.TransactionClient, articleId: string, options: { topics?: boolean; breaking?: boolean } = { topics: true, breaking: true }) {
  const article = await tx.article.findFirst({ where: { id: articleId, status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null }, select: publishedArticleSelect });
  if (!article) return { notificationsCreated: 0, emailsQueued: 0 };
  const publishedRevision = article.revisionNumber;
  const headline = article.title.slice(0, 240);
  const href = `/news/${article.slug}`;
  let totals = { notificationsCreated: 0, emailsQueued: 0 };

  if (options.breaking && article.isBreaking) {
    const users = await tx.user.findMany({
      where: { OR: [
        { preferences: { is: null } },
        { preferences: { is: { inAppBreakingEnabled: true } } },
        { preferences: { is: { emailBreakingEnabled: true } } },
      ] },
      select: { id: true, preferences: { select: { inAppBreakingEnabled: true, emailBreakingEnabled: true } } },
    });
    const result = await persistNotifications(tx, {
      type: NotificationType.BREAKING_NEWS, priority: NotificationPriority.URGENT, templateKey: "article.breaking",
      payload: { headline, articleId: article.id }, href,
      dedupeKey: `breaking:article:${article.id}:revision:${publishedRevision}`,
      recipients: users.map((user) => ({ userId: user.id, inApp: user.preferences?.inAppBreakingEnabled ?? true, email: user.preferences?.emailBreakingEnabled ?? false })),
    });
    totals = { notificationsCreated: totals.notificationsCreated + result.notificationsCreated, emailsQueued: totals.emailsQueued + result.emailsQueued };
  }

  if (options.topics) {
    const topicIds = article.tags.map(({ tag }) => tag.id);
    const categoryIds = article.categories.map(({ category }) => category.id);
    const [topicFollowers, categoryFollowers] = await Promise.all([
      topicIds.length ? tx.followedTopic.findMany({ where: { tagId: { in: topicIds } }, select: { topic: { select: { name: true } }, user: { select: { id: true, preferences: { select: { inAppTopicEnabled: true, emailTopicEnabled: true, inAppBreakingEnabled: true, emailBreakingEnabled: true } } } } } }) : Promise.resolve([]),
      categoryIds.length ? tx.followedCategory.findMany({ where: { categoryId: { in: categoryIds } }, select: { category: { select: { name: true } }, user: { select: { id: true, preferences: { select: { inAppTopicEnabled: true, emailTopicEnabled: true, inAppBreakingEnabled: true, emailBreakingEnabled: true } } } } } }) : Promise.resolve([]),
    ]);
    const result = await persistNotifications(tx, {
      type: NotificationType.TOPIC, priority: NotificationPriority.NORMAL, templateKey: "article.topic",
      payload: { headline, articleId: article.id }, href,
      dedupeKey: `topic:article:${article.id}:revision:${publishedRevision}`,
      recipients: [
        ...topicFollowers.map(({ topic, user }) => ({
          userId: user.id,
          inApp: (user.preferences?.inAppTopicEnabled ?? true) && !(article.isBreaking && (user.preferences?.inAppBreakingEnabled ?? true)),
          email: (user.preferences?.emailTopicEnabled ?? false) && !(article.isBreaking && (user.preferences?.emailBreakingEnabled ?? false)),
          topic: topic.name,
        })),
        ...categoryFollowers.map(({ category, user }) => ({
          userId: user.id,
          inApp: (user.preferences?.inAppTopicEnabled ?? true) && !(article.isBreaking && (user.preferences?.inAppBreakingEnabled ?? true)),
          email: (user.preferences?.emailTopicEnabled ?? false) && !(article.isBreaking && (user.preferences?.emailBreakingEnabled ?? false)),
          topic: category.name,
        })),
      ],
    });
    totals = { notificationsCreated: totals.notificationsCreated + result.notificationsCreated, emailsQueued: totals.emailsQueued + result.emailsQueued };
  }
  return totals;
}

export async function notifyBreakingFlagEnabled(tx: Prisma.TransactionClient, articleId: string) {
  return notifyArticlePublication(tx, articleId, { topics: false, breaking: true });
}

export async function notifyVideoPublication(tx: Prisma.TransactionClient, videoId: string) {
  const video = await tx.video.findFirst({ where: { id: videoId, status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null }, select: { id: true, slug: true, title: true, revisionNumber: true } });
  if (!video) return { notificationsCreated: 0, emailsQueued: 0 };
  const users = await tx.user.findMany({
    where: { preferences: { is: { OR: [{ inAppVideoEnabled: true }, { emailVideoEnabled: true }] } } },
    select: { id: true, preferences: { select: { inAppVideoEnabled: true, emailVideoEnabled: true } } },
  });
  return persistNotifications(tx, {
    type: NotificationType.VIDEO, priority: NotificationPriority.NORMAL, templateKey: "video.published",
    payload: { headline: video.title.slice(0, 240), videoId: video.id }, href: `/video/${video.slug}`,
    dedupeKey: `video:${video.id}:revision:${video.revisionNumber}`,
    recipients: users.map((user) => ({ userId: user.id, inApp: user.preferences?.inAppVideoEnabled ?? false, email: user.preferences?.emailVideoEnabled ?? false })),
  });
}

export async function createSystemNotification(
  tx: Prisma.TransactionClient,
  input: { userId: string; dedupeKey: string; title: string; message: string; href?: string; priority?: NotificationPriority },
) {
  const title = input.title.normalize("NFC").trim().slice(0, 180);
  const message = input.message.normalize("NFC").trim().slice(0, 2000);
  const dedupeKey = input.dedupeKey.trim().slice(0, 250);
  if (!title || !message || !dedupeKey) return { notificationsCreated: 0, emailsQueued: 0 };
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, preferences: { select: { inAppSystemEnabled: true, emailSystemEnabled: true } } } });
  if (!user) return { notificationsCreated: 0, emailsQueued: 0 };
  return persistNotifications(tx, {
    type: NotificationType.SYSTEM, priority: input.priority ?? NotificationPriority.NORMAL, templateKey: "system.message",
    payload: { title, message }, href: input.href?.startsWith("/") && !input.href.startsWith("//") ? input.href.slice(0, 500) : "/dashboard",
    dedupeKey: `system:${dedupeKey}`,
    recipients: [{ userId: user.id, inApp: user.preferences?.inAppSystemEnabled ?? true, email: user.preferences?.emailSystemEnabled ?? false }],
  });
}

export async function getNotificationInbox(userId: string, input: { page: number; unreadOnly: boolean }) {
  const page = Math.min(Math.max(input.page, 1), 1000);
  const where = { userId, ...(input.unreadOnly ? { readAt: null } : {}) };
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      skip: (page - 1) * 30,
      select: { id: true, type: true, priority: true, templateKey: true, payload: true, href: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    items: rows.map((row) => ({ ...row, ...renderNotification(row.templateKey, row.payload) })),
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / 30)),
    unreadCount,
  };
}

export async function setNotificationRead(userId: string, notificationId: string, read: boolean) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: read ? new Date() : null },
  });
  return result.count > 0;
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return result.count;
}
