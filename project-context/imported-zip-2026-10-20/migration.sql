-- Footer CMS settings and public advertisement/newsletter submissions
ALTER TABLE "SiteSetting"
  ADD COLUMN IF NOT EXISTS "publisherName" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "editorName" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "companyLinks" JSONB,
  ADD COLUMN IF NOT EXISTS "socialLinks" JSONB,
  ADD COLUMN IF NOT EXISTS "googlePlayUrl" VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS "appStoreUrl" VARCHAR(2048);

DO $$ BEGIN
  CREATE TYPE "FooterSubmissionType" AS ENUM ('ADVERTISEMENT', 'NEWSLETTER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FooterSubmission" (
  "id" UUID NOT NULL,
  "type" "FooterSubmissionType" NOT NULL,
  "name" VARCHAR(120),
  "email" VARCHAR(254) NOT NULL,
  "phone" VARCHAR(40) NOT NULL,
  "subject" VARCHAR(180),
  "message" TEXT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  "resolvedById" UUID,
  CONSTRAINT "FooterSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FooterSubmission_type_status_createdAt_idx" ON "FooterSubmission"("type", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FooterSubmission_email_createdAt_idx" ON "FooterSubmission"("email", "createdAt");
