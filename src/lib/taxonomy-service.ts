import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auditCms } from "@/lib/cms-audit";
import { asciiSlug, uniqueSlug } from "@/lib/slug";
import { CmsServiceError } from "@/lib/article-service";
import type { z } from "zod";
import { categorySchema, tagSchema, authorSchema } from "@/lib/cms-schemas";

type CategoryInput = z.infer<typeof categorySchema>;
type TagInput = z.infer<typeof tagSchema>;
type AuthorInput = z.infer<typeof authorSchema>;

type Actor = { id: string };

function conflictMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return new CmsServiceError(409, "এই নাম বা স্লাগ আগে থেকেই ব্যবহৃত");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return new CmsServiceError(409, "এই তথ্যটি অন্য সংবাদে ব্যবহৃত হচ্ছে");
  return error;
}

export async function listCategories() {
  return prisma.category.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { parent: { select: { id: true, name: true } }, _count: { select: { articles: true, children: true } } } });
}
export async function listTags(query?: string) {
  const q = query?.normalize("NFC").trim().slice(0, 80);
  return prisma.tag.findMany({ where: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q } }] } : {}) }, orderBy: { name: "asc" }, take: 200, include: { _count: { select: { articles: true } } } });
}
export async function listAuthors(query?: string, includeEmail = false) {
  const q = query?.normalize("NFC").trim().slice(0, 100);
  return prisma.author.findMany({ where: { deletedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) }, orderBy: { name: "asc" }, take: 200, select: { id: true, userId: true, slug: true, name: true, title: true, bio: true, ...(includeEmail ? { email: true } : {}), isActive: true, createdAt: true, updatedAt: true, _count: { select: { articles: true } } } });
}

export async function createCategory(input: CategoryInput, actor: Actor) {
  if (input.parentId) {
    const parent = await prisma.category.findFirst({ where: { id: input.parentId, deletedAt: null, isActive: true }, select: { id: true, parentId: true } });
    if (!parent) throw new CmsServiceError(400, "মূল বিভাগ সক্রিয় থাকতে হবে");
    if (parent.parentId) throw new CmsServiceError(400, "বিভাগের সর্বোচ্চ দুটি স্তর রাখা যাবে");
  }
  const slug = input.slug ?? await uniqueSlug(input.name, (candidate) => prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean));
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.category.create({ data: { ...input, slug, deletedAt: null } });
      await auditCms(tx, { actorId: actor.id, action: "category.create", resourceType: "Category", resourceId: row.id });
      return row;
    });
  } catch (error) { throw conflictMessage(error); }
}
export async function updateCategory(id: string, input: CategoryInput, actor: Actor) {
  const previous = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new CmsServiceError(404, "বিভাগ পাওয়া যায়নি");
  if (input.parentId === id) throw new CmsServiceError(400, "বিভাগ নিজেকেই মূল বিভাগ হিসেবে পেতে পারে না");
  if (input.parentId) {
    const parent = await prisma.category.findFirst({ where: { id: input.parentId, deletedAt: null }, select: { id: true, parentId: true } });
    if (!parent || parent.parentId) throw new CmsServiceError(400, "বিভাগের সর্বোচ্চ দুটি স্তর রাখা যাবে");
  }
  const slug = input.slug ?? (input.name === previous.name ? previous.slug : await uniqueSlug(input.name, (candidate) => prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } }).then((row) => Boolean(row && row.id !== id))));
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.category.update({ where: { id }, data: { ...input, slug, deletedAt: null } });
      if (row.isActive) {
        await tx.navigationMenuItem.updateMany({ where: { categoryId: id, isActive: true }, data: { href: `/category/${row.slug}` } });
      } else {
        await tx.navigationMenuItem.updateMany({ where: { categoryId: id, isActive: true }, data: { isActive: false } });
      }
      await auditCms(tx, { actorId: actor.id, action: "category.update", resourceType: "Category", resourceId: id });
      return row;
    });
  } catch (error) { throw conflictMessage(error); }
}
export async function removeCategory(id: string, actor: Actor) {
  const used = await prisma.articleCategory.count({ where: { categoryId: id } });
  const children = await prisma.category.count({ where: { parentId: id, deletedAt: null } });
  if (used || children) throw new CmsServiceError(409, "সংবাদ বা উপবিভাগে ব্যবহৃত বিভাগ অপসারণ করা যাবে না");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await tx.navigationMenuItem.updateMany({ where: { categoryId: id, isActive: true }, data: { isActive: false } });
      await auditCms(tx, { actorId: actor.id, action: "category.delete", resourceType: "Category", resourceId: id });
    });
  } catch (error) { throw conflictMessage(error); }
}

export async function createTag(input: TagInput, actor: Actor) {
  const normalizedName = input.name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("bn-BD");
  if (await prisma.tag.findUnique({ where: { normalizedName }, select: { id: true } })) throw new CmsServiceError(409, "এই স্বাভাবিকীকৃত নামে ট্যাগ আগে থেকেই আছে");
  const slug = input.slug ?? await uniqueSlug(input.name, (candidate) => prisma.tag.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean));
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.tag.create({ data: { name: input.name, normalizedName, slug } });
      await auditCms(tx, { actorId: actor.id, action: "tag.create", resourceType: "Tag", resourceId: row.id });
      return row;
    });
  } catch (error) { throw conflictMessage(error); }
}
export async function updateTag(id: string, input: TagInput, actor: Actor) {
  const previous = await prisma.tag.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new CmsServiceError(404, "ট্যাগ পাওয়া যায়নি");
  const normalizedName = input.name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("bn-BD");
  const duplicate = await prisma.tag.findUnique({ where: { normalizedName }, select: { id: true } });
  if (duplicate && duplicate.id !== id) throw new CmsServiceError(409, "এই স্বাভাবিকীকৃত নামে ট্যাগ আগে থেকেই আছে");
  const slug = input.slug ?? (input.name === previous.name ? previous.slug : await uniqueSlug(input.name, (candidate) => prisma.tag.findUnique({ where: { slug: candidate }, select: { id: true } }).then((row) => Boolean(row && row.id !== id))));
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.tag.update({ where: { id }, data: { name: input.name, normalizedName, slug } });
      await auditCms(tx, { actorId: actor.id, action: "tag.update", resourceType: "Tag", resourceId: id });
      return row;
    });
  } catch (error) { throw conflictMessage(error); }
}
export async function removeTag(id: string, actor: Actor) {
  if (await prisma.articleTag.count({ where: { tagId: id } })) throw new CmsServiceError(409, "সংবাদে ব্যবহৃত ট্যাগ অপসারণ করা যাবে না");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.tag.update({ where: { id }, data: { deletedAt: new Date() } });
      await auditCms(tx, { actorId: actor.id, action: "tag.delete", resourceType: "Tag", resourceId: id });
    });
  } catch (error) { throw conflictMessage(error); }
}

export async function createAuthor(input: AuthorInput, actor: Actor) {
  const slug = input.slug ?? await uniqueSlug(input.name, (candidate) => prisma.author.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean));
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.author.create({ data: { ...input, slug, deletedAt: null } });
      await auditCms(tx, { actorId: actor.id, action: "author.create", resourceType: "Author", resourceId: row.id });
      return row;
    });
  } catch (error) { throw conflictMessage(error); }
}
export async function updateAuthor(id: string, input: AuthorInput, actor: Actor) {
  const previous = await prisma.author.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new CmsServiceError(404, "লেখক পাওয়া যায়নি");
  const slug = input.slug ?? (input.name === previous.name ? previous.slug : await uniqueSlug(input.name, (candidate) => prisma.author.findUnique({ where: { slug: candidate }, select: { id: true } }).then((row) => Boolean(row && row.id !== id))));
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.author.update({ where: { id }, data: { ...input, slug } });
      await auditCms(tx, { actorId: actor.id, action: "author.update", resourceType: "Author", resourceId: id });
      return row;
    });
  } catch (error) { throw conflictMessage(error); }
}
export async function removeAuthor(id: string, actor: Actor) {
  if (await prisma.articleAuthor.count({ where: { authorId: id } })) throw new CmsServiceError(409, "সংবাদে ব্যবহৃত লেখককে অপসারণ করা যাবে না");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.author.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await auditCms(tx, { actorId: actor.id, action: "author.delete", resourceType: "Author", resourceId: id });
    });
  } catch (error) { throw conflictMessage(error); }
}

export function suggestedSlug(value: string) { return asciiSlug(value); }
