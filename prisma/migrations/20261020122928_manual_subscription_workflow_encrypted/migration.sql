-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('NAGAD', 'BKASH', 'ROCKET');

-- CreateEnum
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_settings" (
    "method" "PaymentMethod" NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    "accountNumber" VARCHAR(40) NOT NULL DEFAULT '',
    "transferType" VARCHAR(40) NOT NULL,
    "instructions" VARCHAR(2000) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_gateway_settings_pkey" PRIMARY KEY ("method")
);

-- CreateTable
CREATE TABLE "payment_submissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "customerNameEncrypted" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "emailEncrypted" TEXT NOT NULL,
    "addressEncrypted" TEXT NOT NULL,
    "transactionIdEncrypted" TEXT NOT NULL,
    "transactionIdHash" CHAR(64) NOT NULL,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "verifiedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_expiresAt_idx" ON "subscriptions"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "subscriptions_status_createdAt_idx" ON "subscriptions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_submissions_subscriptionId_key" ON "payment_submissions"("subscriptionId");

-- CreateIndex
CREATE INDEX "payment_submissions_userId_status_expiresAt_idx" ON "payment_submissions"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "payment_submissions_status_createdAt_idx" ON "payment_submissions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_submissions_method_transactionIdHash_key" ON "payment_submissions"("method", "transactionIdHash");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_settings" ADD CONSTRAINT "payment_gateway_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
