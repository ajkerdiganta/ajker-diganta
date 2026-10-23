import "server-only";
import { prisma } from "@/lib/prisma";

export const SUBSCRIPTION_PLANS = {
  MONTHLY: { label: "মাসিক", amountBdt: 60, durationDays: 31 },
  YEARLY: { label: "বাৎসরিক", amountBdt: 612, durationDays: 365 },
} as const;

const GATEWAYS = [
  { method: "NAGAD" as const, displayName: "নগদ", transferType: "Send Money", instructions: "নগদে নির্ধারিত নম্বরে Send Money করুন।" },
  { method: "BKASH" as const, displayName: "বিকাশ", transferType: "Send Money", instructions: "বিকাশে নির্ধারিত নম্বরে Send Money করুন।" },
  { method: "ROCKET" as const, displayName: "রকেট", transferType: "Cash Out", instructions: "রকেটে নির্ধারিত নম্বরে Cash Out করুন।" },
];

export async function getGatewaySettings() {
  for (const gateway of GATEWAYS) await prisma.paymentGatewaySetting.upsert({ where: { method: gateway.method }, update: {}, create: { ...gateway, accountNumber: "", isActive: true } });
  return prisma.paymentGatewaySetting.findMany({ orderBy: { method: "asc" } });
}

export async function hasActiveSubscription(userId: string) {
  const active = await prisma.subscription.findFirst({ where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } }, select: { id: true, plan: true, expiresAt: true } });
  return active;
}

export async function getSubscriptionStatus(userId: string) {
  const active = await hasActiveSubscription(userId);
  const latest = active ?? await prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, plan: true, status: true, expiresAt: true } });
  return { active: Boolean(active), subscription: latest };
}

export async function submitPayment(input: { userId: string; plan: "MONTHLY" | "YEARLY"; method: "NAGAD" | "BKASH" | "ROCKET"; customerName: string; phone: string; email: string; address: string; transactionId: string }) {
  const plan = SUBSCRIPTION_PLANS[input.plan];
  const gateway = await prisma.paymentGatewaySetting.findUnique({ where: { method: input.method } });
  if (!gateway?.isActive || !gateway.accountNumber) throw new Error("এই payment gateway এখনো configured নয়");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({ data: { userId: input.userId, plan: input.plan, amountBdt: plan.amountBdt, status: "PENDING" } });
    return tx.paymentSubmission.create({ data: { userId: input.userId, subscriptionId: subscription.id, method: input.method, amountBdt: plan.amountBdt, customerName: input.customerName, phone: input.phone, email: input.email, address: input.address, transactionId: input.transactionId, expiresAt }, include: { subscription: true } });
  });
}

export async function verifyPayment(id: string, adminId: string, approved: boolean) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.paymentSubmission.findUniqueOrThrow({ where: { id }, include: { subscription: true } });
    if (submission.status !== "PENDING") throw new Error("এই payment submission ইতোমধ্যে processed হয়েছে");
    if (!approved) {
      await tx.subscription.update({ where: { id: submission.subscriptionId }, data: { status: "REJECTED" } });
      return tx.paymentSubmission.update({ where: { id }, data: { status: "REJECTED", verifiedAt: new Date(), verifiedById: adminId } });
    }
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SUBSCRIPTION_PLANS[submission.subscription.plan].durationDays * 24 * 60 * 60 * 1000);
    await tx.subscription.updateMany({ where: { userId: submission.userId, status: "ACTIVE" }, data: { status: "EXPIRED" } });
    await tx.subscription.update({ where: { id: submission.subscriptionId }, data: { status: "ACTIVE", startedAt, expiresAt } });
    return tx.paymentSubmission.update({ where: { id }, data: { status: "VERIFIED", verifiedAt: startedAt, verifiedById: adminId } });
  });
}
