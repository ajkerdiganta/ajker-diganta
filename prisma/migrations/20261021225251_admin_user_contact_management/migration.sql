-- AlterTable
ALTER TABLE "user" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "phone" VARCHAR(40);

-- CreateIndex
CREATE INDEX "user_deletedAt_status_createdAt_idx" ON "user"("deletedAt", "status", "createdAt");
