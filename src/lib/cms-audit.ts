import type { Prisma } from "@/generated/prisma/client";

export async function auditCms(
  tx: Prisma.TransactionClient,
  input: { actorId: string; action: string; resourceType: string; resourceId?: string; requestId?: string; metadata?: Record<string, unknown> },
) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      requestId: input.requestId,
      metadata: input.metadata as object | undefined,
    },
  });
}
