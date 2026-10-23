import { randomBytes } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPaymentField } from "@/lib/payment-pii";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
let ipCounter = 670;
const userIds: string[] = [];

type Account = { id: string; name: string; email: string; cookie: string };
async function signup(label: string): Promise<Account> {
  const name = `সদস্য ${label} ${suffix}`;
  const email = `${label}-${suffix}@example.test`;
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `203.0.${Math.floor(Math.random() * 200) + 1}.${ipCounter++}` },
    body: JSON.stringify({ name, email, password: randomTestPassword() }),
  }));
  expect(response.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, name: true, email: true } });
  userIds.push(user.id);
  const session = response.headers.getSetCookie().find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(session).toBeTruthy();
  return { ...user, cookie: session!.split(";")[0]! };
}
function request(path: string, method = "GET", cookie?: string, body?: Record<string, unknown>, requestOrigin = origin) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (requestOrigin) headers.set("origin", requestOrigin);
  if (body) headers.set("content-type", "application/json");
  return new Request(`${origin}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function grantBillingAdmin(account: Account) {
  const role = await prisma.role.upsert({ where: { code: "ADMIN" }, update: {}, create: { code: "ADMIN", name: "প্রশাসক" } });
  for (const code of ["payments.read", "payments.manage"]) {
    const permission = await prisma.permission.upsert({ where: { code }, update: {}, create: { code, description: code } });
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
  }
  await prisma.userRole.create({ data: { userId: account.id, roleId: role.id } });
}
async function configureGateway(active: boolean) {
  await prisma.paymentGatewaySetting.upsert({
    where: { method: "NAGAD" },
    create: { method: "NAGAD", displayName: "নগদ", accountNumber: active ? "01712345678" : "", transferType: "Send Money", instructions: "ডেভেলপমেন্ট integration fixture", isActive: active },
    update: { displayName: "নগদ", accountNumber: active ? "01712345678" : "", transferType: "Send Money", instructions: "ডেভেলপমেন্ট integration fixture", isActive: active },
  });
}
function form(transactionId: string, plan: "MONTHLY" | "YEARLY" = "MONTHLY") {
  return { plan, method: "NAGAD", customerName: "রহিম উদ্দিন", phone: "01712345678", address: "ঢাকা, বাংলাদেশ", transactionId };
}
async function cleanup() {
  if (userIds.length) await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await configureGateway(false);
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
}
afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("manual reader membership workflow", () => {
  it("blocks nonmembers from subscriber APIs and does not return retained collections", async () => {
    const reader = await signup("free-reader");
    const collectionRoute = await import("@/app/api/me/collections/[collection]/route");
    const articleRoute = await import("@/app/api/me/articles/[id]/[collection]/route");
    const inboxRoute = await import("@/app/api/me/notifications/route");
    const id = "00000000-0000-4000-8000-000000000001";
    expect((await collectionRoute.GET(request("/api/me/collections/saved", "GET", reader.cookie), { params: Promise.resolve({ collection: "saved" }) })).status).toBe(402);
    expect((await articleRoute.PUT(request(`/api/me/articles/${id}/saved`, "PUT", reader.cookie), { params: Promise.resolve({ id, collection: "saved" }) })).status).toBe(402);
    expect((await inboxRoute.GET(request("/api/me/notifications", "GET", reader.cookie))).status).toBe(402);
    const dashboardRoute = await import("@/app/api/me/dashboard/route");
    const dashboard = await dashboardRoute.GET(request("/api/me/dashboard", "GET", reader.cookie));
    expect(dashboard.status).toBe(200);
    expect(await dashboard.json()).toMatchObject({ savedArticles: [], favouriteArticles: [], counts: { saved: 0, favourites: 0, unreadNotifications: 0 }, membership: { active: false } });
  });

  it("submits a price snapshot with no PII response, then requires billing authorization and activates only after human approval", async () => {
    await configureGateway(true);
    const reader = await signup("payer");
    const other = await signup("other-payer");
    const admin = await signup("billing-admin");
    await grantBillingAdmin(admin);
    const paymentRoute = await import("@/app/api/me/subscription/route");
    const submission = await paymentRoute.POST(request("/api/me/subscription", "POST", reader.cookie, form(`TX-${suffix}` , "YEARLY")));
    expect(submission.status).toBe(201);
    const responseBody = await submission.json();
    expect(responseBody.payment).toMatchObject({ method: "NAGAD", amountBdt: 612, status: "PENDING" });
    expect(responseBody.payment).not.toHaveProperty("transactionId");
    expect(responseBody.payment).not.toHaveProperty("email");
    const record = await prisma.paymentSubmission.findUniqueOrThrow({ where: { id: responseBody.payment.id } });
    expect(record).toMatchObject({ userId: reader.id, amountBdt: 612, status: "PENDING" });
    expect(record.emailEncrypted).not.toContain(reader.email);
    expect(decryptPaymentField(record.emailEncrypted)).toBe(reader.email);
    expect(decryptPaymentField(record.transactionIdEncrypted)).toBe(`TX-${suffix}`);
    expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(record.expiresAt.getTime()).toBeLessThan(Date.now() + 16 * 60 * 1000);

    const otherSubmission = await paymentRoute.POST(request("/api/me/subscription", "POST", other.cookie, form(`TX-${suffix}`)));
    expect(otherSubmission.status).toBe(409); // Global provider transaction ID uniqueness.
    const secondPending = await paymentRoute.POST(request("/api/me/subscription", "POST", reader.cookie, form(`TX-SECOND-${suffix}`)));
    expect(secondPending.status).toBe(409);

    const adminRoute = await import("@/app/api/admin/subscriptions/route");
    expect((await adminRoute.GET(request("/api/admin/subscriptions", "GET", reader.cookie))).status).toBe(403);
    const inbox = await adminRoute.GET(request("/api/admin/subscriptions", "GET", admin.cookie));
    expect(inbox.status).toBe(200);
    expect((await inbox.json()).submissions.some((item: { id: string }) => item.id === record.id)).toBe(true);

    const decisionRoute = await import("@/app/api/admin/subscriptions/[id]/route");
    const denied = await decisionRoute.PATCH(request(`/api/admin/subscriptions/${record.id}`, "PATCH", reader.cookie, { action: "approve" }), { params: Promise.resolve({ id: record.id }) });
    expect(denied.status).toBe(403);
    const badOrigin = await decisionRoute.PATCH(request(`/api/admin/subscriptions/${record.id}`, "PATCH", admin.cookie, { action: "approve" }, "https://attacker.invalid"), { params: Promise.resolve({ id: record.id }) });
    expect(badOrigin.status).toBe(403);
    const approved = await decisionRoute.PATCH(request(`/api/admin/subscriptions/${record.id}`, "PATCH", admin.cookie, { action: "approve" }), { params: Promise.resolve({ id: record.id }) });
    expect(approved.status).toBe(200);
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: record.subscriptionId } })).toMatchObject({ status: "ACTIVE", plan: "YEARLY", amountBdt: 612, startedAt: expect.any(Date), expiresAt: expect.any(Date) });
    expect(await prisma.paymentSubmission.findUniqueOrThrow({ where: { id: record.id } })).toMatchObject({ status: "VERIFIED", verifiedById: admin.id });
    const { getAdminActiveSubscribers } = await import("@/lib/subscription-service");
    const activeSubscribers = await getAdminActiveSubscribers();
    expect(activeSubscribers.find((item) => item.user.id === reader.id)).toMatchObject({ plan: "YEARLY", phone: "01712345678" });
    expect(activeSubscribers.some((item) => item.user.id === other.id)).toBe(false);
    const status = await paymentRoute.GET(request("/api/me/subscription", "GET", reader.cookie));
    expect(await status.json()).toMatchObject({ active: true, subscription: { plan: "YEARLY", amountBdt: 612 } });
    expect((await decisionRoute.PATCH(request(`/api/admin/subscriptions/${record.id}`, "PATCH", admin.cookie, { action: "approve" }), { params: Promise.resolve({ id: record.id }) })).status).toBe(409);
    const alreadyActive = await paymentRoute.POST(request("/api/me/subscription", "POST", reader.cookie, form(`TX-NEW-${suffix}`)));
    expect(alreadyActive.status).toBe(409);
  }, 60_000);

  it("expires after the 15-minute window, rejects duplicate unverified plans and keeps unknown gateways inactive", async () => {
    await configureGateway(true);
    const reader = await signup("expiring");
    const admin = await signup("expiry-admin");
    await grantBillingAdmin(admin);
    const paymentRoute = await import("@/app/api/me/subscription/route");
    const created = await paymentRoute.POST(request("/api/me/subscription", "POST", reader.cookie, form(`TX-EXP-${suffix}`)));
    const { payment } = await created.json();
    await prisma.paymentSubmission.update({ where: { id: payment.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const decisionRoute = await import("@/app/api/admin/subscriptions/[id]/route");
    const approved = await decisionRoute.PATCH(request(`/api/admin/subscriptions/${payment.id}`, "PATCH", admin.cookie, { action: "approve" }), { params: Promise.resolve({ id: payment.id }) });
    expect(approved.status).toBe(409);
    expect(await prisma.paymentSubmission.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "EXPIRED" });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: payment.subscriptionId } })).toMatchObject({ status: "EXPIRED" });

    await configureGateway(false);
    const unavailable = await paymentRoute.POST(request("/api/me/subscription", "POST", reader.cookie, form(`TX-OFF-${suffix}`)));
    expect(unavailable.status).toBe(409);
  }, 60_000);
});
