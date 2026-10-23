-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "approvedRevisionNumber" INTEGER,
ADD COLUMN     "publishedRevisionNumber" INTEGER;

-- CreateIndex
CREATE INDEX "Article_status_approvedRevisionNumber_scheduledAt_idx" ON "Article"("status", "approvedRevisionNumber", "scheduledAt");

-- Backfill safely before adding checks; Phase 1 had no newsroom rows.
UPDATE "Article" SET "approvedRevisionNumber" = "revisionNumber"
  WHERE "status" IN ('APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
UPDATE "Article" SET "publishedRevisionNumber" = "revisionNumber"
  WHERE "status" IN ('PUBLISHED', 'ARCHIVED');
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_slug_ascii_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_slug_ascii_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Author"
  ADD CONSTRAINT "Author_slug_ascii_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Article"
  ADD CONSTRAINT "Article_approved_revision_check" CHECK (
    ("status" IN ('APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') AND "approvedRevisionNumber" = "revisionNumber")
    OR ("status" NOT IN ('APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') AND "approvedRevisionNumber" IS NULL)
  ),
  ADD CONSTRAINT "Article_published_revision_check" CHECK (
    (("status" IN ('PUBLISHED', 'ARCHIVED')) AND "publishedRevisionNumber" = "revisionNumber")
    OR (("status" NOT IN ('PUBLISHED', 'ARCHIVED')) AND "publishedRevisionNumber" IS NULL)
  );
