import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditCms } from "@/lib/cms-audit";
import { CmsServiceError } from "@/lib/article-service";
import { navigationItemSchema } from "@/lib/cms-schemas";

type Input = z.infer<typeof navigationItemSchema>;
type Actor = { id: string };

export async function listNavigationMenus() {
  return prisma.navigationMenu.findMany({
    where: { isActive: true },
    orderBy: [{ location: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
}

function normalizeDatabaseConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new CmsServiceError(409, "এই নেভিগেশন আইটেমটি সংরক্ষণ করা যায়নি; তথ্যটি আগে থেকেই ব্যবহৃত");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw new CmsServiceError(409, "মেনু বা সংযুক্ত বিভাগটি আর বৈধ নেই");
  }
  throw error;
}

async function validateRelations(input: Input, currentId?: string) {
  const menu = await prisma.navigationMenu.findFirst({ where: { id: input.menuId, isActive: true }, select: { id: true } });
  if (!menu) throw new CmsServiceError(400, "সক্রিয় নেভিগেশন মেনু নির্বাচন করুন");

  if (input.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, isActive: true, deletedAt: null }, select: { id: true } });
    if (!category) throw new CmsServiceError(400, "সক্রিয় বিভাগ নির্বাচন করুন");
  }

  if (!input.parentId) return;
  if (input.parentId === currentId) throw new CmsServiceError(400, "মেনু আইটেম নিজেকেই parent হিসেবে পেতে পারে না");
  const parent = await prisma.navigationMenuItem.findFirst({
    where: { id: input.parentId, isActive: true },
    select: { id: true, menuId: true, parentId: true },
  });
  if (!parent || parent.menuId !== input.menuId) throw new CmsServiceError(400, "parent একই মেনুর সক্রিয় মূল আইটেম হতে হবে");
  if (parent.parentId) throw new CmsServiceError(400, "মেনুর সর্বোচ্চ দুটি স্তর রাখা যাবে");
  if (currentId) {
    const child = await prisma.navigationMenuItem.findFirst({ where: { parentId: currentId, isActive: true }, select: { id: true } });
    if (child) throw new CmsServiceError(400, "উপ-আইটেম থাকা অবস্থায় এই আইটেমকে আরেকটি স্তরের নিচে নেওয়া যাবে না");
  }
}

export async function createNavigationItem(input: Input, actor: Actor) {
  await validateRelations(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.navigationMenuItem.create({ data: input });
      await auditCms(tx, { actorId: actor.id, action: "navigation.create", resourceType: "NavigationMenuItem", resourceId: item.id });
      return item;
    });
  } catch (error) {
    normalizeDatabaseConflict(error);
  }
}

export async function updateNavigationItem(id: string, input: Input, actor: Actor) {
  const existing = await prisma.navigationMenuItem.findFirst({
    where: { id, isActive: true },
    select: { id: true, menuId: true, parentId: true, _count: { select: { children: true } } },
  });
  if (!existing) throw new CmsServiceError(404, "মেনু আইটেম পাওয়া যায়নি");
  if (existing._count.children > 0 && (input.parentId !== null || input.menuId !== existing.menuId)) {
    throw new CmsServiceError(400, "উপ-আইটেম থাকা অবস্থায় মূল আইটেমের স্তর বা মেনু বদলানো যাবে না");
  }
  await validateRelations(input, id);
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.navigationMenuItem.update({ where: { id }, data: input });
      await auditCms(tx, { actorId: actor.id, action: "navigation.update", resourceType: "NavigationMenuItem", resourceId: id });
      return item;
    });
  } catch (error) {
    normalizeDatabaseConflict(error);
  }
}

export async function removeNavigationItem(id: string, actor: Actor) {
  const existing = await prisma.navigationMenuItem.findFirst({ where: { id, isActive: true }, select: { id: true } });
  if (!existing) throw new CmsServiceError(404, "মেনু আইটেম পাওয়া যায়নি");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.navigationMenuItem.updateMany({ where: { OR: [{ id }, { parentId: id }], isActive: true }, data: { isActive: false } });
      await auditCms(tx, { actorId: actor.id, action: "navigation.delete", resourceType: "NavigationMenuItem", resourceId: id });
    });
  } catch (error) {
    normalizeDatabaseConflict(error);
  }
}
