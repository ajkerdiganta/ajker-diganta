import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { VideoManager } from "@/components/cms/video-manager";
import { CmsFrame } from "@/components/cms/cms-frame";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getVideoPermissions } from "@/lib/video-service";

export const metadata: Metadata = { title: "নতুন ভিডিও | নিউজরুম" };
export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "video.create"))) notFound();
  const [categories, tags, authors, relatedArticles, permissions] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.tag.findMany({ where: { deletedAt: null }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
    prisma.author.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.article.findMany({ where: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null }, select: { id: true, title: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 100 }),
    getVideoPermissions(principal.id),
  ]);
  return <CmsFrame><VideoManager videos={[]} categories={categories} tags={tags} authors={authors} relatedArticles={relatedArticles} permissions={permissions} actorId={principal.id}/></CmsFrame>;
}
