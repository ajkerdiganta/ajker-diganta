-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('YOUTUBE', 'CLOUDFLARE_STREAM');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VideoWorkflowAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'RESUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'PUBLISH', 'ARCHIVE');

-- CreateTable
CREATE TABLE "Video" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "provider" "VideoProvider" NOT NULL DEFAULT 'YOUTUBE',
    "videoUrl" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" VARCHAR(170),
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "approvedRevisionNumber" INTEGER,
    "publishedRevisionNumber" INTEGER,
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "categoryId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "approvedById" UUID,
    "publishedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_tags" (
    "videoId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "video_tags_pkey" PRIMARY KEY ("videoId","tagId")
);

-- CreateTable
CREATE TABLE "video_related_articles" (
    "videoId" UUID NOT NULL,
    "relatedArticleId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "video_related_articles_pkey" PRIMARY KEY ("videoId","relatedArticleId")
);

-- CreateTable
CREATE TABLE "VideoWorkflowEvent" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "fromStatus" "VideoStatus",
    "toStatus" "VideoStatus" NOT NULL,
    "action" "VideoWorkflowAction" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_daily_metrics" (
    "videoId" UUID NOT NULL,
    "metricDate" DATE NOT NULL,
    "views" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "video_daily_metrics_pkey" PRIMARY KEY ("videoId","metricDate")
);

-- CreateTable
CREATE TABLE "video_history" (
    "userId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "lastViewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "video_history_pkey" PRIMARY KEY ("userId","videoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_slug_key" ON "Video"("slug");

-- CreateIndex
CREATE INDEX "Video_status_publishedAt_id_idx" ON "Video"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "Video_categoryId_status_publishedAt_idx" ON "Video"("categoryId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Video_authorId_status_publishedAt_idx" ON "Video"("authorId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Video_createdById_status_updatedAt_idx" ON "Video"("createdById", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Video_deletedAt_updatedAt_idx" ON "Video"("deletedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Video_provider_externalId_key" ON "Video"("provider", "externalId");

-- CreateIndex
CREATE INDEX "video_tags_tagId_videoId_idx" ON "video_tags"("tagId", "videoId");

-- CreateIndex
CREATE INDEX "video_related_articles_relatedArticleId_videoId_idx" ON "video_related_articles"("relatedArticleId", "videoId");

-- CreateIndex
CREATE INDEX "VideoWorkflowEvent_videoId_createdAt_idx" ON "VideoWorkflowEvent"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoWorkflowEvent_actorId_createdAt_idx" ON "VideoWorkflowEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "video_daily_metrics_metricDate_views_idx" ON "video_daily_metrics"("metricDate", "views");

-- CreateIndex
CREATE INDEX "video_history_userId_lastViewedAt_idx" ON "video_history"("userId", "lastViewedAt");

-- CreateIndex
CREATE INDEX "video_history_videoId_lastViewedAt_idx" ON "video_history"("videoId", "lastViewedAt");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_related_articles" ADD CONSTRAINT "video_related_articles_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_related_articles" ADD CONSTRAINT "video_related_articles_relatedArticleId_fkey" FOREIGN KEY ("relatedArticleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWorkflowEvent" ADD CONSTRAINT "VideoWorkflowEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWorkflowEvent" ADD CONSTRAINT "VideoWorkflowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_daily_metrics" ADD CONSTRAINT "video_daily_metrics_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_history" ADD CONSTRAINT "video_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_history" ADD CONSTRAINT "video_history_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep duration and counters non-negative even if a future writer bypasses application validation.
ALTER TABLE "Video" ADD CONSTRAINT "Video_durationSeconds_nonnegative_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0);
ALTER TABLE "Video" ADD CONSTRAINT "Video_revisionNumber_positive_check" CHECK ("revisionNumber" > 0);
ALTER TABLE "Video" ADD CONSTRAINT "Video_viewCount_nonnegative_check" CHECK ("viewCount" >= 0);
ALTER TABLE "VideoWorkflowEvent" ADD CONSTRAINT "VideoWorkflowEvent_reason_length_check" CHECK ("reason" IS NULL OR char_length("reason") <= 1000);
ALTER TABLE "video_history" ADD CONSTRAINT "video_history_viewCount_positive_check" CHECK ("viewCount" > 0);
