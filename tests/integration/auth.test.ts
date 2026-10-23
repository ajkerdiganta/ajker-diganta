import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { takeTestResetMessages } from "@/lib/email";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const expectedSameSite = new URL(origin).hostname.endsWith(".manus.computer") ? "SameSite=None" : "SameSite=Lax";
const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const uniqueEmail = `phase1-${Date.now()}@example.test`;
const initialPassword = randomTestPassword();
const newPassword = randomTestPassword();
let requestIpCounter = 10;
const requestIpPrefix = Math.floor(Math.random() * 254) + 1;

type CallOptions = { cookie?: string; body?: Record<string, unknown>; originHeader?: string; ip?: string };
async function authPost(path: string, { cookie, body = {}, originHeader = origin, ip }: CallOptions = {}) {
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: originHeader,
      "x-real-ip": ip ?? `198.51.${requestIpPrefix}.${requestIpCounter++}`,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  }));
}

async function authGet(path: string, cookie?: string) {
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: "GET",
    headers: { origin, ...(cookie ? { cookie } : {}) },
  }));
}

async function cookieFrom(response: Response): Promise<string> {
  const setCookies = response.headers.getSetCookie();
  const sessionCookie = setCookies.find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  if (!sessionCookie) throw new Error(`Session cookie missing: ${setCookies.map((line) => line.split("=")[0]).join(",")}`);
  expect(sessionCookie).toMatch(/HttpOnly/i);
  expect(sessionCookie).toMatch(new RegExp(expectedSameSite, "i"));
  expect(sessionCookie).toMatch(/Secure/i);
  return sessionCookie.split(";")[0];
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: uniqueEmail } });
  await prisma.$disconnect();
});

describe("Phase 1 auth and authorization integration", () => {
  it("registers Bangla text, authenticates, enforces RBAC, logs out, and resets a password", async () => {
    const signup = await authPost("/sign-up/email", {
      body: { name: "রহিম উদ্দিন — Rahim", email: uniqueEmail, password: initialPassword },
    });
    expect(signup.status).toBe(200);
    const created = await signup.json();
    expect(created.user.name).toBe("রহিম উদ্দিন — Rahim");
    const userCookie = await cookieFrom(signup);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: uniqueEmail }, include: { roleAssignments: { include: { role: true } } } });
    const roleCodes = (user.roleAssignments as Array<{ role: { code: string } }>).map(({ role }) => role.code);
    expect(roleCodes).toContain("USER");
    expect(roleCodes).not.toContain("ADMIN");

    const dashboardRequest = new Request(`${origin}/api/me/dashboard`, { headers: { cookie: userCookie } });
    const dashboard = await (await import("@/app/api/me/dashboard/route")).GET(dashboardRequest);
    expect(dashboard.status).toBe(200);
    expect((await dashboard.json()).user.name).toBe("রহিম উদ্দিন — Rahim");

    const adminRequest = new Request(`${origin}/api/admin/overview`, { headers: { cookie: userCookie } });
    const denied = await (await import("@/app/api/admin/overview/route")).GET(adminRequest);
    expect(denied.status).toBe(403);

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
    const allowed = await (await import("@/app/api/admin/overview/route")).GET(adminRequest);
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).totalUsers).toBeGreaterThan(0);

    const logout = await authPost("/sign-out", { cookie: userCookie });
    expect(logout.status).toBe(200);
    const sessionAfterLogout = await authGet("/get-session", userCookie);
    expect(await sessionAfterLogout.json()).toBeNull();

    const oldPasswordLogin = await authPost("/sign-in/email", { body: { email: uniqueEmail, password: initialPassword } });
    expect(oldPasswordLogin.status).toBe(200);
    const oldPasswordCookie = await cookieFrom(oldPasswordLogin);

    const resetRequest = await authPost("/request-password-reset", {
      body: { email: uniqueEmail, redirectTo: `${origin}/reset-password` },
    });
    expect(resetRequest.status).toBe(200);
    const [resetMessage] = takeTestResetMessages();
    expect(resetMessage?.to).toBe(uniqueEmail);
    const resetLink = new URL(resetMessage!.url);
    const resetToken = resetLink.pathname.split("/").filter(Boolean).at(-1);
    expect(resetToken).toBeTruthy();

    const reset = await authPost("/reset-password", {
      body: { newPassword, token: resetToken },
    });
    expect(reset.status).toBe(200);
    expect(await (await authGet("/get-session", oldPasswordCookie)).json()).toBeNull();

    const login = await authPost("/sign-in/email", { body: { email: uniqueEmail, password: newPassword } });
    expect(login.status).toBe(200);
    const newCookie = await cookieFrom(login);
    const session = await authGet("/get-session", newCookie);
    expect((await session.json()).user.email).toBe(uniqueEmail);
  }, 30_000);

  it("rejects anonymous API requests and invalid short passwords", async () => {
    const unauthorized = await (await import("@/app/api/me/dashboard/route")).GET(
      new Request(`${origin}/api/me/dashboard`),
    );
    expect(unauthorized.status).toBe(401);

    const deniedAdmin = await (await import("@/app/api/admin/overview/route")).GET(
      new Request(`${origin}/api/admin/overview`),
    );
    expect(deniedAdmin.status).toBe(401);

    const response = await authPost("/sign-up/email", {
      body: { name: "Test", email: `short-${Date.now()}@example.test`, password: String.fromCharCode(120) },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 15_000);

  it("rejects an untrusted Origin and rate-limits repeated login attempts", async () => {
    const originResponse = await authPost("/sign-in/email", {
      originHeader: "https://untrusted.invalid",
      body: { email: "nobody@example.test", password: randomTestPassword() },
    });
    expect(originResponse.status).toBeGreaterThanOrEqual(400);

    const isolatedTestIp = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
    const responses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await authPost("/sign-in/email", {
        ip: isolatedTestIp,
        body: { email: "nobody@example.test", password: randomTestPassword() },
      });
      responses.push(response.status);
    }
    expect(responses.slice(0, 5).every((status) => status < 429)).toBe(true);
    expect(responses[5]).toBe(429);
  }, 15_000);
});
