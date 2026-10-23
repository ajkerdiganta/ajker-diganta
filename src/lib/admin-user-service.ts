import "server-only";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "@/generated/prisma/enums";

const createableRoles = new Set<RoleCode>(["ADMIN", "EDITOR", "REPORTER", "USER"]);
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export class AdminUserCreationError extends Error {
  constructor(readonly code: "duplicate-email" | "auth-rejected" | "role-unavailable" | "invalid-created-user" | "transaction-failed") {
    super("Admin-managed account creation failed");
    this.name = "AdminUserCreationError";
  }
}

export async function provisionManagedUser(input: {
  actorId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  roleCode: RoleCode;
  origin?: string;
  clientIp?: string;
}) {
  if (!createableRoles.has(input.roleCode)) throw new AdminUserCreationError("role-unavailable");
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new AdminUserCreationError("duplicate-email");
  }

  let stage = "auth-signup";
  let createdId = "";
  try {
    const requestHeaders = new Headers({
      "content-type": "application/json",
      origin: input.origin ?? env.BETTER_AUTH_URL,
    });
    if (input.clientIp) requestHeaders.set("x-real-ip", input.clientIp);
    const response = await auth.handler(new Request(new URL("/api/auth/sign-up/email", env.BETTER_AUTH_URL), {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ name: input.name, email: input.email, password: input.password, ...(input.phone ? { phone: input.phone } : {}) }),
    }));
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null) as { code?: unknown } | null;
      const authCode = typeof body?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(body.code) ? body.code : undefined;
      console.error("Admin account creation failed", { stage, httpStatus: response.status, ...(authCode ? { authCode } : {}) });
      throw new AdminUserCreationError("auth-rejected");
    }

    stage = "read-signup-user";
    const body = await response.json() as { user?: { id?: unknown } };
    const userId = body.user?.id;
    if (typeof userId !== "string" || !validId(userId)) throw new AdminUserCreationError("invalid-created-user");
    createdId = userId;

    stage = "resolve-role";
    const role = await prisma.role.findUnique({ where: { code: input.roleCode }, select: { id: true } });
    if (!role) throw new AdminUserCreationError("role-unavailable");

    stage = "assign-role-and-audit";
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: createdId } });
      await tx.userRole.create({ data: { userId: createdId, roleId: role.id } });
      await tx.session.deleteMany({ where: { userId: createdId } });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "user.create",
          resourceType: "user",
          resourceId: createdId,
          metadata: { roleCode: input.roleCode },
        },
      });
    });
    return { userId: createdId };
  } catch (error) {
    if (!(error instanceof AdminUserCreationError)) {
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
      console.error("Admin account creation failed", { stage, errorName: error instanceof Error ? error.name : "unknown", ...(code ? { code } : {}) });
    }
    if (createdId) await prisma.user.deleteMany({ where: { id: createdId } }).catch(() => undefined);
    throw error instanceof AdminUserCreationError ? error : new AdminUserCreationError("transaction-failed");
  }
}
