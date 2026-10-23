-- CreateEnum
CREATE TYPE "FooterSubmissionType" AS ENUM ('ADVERTISEMENT', 'NEWSLETTER');

-- CreateEnum
CREATE TYPE "SiteSubmissionStatus" AS ENUM ('RECEIVED', 'RESOLVED');

-- CreateTable
CREATE TABLE "site_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "metaTitle" VARCHAR(120),
    "metaDescription" VARCHAR(170),
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'global',
    "officeAddress" TEXT,
    "officePhone" VARCHAR(40),
    "contactRecipientEmail" VARCHAR(254),
    "publisherName" VARCHAR(180),
    "editorName" VARCHAR(180),
    "companyLinks" JSONB,
    "socialLinks" JSONB,
    "googlePlayUrl" VARCHAR(2048),
    "appStoreUrl" VARCHAR(2048),
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(180) NOT NULL,
    "message" TEXT NOT NULL,
    "phone" VARCHAR(40),
    "status" "SiteSubmissionStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_submissions" (
    "id" UUID NOT NULL,
    "type" "FooterSubmissionType" NOT NULL,
    "name" VARCHAR(120),
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "subject" VARCHAR(180),
    "message" TEXT NOT NULL,
    "status" "SiteSubmissionStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,

    CONSTRAINT "footer_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_pages_slug_key" ON "site_pages"("slug");

-- CreateIndex
CREATE INDEX "site_pages_updatedAt_idx" ON "site_pages"("updatedAt");

-- CreateIndex
CREATE INDEX "contact_submissions_status_createdAt_idx" ON "contact_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contact_submissions_email_createdAt_idx" ON "contact_submissions"("email", "createdAt");

-- CreateIndex
CREATE INDEX "footer_submissions_type_status_createdAt_idx" ON "footer_submissions"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "footer_submissions_email_createdAt_idx" ON "footer_submissions"("email", "createdAt");

-- AddForeignKey
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footer_submissions" ADD CONSTRAINT "footer_submissions_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
