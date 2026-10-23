-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BREAKING_NEWS', 'TOPIC', 'VIDEO', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- Add opt-in/out controls to existing reader preferences. Email remains off by default.
ALTER TABLE "user_preferences"
  ADD COLUMN "emailBreakingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailSystemEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailTopicEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVideoEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "inAppBreakingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inAppSystemEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inAppTopicEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inAppVideoEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "templateKey" VARCHAR(80) NOT NULL,
  "payload" JSONB NOT NULL,
  "href" VARCHAR(500),
  "dedupeKey" VARCHAR(250) NOT NULL,
  "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "dedupeKey" VARCHAR(250) NOT NULL,
  "templateKey" VARCHAR(80) NOT NULL,
  "payload" JSONB NOT NULL,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'bn-BD',
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_outbox_attempts_nonnegative" CHECK ("attempts" >= 0)
);

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt" DESC);
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);
CREATE INDEX "notifications_type_createdAt_idx" ON "notifications"("type", "createdAt");
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");
CREATE INDEX "email_outbox_status_availableAt_createdAt_idx" ON "email_outbox"("status", "availableAt", "createdAt");
CREATE INDEX "email_outbox_userId_createdAt_idx" ON "email_outbox"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "email_outbox_userId_dedupeKey_key" ON "email_outbox"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
