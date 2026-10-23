-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'EDIT_REJECTED', 'RESUBMIT', 'SCHEDULE', 'CANCEL_SCHEDULE', 'PUBLISH', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'QUARANTINED', 'VERIFIED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MediaUsageRole" AS ENUM ('FEATURED_IMAGE', 'INLINE');

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'R2',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "caption" TEXT,
    "credit" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "excerpt" TEXT,
    "body" JSONB NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" VARCHAR(170),
    "canonicalUrl" TEXT,
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "breakingUntil" TIMESTAMPTZ(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMPTZ(3),
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "trendingUntil" TIMESTAMPTZ(3),
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "approvedById" UUID,
    "publishedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleRevision" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "excerpt" TEXT,
    "body" JSONB NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleWorkflowEvent" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "fromStatus" "ArticleStatus",
    "toStatus" "ArticleStatus" NOT NULL,
    "action" "WorkflowAction" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCategory" (
    "articleId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArticleCategory_pkey" PRIMARY KEY ("articleId","categoryId")
);

-- CreateTable
CREATE TABLE "ArticleAuthor" (
    "articleId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleAuthor_pkey" PRIMARY KEY ("articleId","authorId")
);

-- CreateTable
CREATE TABLE "ArticleTag" (
    "articleId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "ArticleTag_pkey" PRIMARY KEY ("articleId","tagId")
);

-- CreateTable
CREATE TABLE "ArticleMedia" (
    "articleId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "role" "MediaUsageRole" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "altOverride" TEXT,

    CONSTRAINT "ArticleMedia_pkey" PRIMARY KEY ("articleId","mediaId","role")
);

-- CreateTable
CREATE TABLE "RelatedArticle" (
    "articleId" UUID NOT NULL,
    "relatedArticleId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RelatedArticle_pkey" PRIMARY KEY ("articleId","relatedArticleId")
);

-- CreateTable
CREATE TABLE "ArticleRelatedVideo" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRelatedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSlugRedirect" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleSlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "Category_isActive_deletedAt_sortOrder_idx" ON "Category"("isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_normalizedName_key" ON "Tag"("normalizedName");

-- CreateIndex
CREATE INDEX "Tag_deletedAt_name_idx" ON "Tag"("deletedAt", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Author_userId_key" ON "Author"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Author_slug_key" ON "Author"("slug");

-- CreateIndex
CREATE INDEX "Author_isActive_deletedAt_name_idx" ON "Author"("isActive", "deletedAt", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Media_objectKey_key" ON "Media"("objectKey");

-- CreateIndex
CREATE INDEX "Media_status_visibility_createdAt_idx" ON "Media"("status", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Media_uploadedById_createdAt_idx" ON "Media"("uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_id_idx" ON "Article"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "Article_createdById_status_updatedAt_idx" ON "Article"("createdById", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Article_status_scheduledAt_idx" ON "Article"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Article_isBreaking_breakingUntil_publishedAt_idx" ON "Article"("isBreaking", "breakingUntil", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_isFeatured_featuredUntil_publishedAt_idx" ON "Article"("isFeatured", "featuredUntil", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_isTrending_trendingUntil_publishedAt_idx" ON "Article"("isTrending", "trendingUntil", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_deletedAt_updatedAt_idx" ON "Article"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ArticleRevision_articleId_createdAt_idx" ON "ArticleRevision"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRevision_articleId_version_key" ON "ArticleRevision"("articleId", "version");

-- CreateIndex
CREATE INDEX "ArticleWorkflowEvent_articleId_createdAt_idx" ON "ArticleWorkflowEvent"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleWorkflowEvent_actorId_createdAt_idx" ON "ArticleWorkflowEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleCategory_categoryId_articleId_idx" ON "ArticleCategory"("categoryId", "articleId");

-- CreateIndex
CREATE INDEX "ArticleAuthor_authorId_articleId_idx" ON "ArticleAuthor"("authorId", "articleId");

-- CreateIndex
CREATE INDEX "ArticleTag_tagId_articleId_idx" ON "ArticleTag"("tagId", "articleId");

-- CreateIndex
CREATE INDEX "ArticleMedia_mediaId_role_idx" ON "ArticleMedia"("mediaId", "role");

-- CreateIndex
CREATE INDEX "RelatedArticle_relatedArticleId_articleId_idx" ON "RelatedArticle"("relatedArticleId", "articleId");

-- CreateIndex
CREATE INDEX "ArticleRelatedVideo_articleId_position_idx" ON "ArticleRelatedVideo"("articleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRelatedVideo_articleId_provider_externalId_key" ON "ArticleRelatedVideo"("articleId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSlugRedirect_oldSlug_key" ON "ArticleSlugRedirect"("oldSlug");

-- CreateIndex
CREATE INDEX "ArticleSlugRedirect_articleId_idx" ON "ArticleSlugRedirect"("articleId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_createdAt_idx" ON "AuditLog"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleWorkflowEvent" ADD CONSTRAINT "ArticleWorkflowEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleWorkflowEvent" ADD CONSTRAINT "ArticleWorkflowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCategory" ADD CONSTRAINT "ArticleCategory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCategory" ADD CONSTRAINT "ArticleCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAuthor" ADD CONSTRAINT "ArticleAuthor_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAuthor" ADD CONSTRAINT "ArticleAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMedia" ADD CONSTRAINT "ArticleMedia_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMedia" ADD CONSTRAINT "ArticleMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedArticle" ADD CONSTRAINT "RelatedArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedArticle" ADD CONSTRAINT "RelatedArticle_relatedArticleId_fkey" FOREIGN KEY ("relatedArticleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRelatedVideo" ADD CONSTRAINT "ArticleRelatedVideo_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSlugRedirect" ADD CONSTRAINT "ArticleSlugRedirect_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Editorial invariants not expressible in the Prisma schema.
CREATE UNIQUE INDEX "ArticleCategory_one_primary_per_article_key"
  ON "ArticleCategory" ("articleId") WHERE "isPrimary";
CREATE UNIQUE INDEX "ArticleAuthor_one_primary_per_article_key"
  ON "ArticleAuthor" ("articleId") WHERE "isPrimary";
ALTER TABLE "RelatedArticle"
  ADD CONSTRAINT "RelatedArticle_no_self_reference_check" CHECK ("articleId" <> "relatedArticleId");
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_no_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "Article"
  ADD CONSTRAINT "Article_slug_ascii_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "Article_revision_positive_check" CHECK ("revisionNumber" > 0),
  ADD CONSTRAINT "Article_published_at_status_check" CHECK (
    (("status" IN ('PUBLISHED', 'ARCHIVED')) AND "publishedAt" IS NOT NULL)
    OR (("status" NOT IN ('PUBLISHED', 'ARCHIVED')) AND "publishedAt" IS NULL)
  ),
  ADD CONSTRAINT "Article_approved_at_publish_check" CHECK (
    "status" NOT IN ('APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') OR "approvedById" IS NOT NULL
  ),
  ADD CONSTRAINT "Article_schedule_status_check" CHECK (
    ("status" = 'SCHEDULED' AND "scheduledAt" IS NOT NULL)
    OR ("status" <> 'SCHEDULED' AND "scheduledAt" IS NULL)
  ),
  ADD CONSTRAINT "Article_breaking_expiry_check" CHECK ("isBreaking" = ("breakingUntil" IS NOT NULL)),
  ADD CONSTRAINT "Article_featured_expiry_check" CHECK ("isFeatured" = ("featuredUntil" IS NOT NULL)),
  ADD CONSTRAINT "Article_trending_expiry_check" CHECK ("isTrending" = ("trendingUntil" IS NOT NULL));
ALTER TABLE "Media"
  ADD CONSTRAINT "Media_size_positive_check" CHECK ("sizeBytes" > 0),
  ADD CONSTRAINT "Media_dimensions_positive_check" CHECK (
    ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)
  );
