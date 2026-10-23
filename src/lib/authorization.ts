import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "@/generated/prisma/enums";

export async function getPrincipal(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deletedAt: true,
      roleAssignments: {
        select: {
          role: {
            select: {
              code: true,
              permissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;

  const assignments = user.roleAssignments as Array<{
    role: { code: RoleCode; permissions: Array<{ permission: { code: string } }> };
  }>;
  const roles: RoleCode[] = assignments.map(({ role }) => role.code);
  const permissions = new Set(
    assignments.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)),
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
    permissions,
    isSuperAdmin: roles.includes("SUPER_ADMIN"),
  };
}

export async function hasPermission(principalId: string, permissionCode: string): Promise<boolean> {
  const assignments = await prisma.userRole.findMany({
    where: {
      userId: principalId,
      user: { status: "ACTIVE", deletedAt: null },
      role: {
        OR: [
          { code: "SUPER_ADMIN" },
          { permissions: { some: { permission: { code: permissionCode } } } },
        ],
      },
    },
    select: { userId: true },
    take: 1,
  });
  return assignments.length > 0;
}
