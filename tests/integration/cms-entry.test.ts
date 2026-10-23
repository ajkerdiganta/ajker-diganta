import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const password = randomBytes(32).toString("base64url");
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
let ipCounter = 10;
const userIds: string[] = [];

async function signup(role: string, phone?: string) {
  const email = `cms-${role.toLowerCase()}-${suffix}@example.test`;
  const result = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `192.0.2.${ipCounter++}` },
    body: JSON.stringify({ name: `CMS ${role}`, email, password, ...(phone ? { phone } : {}) }),
  }));
  expect(result.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  userIds.push(user.id);
  const session = result.headers.getSetCookie().find((item) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(item));
  expect(session).toBeTruthy();
  return { id: user.id, email, cookie: session!.split(";")[0]! };
}

async function signin(email: string) {
  const result = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `192.0.2.${ipCounter++}` },
    body: JSON.stringify({ email, password }),
  }));
  expect(result.status).toBe(200);
  const session = result.headers.getSetCookie().find((item) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(item));
  expect(session).toBeTruthy();
  return session!.split(";")[0]!;
}

async function addRole(userId: string, code: "ADMIN" | "REPORTER" | "EDITOR") {
  const role = await prisma.role.findUniqueOrThrow({ where: { code } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

async function entry(cookie: string, query: string) {
  const route = await import("@/app/api/cms/entry/route");
  return route.GET(new Request(`${origin}/api/cms/entry?${query}`, { headers: { cookie } }));
}

async function cleanup() {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
}

afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("CMS role entry", () => {
  it("stores an optional validated phone while public sign-up can only create a reader account", async () => {
    const created = await signup("profile", "+880 1712345678");
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { phone: true, roleAssignments: { select: { role: { select: { code: true } } } } },
    });
    expect(user.phone).toBe("+880 1712345678");
    expect(user.roleAssignments.map(({ role }) => role.code)).toEqual(["USER"]);
  });

  it("sends reader, admin, reporter and editor to their designated surfaces and rejects mismatched roles", async () => {
    await signup("reader");
    const admin = await signup("admin");
    const reporter = await signup("reporter");
    const editor = await signup("editor");
    await addRole(admin.id, "ADMIN");
    await addRole(reporter.id, "REPORTER");
    await addRole(editor.id, "EDITOR");

    const readerCookie = await signin(`cms-reader-${suffix}@example.test`);
    const adminCookie = await signin(`cms-admin-${suffix}@example.test`);
    const reporterCookie = await signin(`cms-reporter-${suffix}@example.test`);
    const editorCookie = await signin(`cms-editor-${suffix}@example.test`);

    const readerPage = await entry(readerCookie, "surface=reader");
    expect(readerPage.status).toBe(200);
    expect(await readerPage.json()).toMatchObject({ destination: "/dashboard" });
    expect((await entry(adminCookie, "surface=reader")).status).toBe(403);
    expect((await entry(reporterCookie, "surface=reader")).status).toBe(403);
    expect((await entry(editorCookie, "surface=reader")).status).toBe(403);

    const adminPage = await entry(adminCookie, "role=ADMIN");
    expect(adminPage.status).toBe(200);
    expect(await adminPage.json()).toMatchObject({ destination: "/admin" });
    const adminSurface = await entry(adminCookie, "surface=admin");
    expect(adminSurface.status).toBe(200);
    expect(await adminSurface.json()).toMatchObject({ destination: "/admin" });
    expect((await entry(adminCookie, "surface=staff")).status).toBe(403);
    const reporterSurface = await entry(reporterCookie, "surface=staff");
    expect(reporterSurface.status).toBe(200);
    expect(await reporterSurface.json()).toMatchObject({ destination: "/admin/articles" });
    const editorSurface = await entry(editorCookie, "surface=staff");
    expect(editorSurface.status).toBe(200);
    expect(await editorSurface.json()).toMatchObject({ destination: "/admin/review" });
    expect((await entry(reporterCookie, "surface=admin")).status).toBe(403);
    const reporterPage = await entry(reporterCookie, "role=REPORTER");
    expect(reporterPage.status).toBe(200);
    expect(await reporterPage.json()).toMatchObject({ destination: "/admin/articles" });
    const editorPage = await entry(editorCookie, "role=EDITOR");
    expect(editorPage.status).toBe(200);
    expect(await editorPage.json()).toMatchObject({ destination: "/admin/review" });

    expect((await entry(readerCookie, "role=ADMIN")).status).toBe(403);
    expect((await entry(reporterCookie, "role=EDITOR")).status).toBe(403);
    expect((await entry(adminCookie, "role=toString")).status).toBe(400);
    expect((await entry(adminCookie, "role=__proto__")).status).toBe(400);
    const anonymous = await (await import("@/app/api/cms/entry/route")).GET(new Request(`${origin}/api/cms/entry?role=ADMIN`));
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("cache-control")).toContain("no-store");
  });
});
