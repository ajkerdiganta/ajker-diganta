import "server-only";
import { prisma } from "@/lib/prisma";
import { articleCardSelect } from "@/lib/public-news";
import { hasActiveSubscription } from "@/lib/subscription-service";

const publicArticleWhere = {
  status: "PUBLISHED" as const,
  publishedAt: { not: null },
  publishedRevisionNumber: { not: null },
  deletedAt: null,
};

const publicVideoWhere = {
  status: "PUBLISHED" as const,
  publishedAt: { not: null },
  publishedRevisionNumber: { not: null },
  deletedAt: null,
};

export async function getPersonalizationDashboard(userId: string) {
  const [user, saved, favourites, topics, categories, history, videoHistory, availableTopics, availableCategories, preferences, savedCount, favouriteCount, topicCount, categoryCount, historyCount, videoHistoryCount, unreadNotificationCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, image: true } }),
    prisma.savedArticle.findMany({ where: { userId, article: publicArticleWhere }, orderBy: { createdAt: "desc" }, take: 12, select: { createdAt: true, article: { select: articleCardSelect } } }),
    prisma.favouriteArticle.findMany({ where: { userId, article: publicArticleWhere }, orderBy: { createdAt: "desc" }, take: 12, select: { createdAt: true, article: { select: articleCardSelect } } }),
    prisma.followedTopic.findMany({ where: { userId, topic: { deletedAt: null } }, orderBy: { createdAt: "desc" }, take: 100, select: { createdAt: true, topic: { select: { id: true, name: true, slug: true } } } }),
    prisma.followedCategory.findMany({ where: { userId, category: { isActive: true, deletedAt: null } }, orderBy: { createdAt: "desc" }, take: 100, select: { createdAt: true, category: { select: { id: true, name: true, slug: true, description: true } } } }),
    prisma.readingHistory.findMany({ where: { userId, article: publicArticleWhere }, orderBy: { lastReadAt: "desc" }, take: 12, select: { lastReadAt: true, readCount: true, article: { select: articleCardSelect } } }),
    prisma.videoHistory.findMany({ where: { userId, video: publicVideoWhere }, orderBy: { lastViewedAt: "desc" }, take: 12, select: { lastViewedAt: true, viewCount: true, video: { select: { id: true, slug: true, title: true, description: true, thumbnailUrl: true, provider: true, externalId: true, durationSeconds: true, publishedAt: true, category: { select: { name: true, slug: true } }, author: { select: { name: true, slug: true } } } } } }),
    prisma.tag.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, slug: true } }),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 100, select: { id: true, name: true, slug: true, description: true } }),
    prisma.userPreference.upsert({ where: { userId }, create: { userId }, update: {}, select: { fontScale: true, lowBandwidthMode: true, readingHistoryEnabled: true, inAppBreakingEnabled: true, emailBreakingEnabled: true, inAppTopicEnabled: true, emailTopicEnabled: true, inAppVideoEnabled: true, emailVideoEnabled: true, inAppSystemEnabled: true, emailSystemEnabled: true } }),
    prisma.savedArticle.count({ where: { userId, article: publicArticleWhere } }),
    prisma.favouriteArticle.count({ where: { userId, article: publicArticleWhere } }),
    prisma.followedTopic.count({ where: { userId, topic: { deletedAt: null } } }),
    prisma.followedCategory.count({ where: { userId, category: { isActive: true, deletedAt: null } } }),
    prisma.readingHistory.count({ where: { userId, article: publicArticleWhere } }),
    prisma.videoHistory.count({ where: { userId, video: publicVideoWhere } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    user,
    savedArticles: saved,
    favouriteArticles: favourites,
    followedTopics: topics,
    followedCategories: categories,
    readingHistory: history,
    videoHistory,
    availableTopics,
    availableCategories,
    preferences,
    counts: {
      saved: savedCount,
      favourites: favouriteCount,
      topics: topicCount,
      categories: categoryCount,
      history: historyCount,
      videoHistory: videoHistoryCount,
      unreadNotifications: unreadNotificationCount,
    },
  };
}

export async function getArticlePersonalizationState(userId: string, articleId: string) {
  const [active, saved, favourite, preferences] = await Promise.all([
    hasActiveSubscription(userId),
    prisma.savedArticle.findUnique({ where: { userId_articleId: { userId, articleId } }, select: { userId: true } }),
    prisma.favouriteArticle.findUnique({ where: { userId_articleId: { userId, articleId } }, select: { userId: true } }),
    prisma.userPreference.findUnique({ where: { userId }, select: { fontScale: true, lowBandwidthMode: true } }),
  ]);
  return { saved: active && Boolean(saved), favourite: active && Boolean(favourite), fontScale: preferences?.fontScale ?? "comfortable", lowBandwidthMode: preferences?.lowBandwidthMode ?? false };
}

export async function setArticleCollection(userId: string, articleId: string, collection: "saved" | "favourite", enabled: boolean) {
  const article = await prisma.article.findFirst({ where: { id: articleId, ...publicArticleWhere }, select: { id: true } });
  if (!article) return false;
  if (collection === "saved") {
    if (enabled) await prisma.savedArticle.upsert({ where: { userId_articleId: { userId, articleId } }, create: { userId, articleId }, update: {} });
    else await prisma.savedArticle.deleteMany({ where: { userId, articleId } });
  } else {
    if (enabled) await prisma.favouriteArticle.upsert({ where: { userId_articleId: { userId, articleId } }, create: { userId, articleId }, update: {} });
    else await prisma.favouriteArticle.deleteMany({ where: { userId, articleId } });
  }
  return true;
}

export async function setTopicFollow(userId: string, topicId: string, enabled: boolean) {
  const topic = await prisma.tag.findFirst({ where: { id: topicId, deletedAt: null }, select: { id: true } });
  if (!topic) return false;
  if (enabled) await prisma.followedTopic.upsert({ where: { userId_tagId: { userId, tagId: topicId } }, create: { userId, tagId: topicId }, update: {} });
  else await prisma.followedTopic.deleteMany({ where: { userId, tagId: topicId } });
  return true;
}

export async function setCategoryFollow(userId: string, categoryId: string, enabled: boolean) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, isActive: true, deletedAt: null }, select: { id: true } });
  if (!category) return false;
  if (enabled) await prisma.followedCategory.upsert({ where: { userId_categoryId: { userId, categoryId } }, create: { userId, categoryId }, update: {} });
  else await prisma.followedCategory.deleteMany({ where: { userId, categoryId } });
  return true;
}

export async function clearUserReadingHistory(userId: string) {
  return prisma.readingHistory.deleteMany({ where: { userId } });
}

export async function updateUserPreferences(userId: string, input: {
  fontScale?: "comfortable" | "large";
  lowBandwidthMode?: boolean;
  readingHistoryEnabled?: boolean;
  inAppBreakingEnabled?: boolean; emailBreakingEnabled?: boolean;
  inAppTopicEnabled?: boolean; emailTopicEnabled?: boolean;
  inAppVideoEnabled?: boolean; emailVideoEnabled?: boolean;
  inAppSystemEnabled?: boolean; emailSystemEnabled?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const preference = await tx.userPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
      select: { fontScale: true, lowBandwidthMode: true, readingHistoryEnabled: true, inAppBreakingEnabled: true, emailBreakingEnabled: true, inAppTopicEnabled: true, emailTopicEnabled: true, inAppVideoEnabled: true, emailVideoEnabled: true, inAppSystemEnabled: true, emailSystemEnabled: true },
    });
    if (input.readingHistoryEnabled === false) {
      await tx.readingHistory.deleteMany({ where: { userId } });
      await tx.videoHistory.deleteMany({ where: { userId } });
    }
    return preference;
  });
}

export async function updateUserProfile(userId: string, name: string) {
  return prisma.user.update({ where: { id: userId }, data: { name }, select: { id: true, name: true, email: true, image: true } });
}

export async function recordUserArticleRead(userId: string, slug: string) {
  const [article, preference] = await Promise.all([
    prisma.article.findFirst({ where: { ...publicArticleWhere, slug }, select: { id: true } }),
    prisma.userPreference.findUnique({ where: { userId }, select: { readingHistoryEnabled: true } }),
  ]);
  if (!article || preference?.readingHistoryEnabled === false) return false;
  await prisma.readingHistory.upsert({
    where: { userId_articleId: { userId, articleId: article.id } },
    create: { userId, articleId: article.id, lastReadAt: new Date(), readCount: 1 },
    update: { lastReadAt: new Date(), readCount: { increment: 1 } },
  });
  return true;
}

export async function recordUserVideoRead(userId: string, slug: string) {
  const [video, preference] = await Promise.all([
    prisma.video.findFirst({ where: { ...publicVideoWhere, slug }, select: { id: true } }),
    prisma.userPreference.findUnique({ where: { userId }, select: { readingHistoryEnabled: true } }),
  ]);
  if (!video || preference?.readingHistoryEnabled === false) return false;
  await prisma.videoHistory.upsert({
    where: { userId_videoId: { userId, videoId: video.id } },
    create: { userId, videoId: video.id, lastViewedAt: new Date(), viewCount: 1 },
    update: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
  });
  return true;
}
