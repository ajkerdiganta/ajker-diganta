import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { CmsFrame } from "@/components/cms/cms-frame";
import { ArticleEditorForm } from "@/components/cms/article-editor-form";
import { loadArticleEditorOptions } from "@/lib/cms-workspace";

export const metadata: Metadata = { title: "নতুন সংবাদ | নিউজরুম" };
export const dynamic = "force-dynamic";
export default async function NewArticlePage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "article.create"))) notFound();
  const options = await loadArticleEditorOptions(principal);
  return <CmsFrame><ArticleEditorForm {...options} roles={principal.roles} /></CmsFrame>;
}
