import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Plus, Search, FileText, ArrowUpRight } from "lucide-react";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { listArticles } from "@/lib/article-service";
import { CmsFrame } from "@/components/cms/cms-frame";

export const dynamic = "force-dynamic";
const labels: Record<string, string> = { DRAFT: "খসড়া", SUBMITTED: "জমা হয়েছে", UNDER_REVIEW: "পর্যালোচনা", APPROVED: "অনুমোদিত", REJECTED: "ফেরত", SCHEDULED: "নির্ধারিত", PUBLISHED: "প্রকাশিত", ARCHIVED: "সংরক্ষণাগার" };
const classes: Record<string, string> = { DRAFT: "bg-paper-100 text-ink-muted", SUBMITTED: "bg-blue-50 text-blue-800", UNDER_REVIEW: "bg-amber-50 text-amber-800", APPROVED: "bg-emerald-50 text-emerald-800", REJECTED: "bg-red-50 text-red-brand", SCHEDULED: "bg-indigo-50 text-indigo-800", PUBLISHED: "bg-green-50 text-green-800", ARCHIVED: "bg-slate-100 text-slate-700" };
const filters = ["ALL", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "SCHEDULED", "PUBLISHED", "ARCHIVED"];
type SearchParams = Promise<{ status?: string; q?: string; page?: string }>;
export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  const canReadAny = await hasPermission(principal.id, "article.read.any");
  if (!canReadAny && !(await hasPermission(principal.id, "article.read.own"))) notFound();
  const params = await searchParams;
  const status = filters.includes(params.status ?? "") && params.status !== "ALL" ? params.status as never : undefined;
  const articles = await listArticles(principal, { status, query: params.q, page: Number(params.page ?? 1) });
  return <CmsFrame><div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">নিউজরুম</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">সংবাদ</h1><p className="mt-1 text-sm text-ink-muted">{canReadAny ? "নিউজরুমের সকল সম্পাদনাযোগ্য সংবাদ" : "আপনার নিজের সংবাদ এবং খসড়া"}</p></div>{await hasPermission(principal.id, "article.create") && <Link href="/admin/articles/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white"><Plus size={16} />নতুন সংবাদ</Link>}</div>
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="অবস্থা অনুসারে ফিল্টার">{filters.map((filter) => <Link key={filter} href={`/admin/articles${filter === "ALL" ? "" : `?status=${filter}`}`} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${((params.status ?? "ALL") === filter) ? "bg-forest text-white" : "border border-line bg-white text-ink-muted hover:bg-paper-50"}`}>{filter === "ALL" ? "সব" : labels[filter]}</Link>)}</nav>
    <form className="flex max-w-lg items-center gap-2 rounded-xl border border-line bg-white px-3" action="/admin/articles"><Search size={16} className="text-ink-muted" /><input name="q" defaultValue={params.q} className="h-11 flex-1 bg-transparent text-sm outline-none" placeholder="বাংলা শিরোনাম বা স্লাগ খুঁজুন" />{params.status && <input type="hidden" name="status" value={params.status} />}<button className="text-xs font-bold text-forest">খুঁজুন</button></form>
    <section className="overflow-hidden rounded-2xl border border-line bg-white"><div className="border-b border-line px-4 py-3 text-xs font-semibold text-ink-muted">{articles.length.toLocaleString("bn-BD")}টি সংবাদ দেখানো হচ্ছে</div>
      {articles.length ? <div className="divide-y divide-line">{articles.map((item) => { const primaryAuthor = item.authors[0]?.author; const primaryCategory = item.categories[0]?.category; const image = item.media[0]?.media; return <Link key={item.id} href={`/admin/articles/${item.id}`} className="group flex gap-3 px-4 py-4 transition hover:bg-paper-50 sm:gap-4 sm:px-5">
        <div className="relative hidden size-16 shrink-0 overflow-hidden rounded-xl bg-paper-100 sm:block">{image && <Image src={`/api/media/${image.id}`} alt={image.altText ?? item.title} fill sizes="64px" unoptimized className="size-full object-cover" />}</div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="line-clamp-2 font-serif text-base font-bold text-ink group-hover:text-forest sm:text-lg">{item.title}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${classes[item.status] ?? "bg-paper-100"}`}>{labels[item.status] ?? item.status}</span>{item.isBreaking && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-brand">ব্রেকিং</span>}</div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted"><span>{primaryCategory?.name ?? "বিভাগ নেই"}</span><span>{primaryAuthor?.name ?? "লেখক নেই"}</span><span>সংস্করণ {item.revisionNumber.toLocaleString("bn-BD")}</span><span>সংশোধন {new Date(item.updatedAt).toLocaleDateString("bn-BD")}</span>{item.scheduledAt && <span>প্রকাশ {new Date(item.scheduledAt).toLocaleString("bn-BD", { dateStyle: "short", timeStyle: "short" })}</span>}</div></div><ArrowUpRight size={16} className="mt-1 shrink-0 text-ink-muted" />
      </Link>; })}</div> : <div className="grid min-h-56 place-items-center px-6 text-center"><div><FileText size={30} className="mx-auto text-ink-muted/60" /><p className="mt-3 font-semibold text-ink">এই ফিল্টারে কোনো সংবাদ নেই</p><p className="mt-1 text-xs text-ink-muted">নতুন বাংলা খসড়া তৈরি করে শুরু করুন।</p></div></div>}
    </section>
    <p className="text-xs leading-5 text-ink-muted">এই তালিকা শুধু অনুমোদিত newsroom account-এ দৃশ্যমান। প্রকাশিত URL ও public article page Phase 3-এর জন্য সংরক্ষিত।</p>
  </div></CmsFrame>;
}
