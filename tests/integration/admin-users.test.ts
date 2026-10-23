import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

const mockState = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => mockState.headers }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (location: string) => { throw Object.assign(new Error("test redirect"), { location }); } }));

import { auth } from "@/lib/auth";
import { getPrincipal } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { createManagedUserAction, removeUserAction, updateUserStatusAction } from "@/app/admin/users/actions";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const suffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
const generatedPassword = () => `Integration-${randomBytes(32).toString("base64url")}!A9`;
const userIds: string[] = [];
let signupIp = 20;

async function signupAndGrantAdmin() {
  const email = `user-admin-${suffix}@example.test`;
  const result = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `198.51.100.${signupIp++}` },
    body: JSON.stringify({ name: "Temporary Integration Admin", email, password: generatedPassword() }),
  }));
  expect(result.status).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  userIds.push(user.id);
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  const cookie = result.headers.getSetCookie().find((item) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(item));
  expect(cookie).toBeTruthy();
  return { userId: user.id, email, cookie: cookie!.split(";")[0]! };
}

function redirectedTo(promise: Promise<unknown>, location: string) {
  return expect(promise).rejects.toMatchObject({ location });
}

async function cleanup() {
  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { resourceId: { in: userIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  userIds.length = 0;
  mockState.headers = new Headers();
}

afterEach(cleanup);
afterAll(async () => { await prisma.$disconnect(); });

describe("admin-only account lifecycle", () => {
  it("creates a staff account through Better Auth, freezes it, then safely removes it", async () => {
    const admin = await signupAndGrantAdmin();
    mockState.headers = new Headers({ cookie: admin.cookie, origin, "x-real-ip": `198.51.100.${signupIp++}` });
    expect(await getPrincipal(mockState.headers)).toMatchObject({ id: admin.userId, email: admin.email });

    const reporterPassword = generatedPassword();
    const reporterEmail = `user-reporter-${suffix}@example.test`;
    expect(await prisma.user.findUnique({ where: { email: reporterEmail }, select: { id: true } })).toBeNull();
    const reporterForm = new FormData();
    reporterForm.set("name", "Temporary Reporter");
    reporterForm.set("email", reporterEmail);
    reporterForm.set("phone", "+880 1712345678");
    reporterForm.set("password", reporterPassword);
    reporterForm.set("roleCode", "REPORTER");
    await redirectedTo(createManagedUserAction(reporterForm), "/admin/users?created=1");

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: `user-reporter-${suffix}@example.test` },
      select: { id: true, phone: true, status: true, roleAssignments: { select: { role: { select: { code: true } } } } },
    });
    userIds.push(created.id);
    expect(created.phone).toBe("+880 1712345678");
    expect(created.status).toBe("ACTIVE");
    expect(created.roleAssignments.map(({ role }) => role.code)).toEqual(["REPORTER"]);
    expect(await prisma.session.count({ where: { userId: created.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorId: admin.userId, action: "user.create", resourceId: created.id } })).toBe(1);

    let createdAdminId = "";
    for (const roleCode of ["USER", "EDITOR", "ADMIN"] as const) {
      const email = `managed-${roleCode.toLowerCase()}-${suffix}@example.test`;
      const password = generatedPassword();
      const staffForm = new FormData();
      staffForm.set("name", `Temporary ${roleCode}`);
      staffForm.set("email", email);
      staffForm.set("password", password);
      staffForm.set("roleCode", roleCode);
      await redirectedTo(createManagedUserAction(staffForm), "/admin/users?created=1");
      const staff = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, roleAssignments: { select: { role: { select: { code: true } } } } } });
      userIds.push(staff.id);
      expect(staff.roleAssignments.map(({ role }) => role.code)).toEqual([roleCode]);
      if (roleCode === "ADMIN") createdAdminId = staff.id;
    }
    const protectAdminForm = new FormData();
    protectAdminForm.set("userId", createdAdminId);
    await redirectedTo(removeUserAction(protectAdminForm), "/admin/users?error=protected");
    expect(await prisma.user.findUniqueOrThrow({ where: { id: createdAdminId }, select: { status: true, deletedAt: true } })).toEqual({ status: "ACTIVE", deletedAt: null });

    const freezeForm = new FormData();
    freezeForm.set("userId", created.id);
    freezeForm.set("status", "SUSPENDED");
    await redirectedTo(updateUserStatusAction(freezeForm), "/admin/users?updated=status");
    expect(await prisma.user.findUniqueOrThrow({ where: { id: created.id }, select: { status: true } })).toEqual({ status: "SUSPENDED" });
    expect(await prisma.session.count({ where: { userId: created.id } })).toBe(0);
    const frozenLogin = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-real-ip": `198.51.100.${signupIp++}` },
      body: JSON.stringify({ email: `user-reporter-${suffix}@example.test`, password: reporterPassword }),
    }));
    if (frozenLogin.ok) {
      const cookie = frozenLogin.headers.getSetCookie().find((item) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(item));
      expect(cookie).toBeTruthy();
      expect(await getPrincipal(new Headers({ cookie: cookie!.split(";")[0]! }))).toBeNull();
    }

    const removeForm = new FormData();
    removeForm.set("userId", created.id);
    await redirectedTo(removeUserAction(removeForm), "/admin/users?removed=1");
    const removed = await prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { name: true, email: true, phone: true, status: true, deletedAt: true },
    });
    expect(removed).toMatchObject({ name: "অপসারিত অ্যাকাউন্ট", email: `removed+${created.id}@deleted.invalid`, phone: null, status: "SUSPENDED" });
    expect(removed.deletedAt).toBeInstanceOf(Date);
    expect(await prisma.userRole.count({ where: { userId: created.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: created.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: created.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorId: admin.userId, action: "user.remove", resourceId: created.id } })).toBe(1);
    const removedLogin = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-real-ip": `198.51.100.${signupIp++}` },
      body: JSON.stringify({ email: `user-reporter-${suffix}@example.test`, password: reporterPassword }),
    }));
    expect(removedLogin.status).toBeGreaterThanOrEqual(400);
  });

  it("refuses a role-management action when the requester is not an Admin", async () => {
    const signup = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-real-ip": `198.51.100.${signupIp++}` },
      body: JSON.stringify({ name: "Temporary Reader", email: `user-reader-${suffix}@example.test`, password: generatedPassword() }),
    }));
    expect(signup.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: `user-reader-${suffix}@example.test` }, select: { id: true } });
    userIds.push(user.id);
    const cookie = signup.headers.getSetCookie().find((item) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(item));
    expect(cookie).toBeTruthy();
    mockState.headers = new Headers({ cookie: cookie!.split(";")[0]!, origin });

    const form = new FormData();
    form.set("userId", user.id);
    form.set("roleCode", "ADMIN");
    await redirectedTo(import("@/app/admin/users/actions").then(({ updateUserRoleAction }) => updateUserRoleAction(form)), "/forbidden");
  });
});
