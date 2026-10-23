import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, ClipboardCheck } from "lucide-react";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";

export const metadata: Metadata = { title: "সম্পাদনা ডেস্ক | নিউজরুম" };
export const dynamic = "force-dynamic";
export default async function ReviewPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "article.review"))) notFound();
  const items = await prisma.article.findMany({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, deletedAt: null }, orderBy: [{ status: "asc" }, { updatedAt: "asc" }], take: 100, select: { id: true, title: true, excerpt: true, status: true, updatedAt: true, createdBy: { select: { name: true } }, categories: { where: { isPrimary: true }, include: { category: { select: { name: true } } } }, authors: { where: { isPrimary: true }, include: { author: { select: { name: true } } } } } });
  return <CmsFrame><div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">সম্পাদকীয় কর্মপ্রবাহ</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">সম্পাদনা ডেস্ক</h1><p className="mt-1 text-sm text-ink-muted">জমা পড়া সংবাদ: পর্যালোচনা → অনুমোদন অথবা কারণসহ ফেরত</p></div>
    {items.length ? <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{items.map((item) => <Link key={item.id} href={`/admin/articles/${item.id}`} className="group flex items-start gap-3 px-4 py-4 hover:bg-paper-50 sm:px-5"><span className={`mt-1 rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "SUBMITTED" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{item.status === "SUBMITTED" ? "জমা হয়েছে" : "পর্যালোচনাধীন"}</span><div className="min-w-0 flex-1"><h2 className="font-serif text-lg font-bold group-hover:text-forest">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm text-ink-muted">{item.excerpt || "সারাংশ দেওয়া হয়নি"}</p><p className="mt-2 text-[11px] text-ink-muted">প্রতিবেদক: {item.createdBy.name} · বাইলাইন: {item.authors[0]?.author.name ?? "নেই"} · {item.categories[0]?.category.name ?? "বিভাগ নেই"} · জমা: {new Date(item.updatedAt).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })}</p></div><ArrowUpRight size={16} className="mt-1 text-ink-muted" /></Link>)}</div> : <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center"><ClipboardCheck size={28} className="mx-auto text-forest" /><p className="mt-3 font-semibold">পর্যালোচনার জন্য কোনো সংবাদ নেই</p><p className="mt-1 text-sm text-ink-muted">প্রতিবেদকেরা জমা দিলে এখানে দেখাবে।</p></div>}
  </div></CmsFrame>;
}
