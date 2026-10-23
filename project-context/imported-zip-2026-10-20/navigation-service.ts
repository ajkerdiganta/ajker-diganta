import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auditCms } from "@/lib/cms-audit";
import { CmsServiceError } from "@/lib/article-service";
import type { z } from "zod";
import { navigationItemSchema } from "@/lib/cms-schemas";

type Input = z.infer<typeof navigationItemSchema>;
type Actor = { id: string };

export async function listNavigationMenus() {
  return prisma.navigationMenu.findMany({
    where: { isActive: true },
    orderBy: { location: "asc" },
    include: { items: { where: { isActive: true }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }], include: { category: { select: { id: true, name: true, slug: true } } } } },
  });
}

function conflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new CmsServiceError(409, "এই মেনু আইটেমটি আগে থেকেই ব্যবহৃত");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new CmsServiceError(409, "মেনু বা বিভাগটি আর বৈধ নেই");
  throw error;
}

async function validateParent(input: Input, id?: string) {
  if (!input.parentId) return;
  if (input.parentId === id) throw new CmsServiceError(400, "মেনু আইটেম নিজেকেই parent হিসেবে পেতে পারে না");
  const parent = await prisma.navigationMenuItem.findUnique({ where: { id: input.parentId }, select: { id: true, menuId: true, parentId: true } });
  if (!parent || parent.menuId !== input.menuId) throw new CmsServiceError(400, "parent মেনু আইটেমটি একই মেনুর হতে হবে");
  if (parent.parentId) throw new CmsServiceError(400, "মেনুর সর্বোচ্চ দুটি স্তর রাখা যাবে");
}

export async function createNavigationItem(input: Input, actor: Actor) {
  const menu = await prisma.navigationMenu.findUnique({ where: { id: input.menuId }, select: { id: true, isActive: true } });
  if (!menu?.isActive) throw new CmsServiceError(400, "মেনুটি সক্রিয় নয়");
  await validateParent(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.navigationMenuItem.create({ data: input });
      await auditCms(tx, { actorId: actor.id, action: "navigation.create", resourceType: "NavigationMenuItem", resourceId: row.id });
      return row;
    });
  } catch (error) { conflict(error); }
}

export async function updateNavigationItem(id: string, input: Input, actor: Actor) {
  const existing = await prisma.navigationMenuItem.findFirst({ where: { id, isActive: true } });
  if (!existing) throw new CmsServiceError(404, "মেনু আইটেম পাওয়া যায়নি");
  await validateParent(input, id);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.navigationMenuItem.update({ where: { id }, data: input });
      await auditCms(tx, { actorId: actor.id, action: "navigation.update", resourceType: "NavigationMenuItem", resourceId: id });
      return row;
    });
  } catch (error) { conflict(error); }
}

export async function removeNavigationItem(id: string, actor: Actor) {
  const existing = await prisma.navigationMenuItem.findFirst({ where: { id, isActive: true } });
  if (!existing) throw new CmsServiceError(404, "মেনু আইটেম পাওয়া যায়নি");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.navigationMenuItem.update({ where: { id }, data: { isActive: false } });
      await tx.navigationMenuItem.updateMany({ where: { parentId: id }, data: { isActive: false } });
      await auditCms(tx, { actorId: actor.id, action: "navigation.delete", resourceType: "NavigationMenuItem", resourceId: id });
    });
  } catch (error) { conflict(error); }
}
