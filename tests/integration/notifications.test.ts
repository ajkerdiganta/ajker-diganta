import { randomBytes } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSystemNotification, getNotificationInbox } from "@/lib/notification-service";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
let ipCounter = 210;
const userIds: string[] = [];

type Account = { id: string; cookie: string; email: string };
async function signup(label: string): Promise<Account> {
  const email = `${label}-${suffix}@example.test`;
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `203.0.${Math.floor(Math.random() * 200) + 1}.${ipCounter++}` },
    body: JSON.stringify({ name: `বিজ্ঞপ্তি পাঠক ${label} ${suffix}`, email, password: randomTestPassword() }),
  }));
  expect(response.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, email: true } });
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
async function cleanup() {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
}
afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("Phase 6 notification inbox", () => {
  it("keeps listing and read/unread operations account-scoped, even with forged user IDs", async () => {
    const owner = await signup("owner");
    const other = await signup("other");
    const start = new Date();
    await Promise.all([owner, other].map((user) => prisma.subscription.create({ data: { userId: user.id, plan: "MONTHLY", amountBdt: 60, status: "ACTIVE", startedAt: start, expiresAt: new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000) } })));
    const ownerNotice = await prisma.notification.create({ data: { userId: owner.id, type: "SYSTEM", priority: "HIGH", templateKey: "system.message", payload: { title: "বাংলা সিস্টেম বার্তা", message: "আপনার নিরাপত্তা সেটিংস হালনাগাদ হয়েছে।" }, dedupeKey: `test:owner:${suffix}` } });
    const otherNotice = await prisma.notification.create({ data: { userId: other.id, type: "SYSTEM", templateKey: "system.message", payload: { title: "ব্যক্তিগত", message: "অন্য পাঠকের বার্তা।" }, dedupeKey: `test:other:${suffix}` } });

    const inboxRoute = await import("@/app/api/me/notifications/route");
    const detailRoute = await import("@/app/api/me/notifications/[id]/route");
    expect((await inboxRoute.GET(request("/api/me/notifications"))).status).toBe(401);
    const forgedList = await inboxRoute.GET(request(`/api/me/notifications?userId=${other.id}`, "GET", owner.cookie));
    expect(forgedList.status).toBe(200);
    const ownerRows = (await forgedList.json()).items as Array<{ id: string; title: string; message: string }>;
    expect(ownerRows.map((item) => item.id)).toEqual([ownerNotice.id]);
    expect(ownerRows[0]).toMatchObject({ title: "বাংলা সিস্টেম বার্তা", message: "আপনার নিরাপত্তা সেটিংস হালনাগাদ হয়েছে।" });
    expect((await inboxRoute.GET(request(`/api/me/notifications?userId=${owner.id}`, "GET", other.cookie))).status).toBe(200);
    const otherRows = await (await inboxRoute.GET(request("/api/me/notifications", "GET", other.cookie))).json();
    expect(otherRows.items.map((item: { id: string }) => item.id)).toEqual([otherNotice.id]);

    const forgedRead = await detailRoute.PATCH(request(`/api/me/notifications/${otherNotice.id}`, "PATCH", owner.cookie, { read: true }), { params: Promise.resolve({ id: otherNotice.id }) });
    expect(forgedRead.status).toBe(404);
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: otherNotice.id } }).then((row) => row.readAt)).toBeNull();
    const wrongOrigin = await detailRoute.PATCH(request(`/api/me/notifications/${ownerNotice.id}`, "PATCH", owner.cookie, { read: true }, "https://attacker.invalid"), { params: Promise.resolve({ id: ownerNotice.id }) });
    expect(wrongOrigin.status).toBe(403);
    const markRead = await detailRoute.PATCH(request(`/api/me/notifications/${ownerNotice.id}`, "PATCH", owner.cookie, { read: true }), { params: Promise.resolve({ id: ownerNotice.id }) });
    expect(markRead.status).toBe(200);
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: ownerNotice.id } }).then((row) => row.readAt)).not.toBeNull();
    const markUnread = await detailRoute.PATCH(request(`/api/me/notifications/${ownerNotice.id}`, "PATCH", owner.cookie, { read: false }), { params: Promise.resolve({ id: ownerNotice.id }) });
    expect(markUnread.status).toBe(200);
    const unread = await inboxRoute.GET(request("/api/me/notifications?unread=true", "GET", owner.cookie));
    const unreadIds = ((await unread.json()).items as Array<{ id: string }>).map((item) => item.id);
    expect(unreadIds).toContain(ownerNotice.id);
    expect(unreadIds).not.toContain(otherNotice.id);

    await prisma.notification.create({ data: { userId: owner.id, type: "TOPIC", templateKey: "article.topic", payload: { topic: "প্রযুক্তি" }, dedupeKey: `test:second:${suffix}` } });
    const markAll = await inboxRoute.PATCH(request("/api/me/notifications", "PATCH", owner.cookie, { action: "read-all" }));
    expect(markAll.status).toBe(200);
    expect((await getNotificationInbox(owner.id, { page: 1, unreadOnly: true })).unreadCount).toBe(0);
    expect((await inboxRoute.PATCH(request("/api/me/notifications", "PATCH", undefined, { action: "read-all" }))).status).toBe(401);
  });

  it("validates notification preferences per account, localizes system messages and deduplicates repeated events", async () => {
    const owner = await signup("pref-owner");
    const other = await signup("pref-other");
    const preferencesRoute = await import("@/app/api/me/preferences/route");
    const initial = await preferencesRoute.GET(request("/api/me/preferences", "GET", owner.cookie));
    expect(initial.status).toBe(200);
    expect(await initial.json()).toMatchObject({ inAppBreakingEnabled: true, inAppTopicEnabled: true, inAppVideoEnabled: false, emailBreakingEnabled: false, emailVideoEnabled: false });
    const forgedPreference = await preferencesRoute.PATCH(request("/api/me/preferences", "PATCH", owner.cookie, { userId: other.id, inAppTopicEnabled: false }));
    expect(forgedPreference.status).toBe(400);
    const savedPreferences = await preferencesRoute.PATCH(request("/api/me/preferences", "PATCH", owner.cookie, { inAppTopicEnabled: false, emailSystemEnabled: true }));
    expect(savedPreferences.status).toBe(200);
    expect(await prisma.userPreference.findUniqueOrThrow({ where: { userId: owner.id } })).toMatchObject({ inAppTopicEnabled: false, emailSystemEnabled: true });
    await preferencesRoute.GET(request("/api/me/preferences", "GET", other.cookie));
    expect(await prisma.userPreference.findUniqueOrThrow({ where: { userId: other.id } }).then((row) => row.inAppTopicEnabled)).toBe(true);

    const first = await prisma.$transaction((tx) => createSystemNotification(tx, { userId: owner.id, dedupeKey: `system-test:${suffix}`, title: "বাংলা নিরাপত্তা বিজ্ঞপ্তি", message: "আপনার প্রোফাইল হালনাগাদ হয়েছে।", priority: "HIGH", href: "/dashboard" }));
    const duplicate = await prisma.$transaction((tx) => createSystemNotification(tx, { userId: owner.id, dedupeKey: `system-test:${suffix}`, title: "বাংলা নিরাপত্তা বিজ্ঞপ্তি", message: "একই ঘটনা পুনরায় পাঠানো হয়েছে।", priority: "HIGH", href: "/dashboard" }));
    expect(first.notificationsCreated).toBe(1);
    expect(duplicate.notificationsCreated).toBe(0);
    expect(first.emailsQueued).toBe(0); // Feature-flagged off until a real email worker is deployed.
    expect(await prisma.notification.count({ where: { userId: owner.id, dedupeKey: `system:system-test:${suffix}` } })).toBe(1);
    expect(await prisma.emailOutbox.count({ where: { userId: owner.id } })).toBe(0);
  });
});
