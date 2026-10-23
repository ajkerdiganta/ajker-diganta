import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, ArrowUpRight } from "lucide-react";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";

export const metadata: Metadata = { title: "নির্ধারিত প্রকাশ | নিউজরুম" };
export const dynamic = "force-dynamic";
export default async function ScheduledPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  if (!(await hasPermission(principal.id, "article.schedule"))) notFound();
  const items = await prisma.article.findMany({ where: { status: "SCHEDULED", deletedAt: null }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: 150, select: { id: true, title: true, slug: true, scheduledAt: true, revisionNumber: true, approvedRevisionNumber: true, approvedBy: { select: { name: true } }, authors: { where: { isPrimary: true }, include: { author: { select: { name: true } } } } } });
  return <CmsFrame><div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">সময়সূচি</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">নির্ধারিত প্রকাশ</h1><p className="mt-1 text-sm text-ink-muted">প্রকাশ কেবল সেই অনুমোদিত revision-ই করে, যেটি সম্পাদক অনুমোদন করেছিলেন।</p></div>
    {items.length ? <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{items.map((item) => { const valid = item.approvedRevisionNumber === item.revisionNumber; return <Link key={item.id} href={`/admin/articles/${item.id}`} className="group flex items-start gap-3 px-4 py-4 hover:bg-paper-50 sm:px-5"><span className={`mt-1 rounded-full px-2 py-1 text-[10px] font-bold ${valid ? "bg-indigo-50 text-indigo-800" : "bg-red-50 text-red-brand"}`}>{valid ? "নির্ধারিত" : "পুনরায় পর্যালোচনা"}</span><div className="min-w-0 flex-1"><h2 className="font-serif text-lg font-bold group-hover:text-forest">{item.title}</h2><p className="mt-1 text-xs text-ink-muted">প্রকাশ: {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("bn-BD", { dateStyle: "full", timeStyle: "short" }) : "সময় দেওয়া নেই"} · সংস্করণ {item.revisionNumber} / অনুমোদিত {item.approvedRevisionNumber ?? "—"} · অনুমোদন: {item.approvedBy?.name ?? "—"}</p></div><ArrowUpRight size={16} className="mt-1 text-ink-muted" /></Link>; })}</div> : <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center"><CalendarClock size={28} className="mx-auto text-forest" /><p className="mt-3 font-semibold">কোনো সংবাদ নির্ধারিত নেই</p><p className="mt-1 text-sm text-ink-muted">অনুমোদনের পরে সংবাদ প্রকাশের সময় ঠিক করতে পারবেন।</p></div>}
  </div></CmsFrame>;
}
