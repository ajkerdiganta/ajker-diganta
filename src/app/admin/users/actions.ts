'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { RoleCode, UserStatus } from "@/generated/prisma/enums";
import { provisionManagedUser } from "@/lib/admin-user-service";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const assignableRoles: RoleCode[] = ["ADMIN", "EDITOR", "REPORTER", "VIDEO_EDITOR", "MODERATOR", "USER"];
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validPhone = (value: string) => !value || /^[+\d() .-]{5,40}$/.test(value);

async function requireUserManager() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "users.manage"))) redirect("/forbidden");
  return principal;
}

async function activeAdministratorCount(tx: Prisma.TransactionClient) {
  return tx.userRole.count({
    where: {
      role: { code: { in: ["ADMIN", "SUPER_ADMIN"] } },
      user: { status: "ACTIVE", deletedAt: null },
    },
  });
}

function redirectWithError(code: "invalid" | "update" | "protected" | "create"): never {
  redirect(`/admin/users?error=${code}`);
}

export async function createManagedUserAction(formData: FormData) {
  const principal = await requireUserManager();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleCode = String(formData.get("roleCode") ?? "") as RoleCode;
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128 || !validPhone(phone) || !["ADMIN", "EDITOR", "REPORTER", "USER"].includes(roleCode)) redirectWithError("invalid");
  try {
    const incomingHeaders = new Headers(await headers());
    await provisionManagedUser({
      actorId: principal.id,
      name,
      email,
      phone,
      password,
      roleCode,
      origin: incomingHeaders.get("origin") ?? undefined,
      clientIp: incomingHeaders.get("x-real-ip") ?? undefined,
    });
  } catch { redirectWithError("create"); }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect("/admin/users?created=1");
}

export async function updateUserRoleAction(formData: FormData) {
  const principal = await requireUserManager();
  const userId = String(formData.get("userId") ?? "");
  const roleCode = String(formData.get("roleCode") ?? "") as RoleCode;
  if (!validId(userId) || userId === principal.id || !assignableRoles.includes(roleCode)) redirectWithError("invalid");

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { status: true, roleAssignments: { select: { role: { select: { code: true } } } } },
      });
      if (!target || target.roleAssignments.some(({ role }) => role.code === "SUPER_ADMIN")) throw new Error("protected target");
      const targetIsAdmin = target.roleAssignments.some(({ role }) => role.code === "ADMIN");
      if (targetIsAdmin && !principal.isSuperAdmin) throw new Error("admin accounts require super-admin changes");
      if (targetIsAdmin && roleCode !== "ADMIN" && target.status === "ACTIVE" && await activeAdministratorCount(tx) <= 1) throw new Error("last administrator");
      const role = await tx.role.findUnique({ where: { code: roleCode }, select: { id: true } });
      if (!role) throw new Error("missing role");
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId: role.id } });
      await tx.auditLog.create({ data: { actorId: principal.id, action: "user.role.replace", resourceType: "user", resourceId: userId, metadata: { roleCode } } });
    });
  } catch {
    redirectWithError("update");
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?updated=role");
}

export async function updateUserStatusAction(formData: FormData) {
  const principal = await requireUserManager();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as UserStatus;
  if (!validId(userId) || !["ACTIVE", "SUSPENDED"].includes(status) || userId === principal.id) redirectWithError("invalid");

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { status: true, roleAssignments: { select: { role: { select: { code: true } } } } },
      });
      if (!target || target.roleAssignments.some(({ role }) => role.code === "SUPER_ADMIN")) throw new Error("protected target");
      const targetIsAdmin = target.roleAssignments.some(({ role }) => role.code === "ADMIN");
      if (targetIsAdmin && !principal.isSuperAdmin) throw new Error("admin accounts require super-admin changes");
      if (targetIsAdmin && status === "SUSPENDED" && target.status === "ACTIVE" && await activeAdministratorCount(tx) <= 1) throw new Error("last administrator");
      await tx.user.update({ where: { id: userId }, data: { status } });
      if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { actorId: principal.id, action: "user.status.change", resourceType: "user", resourceId: userId, metadata: { from: target.status, to: status } } });
    });
  } catch {
    redirectWithError("update");
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?updated=status");
}

export async function removeUserAction(formData: FormData) {
  const principal = await requireUserManager();
  const userId = String(formData.get("userId") ?? "");
  if (!validId(userId) || userId === principal.id) redirectWithError("invalid");
  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { status: true, roleAssignments: { select: { role: { select: { code: true } } } } },
      });
      if (!target || target.roleAssignments.some(({ role }) => role.code === "SUPER_ADMIN")) throw new Error("protected target");
      const targetIsAdmin = target.roleAssignments.some(({ role }) => role.code === "ADMIN");
      if (targetIsAdmin && !principal.isSuperAdmin) throw new Error("admin accounts require super-admin changes");
      if (targetIsAdmin && target.status === "ACTIVE" && await activeAdministratorCount(tx) <= 1) throw new Error("last administrator");

      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.emailOutbox.deleteMany({ where: { userId } });
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "অপসারিত অ্যাকাউন্ট",
          email: `removed+${userId}@deleted.invalid`,
          phone: null,
          image: null,
          emailVerified: false,
          status: "SUSPENDED",
          deletedAt: new Date(),
        },
      });
      await tx.auditLog.create({ data: { actorId: principal.id, action: "user.remove", resourceType: "user", resourceId: userId, metadata: { formerRoles: target.roleAssignments.map(({ role }) => role.code), priorStatus: target.status } } });
    }, { isolationLevel: "Serializable" });
  } catch {
    redirectWithError("protected");
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/subscribers");
  revalidatePath("/admin/subscriptions");
  redirect("/admin/users?removed=1");
}
