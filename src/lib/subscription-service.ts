import "server-only";
import { prisma } from "@/lib/prisma";
import { auditCms } from "@/lib/cms-audit";
import { SUBSCRIPTION_PLANS, type PaymentSubmissionInput, type PaymentGatewaySettingsInput } from "@/lib/subscription-schemas";
import { decryptPaymentField, encryptPaymentField, paymentTransactionHash } from "@/lib/payment-pii";

export async function getPublicPaymentGateways() {
  const rows = await prisma.paymentGatewaySetting.findMany({ where: { isActive: true, accountNumber: { not: "" } }, orderBy: { method: "asc" }, select: { method: true, displayName: true, accountNumber: true, transferType: true, instructions: true } });
  return rows;
}

export async function getSubscriptionStatus(userId: string) {
  const now = new Date();
  const [active, latest] = await Promise.all([
    prisma.subscription.findFirst({ where: { userId, status: "ACTIVE", expiresAt: { gt: now } }, orderBy: { expiresAt: "desc" }, select: { id: true, plan: true, amountBdt: true, startedAt: true, expiresAt: true } }),
    prisma.paymentSubmission.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, method: true, amountBdt: true, status: true, expiresAt: true, createdAt: true } }),
  ]);
  const latestPayment = latest?.status === "PENDING" && latest.expiresAt <= now ? { ...latest, status: "EXPIRED" as const } : latest;
  return { active: Boolean(active), subscription: active, latestPayment };
}

export async function hasActiveSubscription(userId: string, now = new Date()) {
  return Boolean(await prisma.subscription.findFirst({ where: { userId, status: "ACTIVE", expiresAt: { gt: now } }, select: { id: true } }));
}

export async function submitManualPayment(userId: string, input: PaymentSubmissionInput) {
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
      if (!user) return { kind: "not-found" as const };
      const active = await tx.subscription.findFirst({ where: { userId, status: "ACTIVE", expiresAt: { gt: now } }, select: { id: true } });
      if (active) return { kind: "already-active" as const };
      const gateway = await tx.paymentGatewaySetting.findUnique({ where: { method: input.method } });
      if (!gateway?.isActive || !gateway.accountNumber) return { kind: "gateway-unavailable" as const };

      const stale = await tx.paymentSubmission.findMany({ where: { userId, status: "PENDING", expiresAt: { lte: now } }, select: { id: true, subscriptionId: true } });
      if (stale.length) {
        await tx.paymentSubmission.updateMany({ where: { id: { in: stale.map((row) => row.id) }, status: "PENDING" }, data: { status: "EXPIRED" } });
        await tx.subscription.updateMany({ where: { id: { in: stale.map((row) => row.subscriptionId) }, status: "PENDING" }, data: { status: "EXPIRED" } });
      }
      const pending = await tx.paymentSubmission.findFirst({ where: { userId, status: "PENDING", expiresAt: { gt: now } }, select: { id: true } });
      if (pending) return { kind: "pending-exists" as const };
      const transactionIdHash = paymentTransactionHash(input.method, input.transactionId);
      const duplicate = await tx.paymentSubmission.findUnique({ where: { method_transactionIdHash: { method: input.method, transactionIdHash } }, select: { id: true } });
      if (duplicate) return { kind: "duplicate-transaction" as const };

      const plan = SUBSCRIPTION_PLANS[input.plan];
      const subscription = await tx.subscription.create({ data: { userId, plan: input.plan, amountBdt: plan.amountBdt, status: "PENDING" } });
      const payment = await tx.paymentSubmission.create({
        data: {
          userId, subscriptionId: subscription.id, method: input.method, amountBdt: plan.amountBdt,
          customerNameEncrypted: encryptPaymentField(input.customerName), phoneEncrypted: encryptPaymentField(input.phone),
          emailEncrypted: encryptPaymentField(user.email), addressEncrypted: encryptPaymentField(input.address),
          transactionIdEncrypted: encryptPaymentField(input.transactionId), transactionIdHash,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        },
        select: { id: true, subscriptionId: true, method: true, amountBdt: true, status: true, expiresAt: true, createdAt: true },
      });
      return { kind: "created" as const, payment, subscription: { id: subscription.id, plan: subscription.plan, status: subscription.status } };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return { kind: "duplicate-transaction" as const };
    throw error;
  }
}

export async function expireOverduePayments() {
  const now = new Date();
  const overdue = await prisma.paymentSubmission.findMany({ where: { status: "PENDING", expiresAt: { lte: now } }, select: { id: true, subscriptionId: true } });
  if (!overdue.length) return 0;
  await prisma.$transaction([
    prisma.paymentSubmission.updateMany({ where: { id: { in: overdue.map(({ id }) => id) }, status: "PENDING" }, data: { status: "EXPIRED" } }),
    prisma.subscription.updateMany({ where: { id: { in: overdue.map(({ subscriptionId }) => subscriptionId) }, status: "PENDING" }, data: { status: "EXPIRED" } }),
  ]);
  return overdue.length;
}

export async function getAdminPaymentDashboard() {
  await expireOverduePayments();
  const [gateways, submissions] = await Promise.all([
    prisma.paymentGatewaySetting.findMany({ orderBy: { method: "asc" } }),
    prisma.paymentSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { id: true, name: true, email: true } }, subscription: { select: { plan: true, status: true, amountBdt: true } } } }),
  ]);
  return {
    gateways,
    submissions: submissions.map((row) => ({
      id: row.id,
      userId: row.userId,
      subscriptionId: row.subscriptionId,
      method: row.method,
      amountBdt: row.amountBdt,
      status: row.status,
      expiresAt: row.expiresAt,
      verifiedAt: row.verifiedAt,
      verifiedById: row.verifiedById,
      createdAt: row.createdAt,
      user: row.user,
      subscription: row.subscription,
      customerName: decryptPaymentField(row.customerNameEncrypted),
      phone: decryptPaymentField(row.phoneEncrypted),
      email: decryptPaymentField(row.emailEncrypted),
      address: decryptPaymentField(row.addressEncrypted),
      transactionId: decryptPaymentField(row.transactionIdEncrypted),
    })),
  };
}

export async function getAdminActiveSubscribers(now = new Date()) {
  const rows = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: now },
      user: { status: "ACTIVE", deletedAt: null },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      plan: true,
      amountBdt: true,
      startedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      paymentSubmission: { select: { phoneEncrypted: true } },
    },
  });
  return rows.map(({ paymentSubmission, ...row }) => ({
    ...row,
    phone: row.user.phone || (paymentSubmission ? decryptPaymentField(paymentSubmission.phoneEncrypted) : ""),
  }));
}

export async function updatePaymentGateway(input: PaymentGatewaySettingsInput, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const gateway = await tx.paymentGatewaySetting.upsert({
      where: { method: input.method },
      create: { ...input, updatedById: adminId },
      update: { displayName: input.displayName, accountNumber: input.accountNumber, transferType: input.transferType, instructions: input.instructions, isActive: input.isActive, updatedById: adminId },
    });
    await auditCms(tx, { actorId: adminId, action: "payment-gateway.update", resourceType: "PaymentGatewaySetting", resourceId: input.method, metadata: { method: input.method, isActive: input.isActive } });
    return gateway;
  });
}

export async function verifyManualPayment(paymentId: string, adminId: string, approve: boolean) {
  return prisma.$transaction(async (tx) => {
    const first = await tx.paymentSubmission.findUnique({ where: { id: paymentId }, select: { id: true, userId: true } });
    if (!first) return { kind: "not-found" as const };
    await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${first.userId}::uuid FOR UPDATE`;
    const submission = await tx.paymentSubmission.findUnique({ where: { id: paymentId }, include: { subscription: true } });
    if (!submission) return { kind: "not-found" as const };
    if (submission.status !== "PENDING") return { kind: "already-processed" as const };
    const now = new Date();
    if (submission.expiresAt <= now) {
      await tx.paymentSubmission.update({ where: { id: paymentId }, data: { status: "EXPIRED", verifiedAt: now, verifiedById: adminId } });
      await tx.subscription.update({ where: { id: submission.subscriptionId }, data: { status: "EXPIRED" } });
      await auditCms(tx, { actorId: adminId, action: "payment.expire", resourceType: "PaymentSubmission", resourceId: paymentId, metadata: { method: submission.method } });
      return { kind: "expired" as const };
    }
    if (approve) {
      const active = await tx.subscription.findFirst({ where: { userId: submission.userId, status: "ACTIVE", expiresAt: { gt: now } }, select: { id: true } });
      if (active) return { kind: "active-exists" as const };
      await tx.subscription.updateMany({ where: { userId: submission.userId, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      const duration = SUBSCRIPTION_PLANS[submission.subscription.plan].durationDays;
      const expiresAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      await tx.subscription.update({ where: { id: submission.subscriptionId }, data: { status: "ACTIVE", startedAt: now, expiresAt } });
      const payment = await tx.paymentSubmission.update({ where: { id: paymentId, status: "PENDING" }, data: { status: "VERIFIED", verifiedAt: now, verifiedById: adminId }, select: { id: true, status: true, verifiedAt: true } });
      await auditCms(tx, { actorId: adminId, action: "payment.verify", resourceType: "PaymentSubmission", resourceId: paymentId, metadata: { method: submission.method, plan: submission.subscription.plan, amountBdt: submission.amountBdt } });
      return { kind: "verified" as const, payment, subscription: { id: submission.subscriptionId, status: "ACTIVE" as const, expiresAt } };
    }
    await tx.subscription.update({ where: { id: submission.subscriptionId }, data: { status: "REJECTED" } });
    const payment = await tx.paymentSubmission.update({ where: { id: paymentId, status: "PENDING" }, data: { status: "REJECTED", verifiedAt: now, verifiedById: adminId }, select: { id: true, status: true, verifiedAt: true } });
    await auditCms(tx, { actorId: adminId, action: "payment.reject", resourceType: "PaymentSubmission", resourceId: paymentId, metadata: { method: submission.method, plan: submission.subscription.plan, amountBdt: submission.amountBdt } });
    return { kind: "rejected" as const, payment, subscription: { id: submission.subscriptionId, status: "REJECTED" as const } };
  }, { isolationLevel: "Serializable" });
}
