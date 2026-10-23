import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { getArticleForActor } from "@/lib/article-service";
import { loadArticleEditorOptions } from "@/lib/cms-workspace";
import { CmsFrame } from "@/components/cms/cms-frame";
import { ArticleEditorForm } from "@/components/cms/article-editor-form";

export const metadata: Metadata = { title: "সংবাদ সম্পাদনা | নিউজরুম" };
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export default async function ArticlePage({ params }: Context) {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "article.read.any")) && !(await hasPermission(principal.id, "article.read.own"))) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [article, options] = await Promise.all([getArticleForActor(id, principal), loadArticleEditorOptions(principal, id)]);
  if (!article) notFound();
  const safeArticle = JSON.parse(JSON.stringify(article, (_key, value: unknown) => typeof value === "bigint" ? Number(value) : value));
  return <CmsFrame><ArticleEditorForm {...options} article={safeArticle} roles={principal.roles} /></CmsFrame>;
}
