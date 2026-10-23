-- CreateEnum
CREATE TYPE "SubscriptionPackageCategory" AS ENUM ('NEWSPAPER', 'MAGAZINE', 'KNOWLEDGE', 'GUIDEBOOK');

-- CreateEnum
CREATE TYPE "PublicationIssueStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "packageId" UUID;

-- CreateTable
CREATE TABLE "subscription_packages" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "category" "SubscriptionPackageCategory" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "durationLabel" VARCHAR(40) NOT NULL,
    "durationMonths" INTEGER,
    "durationDays" INTEGER NOT NULL,
    "benefits" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "priceBdt" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "subscription_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_issues" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "caption" VARCHAR(120) NOT NULL,
    "issueTitle" VARCHAR(180) NOT NULL,
    "publicationMonth" SMALLINT NOT NULL,
    "publicationYear" INTEGER NOT NULL,
    "releaseDate" TIMESTAMPTZ(3),
    "subjectSummary" TEXT NOT NULL,
    "editorName" VARCHAR(120),
    "publisherName" VARCHAR(120),
    "coverImageUrl" VARCHAR(1000),
    "status" "PublicationIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "publication_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_packages_code_key" ON "subscription_packages"("code");

-- CreateIndex
CREATE INDEX "subscription_packages_category_isActive_sortOrder_idx" ON "subscription_packages"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "publication_issues_packageId_status_publicationYear_publica_idx" ON "publication_issues"("packageId", "status", "publicationYear", "publicationMonth");

-- CreateIndex
CREATE INDEX "subscriptions_packageId_status_createdAt_idx" ON "subscriptions"("packageId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_packages" ADD CONSTRAINT "subscription_packages_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_issues" ADD CONSTRAINT "publication_issues_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_issues" ADD CONSTRAINT "publication_issues_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
