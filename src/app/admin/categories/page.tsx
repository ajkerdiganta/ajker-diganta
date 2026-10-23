import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";
import { TaxonomyManager } from "@/components/cms/taxonomy-manager";

export const metadata: Metadata = { title: "বিভাগ ও ট্যাগ | নিউজরুম" };
export const dynamic = "force-dynamic";
export default async function CategoriesPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "taxonomy.manage"))) notFound();
  const [categories, tags, canManageCategories] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }], include: { parent: { select: { id: true, name: true } }, _count: { select: { articles: true, children: true } } } }),
    prisma.tag.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } }, take: 500 }),
    hasPermission(principal.id, "category.manage"),
  ]);
  return <CmsFrame><TaxonomyManager categories={categories} tags={tags} canManageCategories={canManageCategories} /></CmsFrame>;
}
