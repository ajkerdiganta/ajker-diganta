import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as siteContentRoute from "@/app/api/admin/site-content/route";
import * as publicSubmissionsRoute from "@/app/api/public/submissions/route";
import * as adminSubmissionsRoute from "@/app/api/admin/submissions/route";
import * as adminSubmissionRoute from "@/app/api/admin/submissions/[id]/route";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "https://integration.test";
const adminEmail = `site-content-${Date.now()}@example.test`;
const contactEmail = `contact-${Date.now()}@example.test`;
const newsletterEmail = `newsletter-${Date.now()}@example.test`;
let cookie = "";
let originalAbout: { title: string; body: string; metaTitle: string | null; metaDescription: string | null } | null = null;
let originalSettings: { publisherName: string | null } | null | undefined;
let ipCounter = 101;

async function signupAdmin() {
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `198.51.100.${ipCounter++}` },
    body: JSON.stringify({ name: "সাইট কনটেন্ট পরীক্ষক", email: adminEmail, password: randomTestPassword() }),
  }));
  expect(response.status).toBe(200);
  const sessionCookie = response.headers.getSetCookie().find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(sessionCookie).toBeTruthy();
  cookie = sessionCookie!.split(";")[0];
  const user = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", origin);
  if (cookie) headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");
  return new Request(`${origin}${path}`, { ...init, headers });
}

async function publicSubmit(body: Record<string, unknown>, ip: string) {
  return publicSubmissionsRoute.POST(new Request(`${origin}/api/public/submissions`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-real-ip": ip }, body: JSON.stringify(body),
  }));
}

afterAll(async () => {
  await prisma.contactSubmission.deleteMany({ where: { email: contactEmail } });
  await prisma.footerSubmission.deleteMany({ where: { email: newsletterEmail } });
  if (originalAbout) {
    await prisma.sitePage.update({ where: { slug: "about" }, data: originalAbout });
  }
  if (originalSettings !== undefined) {
    if (originalSettings) await prisma.siteSetting.update({ where: { id: "global" }, data: { publisherName: originalSettings.publisherName } });
    else await prisma.siteSetting.deleteMany({ where: { id: "global" } });
  }
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.$disconnect();
});

describe("site content and public submissions", () => {
  it("requires same-origin authenticated admin permission for site content and PII inbox", async () => {
    const anonymousContent = await siteContentRoute.GET(new Request(`${origin}/api/admin/site-content`));
    const anonymousInbox = await adminSubmissionsRoute.GET(new Request(`${origin}/api/admin/submissions`));
    expect(anonymousContent.status).toBe(401);
    expect(anonymousInbox.status).toBe(401);
    const untrusted = await publicSubmissionsRoute.POST(new Request(`${origin}/api/public/submissions`, {
      method: "POST", headers: { origin: "https://untrusted.invalid", "content-type": "application/json" }, body: JSON.stringify({ type: "CONTACT" }),
    }));
    expect(untrusted.status).toBe(403);
    await signupAdmin();
  });

  it("serves only safe editable fields, writes an audited page change and rejects unknown fields", async () => {
    originalAbout = await prisma.sitePage.findUniqueOrThrow({ where: { slug: "about" }, select: { title: true, body: true, metaTitle: true, metaDescription: true } });
    const get = await siteContentRoute.GET(request("/api/admin/site-content"));
    expect(get.status).toBe(200);
    expect(get.headers.get("cache-control")).toBe("private, no-store");
    const data = await get.json();
    expect(data.pages).toHaveLength(3);
    expect(JSON.stringify(data)).not.toMatch(/resendApiKey|r2Secret|providerSecret/i);
    expect(data.settings.companyLinks.map(({ label, href }: { label: string; href: string }) => ({ label, href }))).toEqual([
      { label: "TheLens24", href: "https://thelens24.com" },
      { label: "Habigonj24", href: "https://habigonj24.com" },
    ]);

    revalidatePathMock.mockClear();
    const response = await siteContentRoute.PATCH(request("/api/admin/site-content", {
      method: "PATCH", body: JSON.stringify({ page: { slug: "about", title: "আমাদের কথা — পরীক্ষিত", body: "পরীক্ষার জন্য সংরক্ষিত বাংলা লেখা।", metaTitle: "পরীক্ষার শিরোনাম", metaDescription: "পরীক্ষার বিবরণ।" } }),
    }));
    expect(response.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledWith("/about");
    expect((await prisma.sitePage.findUniqueOrThrow({ where: { slug: "about" } })).title).toBe("আমাদের কথা — পরীক্ষিত");
    const deniedExtra = await siteContentRoute.PATCH(request("/api/admin/site-content", {
      method: "PATCH", body: JSON.stringify({ page: { slug: "about", title: "ভুল", body: "পরীক্ষার জন্য যথেষ্ট দীর্ঘ লেখা", providerKey: "hidden" } }),
    }));
    expect(deniedExtra.status).toBe(400);
    expect(await prisma.auditLog.count({ where: { actorId: (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id, action: "site-page.update", resourceType: "SitePage" } })).toBeGreaterThan(0);

    originalSettings = await prisma.siteSetting.findUnique({ where: { id: "global" }, select: { publisherName: true } });
    revalidatePathMock.mockClear();
    const settingsResponse = await siteContentRoute.PATCH(request("/api/admin/site-content", {
      method: "PATCH", body: JSON.stringify({ settings: { publisherName: "CMS validation record" } }),
    }));
    expect(settingsResponse.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect((await prisma.siteSetting.findUniqueOrThrow({ where: { id: "global" } })).publisherName).toBe("CMS validation record");
  });

  it("stores strict contact/newsletter requests, protects the inbox, and audits resolve/reopen transitions", async () => {
    const contact = await publicSubmit({ type: "CONTACT", name: "রহিম", email: contactEmail, subject: "সংশোধনের অনুরোধ", message: "একটি যথাযথ বার্তার নমুনা।", website: "" }, "192.0.2.111");
    expect(contact.status).toBe(201);
    expect(contact.headers.get("cache-control")).toBe("no-store");
    const contactRow = await prisma.contactSubmission.findFirstOrThrow({ where: { email: contactEmail } });
    expect(contactRow.status).toBe("RECEIVED");

    const newsletter = await publicSubmit({ type: "NEWSLETTER", name: "পাঠক", email: newsletterEmail, phone: "+880 1700-000000", message: "নিউজলেটারে আগ্রহ জানাচ্ছি।", consent: true, website: "" }, "192.0.2.112");
    expect(newsletter.status).toBe(201);
    const newsletterRow = await prisma.footerSubmission.findFirstOrThrow({ where: { email: newsletterEmail } });
    expect(newsletterRow.type).toBe("NEWSLETTER");
    expect(newsletterRow.status).toBe("RECEIVED");
    expect(newsletterRow.consentAt).toBeTruthy();

    const inbox = await adminSubmissionsRoute.GET(request("/api/admin/submissions"));
    expect(inbox.status).toBe(200);
    expect(inbox.headers.get("cache-control")).toBe("private, no-store");
    const resolved = await adminSubmissionRoute.PATCH(request(`/api/admin/submissions/${contactRow.id}`, { method: "PATCH", body: JSON.stringify({ kind: "contact", action: "resolve" }) }), { params: Promise.resolve({ id: contactRow.id }) });
    expect(resolved.status).toBe(200);
    expect((await prisma.contactSubmission.findUniqueOrThrow({ where: { id: contactRow.id } })).status).toBe("RESOLVED");

    const mismatch = await adminSubmissionRoute.PATCH(request(`/api/admin/submissions/${newsletterRow.id}`, { method: "PATCH", body: JSON.stringify({ kind: "contact", action: "resolve" }) }), { params: Promise.resolve({ id: newsletterRow.id }) });
    expect(mismatch.status).toBe(404);
    const reopened = await adminSubmissionRoute.PATCH(request(`/api/admin/submissions/${contactRow.id}`, { method: "PATCH", body: JSON.stringify({ kind: "contact", action: "reopen" }) }), { params: Promise.resolve({ id: contactRow.id }) });
    expect(reopened.status).toBe(200);
    expect((await prisma.contactSubmission.findUniqueOrThrow({ where: { id: contactRow.id } })).status).toBe("RECEIVED");
    expect(await prisma.auditLog.count({ where: { resourceType: "ContactSubmission", resourceId: contactRow.id } })).toBe(2);
  }, 30_000);
});
