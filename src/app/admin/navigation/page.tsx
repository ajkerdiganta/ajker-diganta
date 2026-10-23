import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";
import { NavigationManager } from "@/components/cms/navigation-manager";

export const metadata: Metadata = { title: "নেভিগেশন ব্যবস্থাপনা | নিউজরুম" };
export const dynamic = "force-dynamic";

export default async function NavigationPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "navigation.manage"))) notFound();

  const [menus, categories] = await Promise.all([
    prisma.navigationMenu.findMany({
      where: { isActive: true },
      orderBy: [{ location: "asc" }, { name: "asc" }],
      include: {
        items: {
          where: { isActive: true },
          orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true, parentId: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: 500,
    }),
  ]);

  return <CmsFrame><NavigationManager menus={menus} categories={categories} /></CmsFrame>;
}
