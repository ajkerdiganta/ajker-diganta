import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowUpRight, ClipboardCheck, FileText, Image as ImageIcon, Plus, Tags, Clapperboard, ChartNoAxesCombined } from "lucide-react";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";

export const metadata: Metadata = { title: "নিউজরুম | দৈনিক আজকের দিগন্ত" };
export const dynamic = "force-dynamic";
const statuses = [["DRAFT", "খসড়া"], ["SUBMITTED", "জমা"], ["UNDER_REVIEW", "পর্যালোচনা"], ["APPROVED", "অনুমোদিত"], ["SCHEDULED", "নির্ধারিত"], ["PUBLISHED", "প্রকাশিত"]] as const;

export default async function AdminPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "admin.access"))) redirect("/forbidden");
  const canReadAny = await hasPermission(principal.id, "article.read.any");
  const scope = { deletedAt: null, ...(canReadAny ? {} : { createdById: principal.id }) };
  const [counts, total, categoryCount, tagCount, mediaCount, canReview] = await Promise.all([
    Promise.all(statuses.map(async ([status, label]) => ({ status, label, count: await prisma.article.count({ where: { ...scope, status } }) }))),
    prisma.article.count({ where: scope }),
    prisma.category.count({ where: { deletedAt: null, isActive: true } }),
    prisma.tag.count({ where: { deletedAt: null } }),
    prisma.media.count({ where: { deletedAt: null, status: "VERIFIED" } }),
    hasPermission(principal.id, "article.review"),
  ]);
  return <CmsFrame><div className="space-y-7">
    <section className="relative overflow-hidden rounded-3xl bg-forest px-6 py-7 text-white sm:px-9 sm:py-9"><div className="absolute -right-8 -top-20 size-72 rounded-full border border-white/10" /><div className="absolute right-10 top-14 size-36 rounded-full border border-white/10" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">দৈনিক আজকের দিগন্ত · CMS</p><h1 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">নিউজরুম</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">বাংলা সংবাদের খসড়া, সম্পাদনা ও প্রকাশনা—একটি সার্ভার-সুরক্ষিত কর্মপ্রবাহে।</p>{await hasPermission(principal.id, "article.create") && <Link href="/admin/articles/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-paper-100 px-4 py-2.5 text-sm font-bold text-forest hover:bg-white"><Plus size={17} />নতুন সংবাদ লিখুন</Link>}</div></section>
    <section><div className="mb-3 flex items-end justify-between"><div><h2 className="font-serif text-xl font-bold text-ink">সম্পাদনার অবস্থা</h2><p className="mt-1 text-xs text-ink-muted">{canReadAny ? "নিউজরুমের সংবাদ" : "আপনার নিজের সংবাদ"} · মোট {total.toLocaleString("bn-BD")}</p></div><Link href="/admin/articles" className="inline-flex items-center gap-1 text-xs font-semibold text-forest">সব সংবাদ <ArrowUpRight size={14} /></Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{counts.map(({ status, label, count }) => <Link key={status} href={`/admin/articles?status=${status}`} className="rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"><span className="rounded-full bg-paper-100 px-2.5 py-1 text-[10px] font-bold text-ink-muted">{label}</span><p className="mt-3 font-serif text-3xl font-bold text-ink">{count.toLocaleString("bn-BD")}</p><p className="mt-1 text-[11px] text-ink-muted">সংবাদ</p></Link>)}</div></section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Link href="/admin/articles" className="rounded-2xl border border-line bg-white p-5 transition hover:shadow-md"><FileText size={20} className="text-forest" /><h3 className="mt-3 font-serif text-lg font-bold">সংবাদ তালিকা</h3><p className="mt-1 text-sm leading-6 text-ink-muted">খসড়া, সম্পাদনা, নির্ধারিত প্রকাশ ও সংরক্ষণাগার।</p></Link>{canReview && <Link href="/admin/review" className="rounded-2xl border border-line bg-white p-5 transition hover:shadow-md"><ClipboardCheck size={20} className="text-amber-700" /><h3 className="mt-3 font-serif text-lg font-bold">সম্পাদনা ডেস্ক</h3><p className="mt-1 text-sm leading-6 text-ink-muted">জমা পড়া প্রতিবেদন পর্যালোচনা ও সিদ্ধান্ত।</p></Link>}{await hasPermission(principal.id, "analytics.read") && <Link href="/admin/analytics" className="rounded-2xl border border-line bg-white p-5 transition hover:shadow-md"><ChartNoAxesCombined size={20} className="text-forest" /><h3 className="mt-3 font-serif text-lg font-bold">অ্যাডমিন পরিসংখ্যান</h3><p className="mt-1 text-sm leading-6 text-ink-muted">সংবাদ, ভিডিও, পাঠক ও জনপ্রিয়তার সারাংশ।</p></Link>}<Link href="/admin/media" className="rounded-2xl border border-line bg-white p-5 transition hover:shadow-md"><ImageIcon size={20} className="text-blue-700" /><h3 className="mt-3 font-serif text-lg font-bold">মিডিয়া লাইব্রেরি</h3><p className="mt-1 text-sm leading-6 text-ink-muted">নিরাপদ ছবি, বাংলা ক্যাপশন ও বিকল্প লেখা।</p></Link>{((await hasPermission(principal.id, "video.read.own")) || (await hasPermission(principal.id, "video.read.any"))) && <Link href="/admin/videos" className="rounded-2xl border border-line bg-white p-5 transition hover:shadow-md"><Clapperboard size={20} className="text-red-brand" /><h3 className="mt-3 font-serif text-lg font-bold">ভিডিও newsroom</h3><p className="mt-1 text-sm leading-6 text-ink-muted">বাংলা মেটাডেটা, সম্পর্কিত সংবাদ ও ভিডিও প্রকাশনা workflow।</p></Link>}</section>
    {await hasPermission(principal.id, "cms.read") && <section className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center gap-2"><Tags size={17} className="text-forest" /><h2 className="font-serif font-bold">সম্পাদকীয় সম্পদ</h2></div><div className="mt-4 grid grid-cols-3 divide-x divide-line"><p><b className="text-2xl">{categoryCount.toLocaleString("bn-BD")}</b><span className="block text-xs text-ink-muted">বিভাগ</span></p><p className="pl-4"><b className="text-2xl">{tagCount.toLocaleString("bn-BD")}</b><span className="block text-xs text-ink-muted">ট্যাগ</span></p><p className="pl-4"><b className="text-2xl">{mediaCount.toLocaleString("bn-BD")}</b><span className="block text-xs text-ink-muted">যাচাইকৃত মিডিয়া</span></p></div></section>}
    <p className="text-xs leading-5 text-ink-muted">সংবাদ ও ভিডিও newsroom workflow-এর মাধ্যমে প্রকাশিত public URL, sitemap, অনুসন্ধান ও পাঠক-ব্যক্তিগতকরণে যুক্ত হয়।</p>
  </div></CmsFrame>;
}
