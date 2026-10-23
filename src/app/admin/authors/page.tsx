import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";
import { AuthorManager } from "@/components/cms/author-manager";

export const metadata: Metadata = { title: "লেখক ও প্রতিবেদক | নিউজরুম" };
export const dynamic = "force-dynamic";
export default async function AuthorsPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "author.manage"))) notFound();
  const authors = await prisma.author.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, title: true, bio: true, email: true, isActive: true, _count: { select: { articles: true } } } });
  return <CmsFrame><AuthorManager authors={authors} /></CmsFrame>;
}
