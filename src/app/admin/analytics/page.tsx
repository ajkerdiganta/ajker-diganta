import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Bookmark, ChartNoAxesCombined, Clapperboard, Eye, FileText, Heart, Newspaper, UsersRound } from "lucide-react";
import { headers } from "next/headers";
import { CmsFrame } from "@/components/cms/cms-frame";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { getAdminAnalytics, type PopularAnalyticsItem, type PopularCategoryItem } from "@/lib/admin-analytics";

export const metadata: Metadata = { title: "অ্যাডমিন পরিসংখ্যান | দৈনিক আজকের দিগন্ত" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const count = (value: number | string) => typeof value === "number" ? value.toLocaleString("bn-BD") : BigInt(value).toLocaleString("bn-BD");
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function PopularList({ title, items, kind }: { title: string; items: PopularAnalyticsItem[] | PopularCategoryItem[]; kind: "article" | "video" | "category" }) {
  const label = kind === "category" ? "সংবাদ বিভাগ" : kind === "video" ? "ভিডিও" : "সংবাদ";
  return <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-serif text-lg font-bold text-ink">{title}</h2><span className="rounded-full bg-paper-100 px-2.5 py-1 text-[11px] font-semibold text-ink-muted">শীর্ষ ৫</span></div>
    {items.length ? <ol className="divide-y divide-line">{items.map((item, index) => <li key={item.slug} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-paper-100 text-xs font-bold text-forest">{(index + 1).toLocaleString("bn-BD")}</span><div className="min-w-0 flex-1"><Link className="line-clamp-2 text-sm font-semibold leading-6 text-ink hover:text-forest" href={kind === "article" ? `/news/${item.slug}` : kind === "video" ? `/video/${item.slug}` : `/category/${item.slug}`}>{kind === "category" ? (item as PopularCategoryItem).name : (item as PopularAnalyticsItem).title}</Link><p className="mt-1 text-xs text-ink-muted">{count(item.views)} ভিউ</p></div><span className="sr-only">{label}</span></li>)}</ol> : <p className="rounded-xl border border-dashed border-line bg-paper-50 px-4 py-5 text-sm leading-6 text-ink-muted">এই সময়সীমায় কোনো {label} ভিউ নেই।</p>}
  </section>;
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) notFound();
  if (!(await hasPermission(principal.id, "analytics.read"))) notFound();

  const params = await searchParams;
  let analytics;
  try {
    analytics = await getAdminAnalytics({ period: first(params.period), from: first(params.from), to: first(params.to) });
  } catch (error) {
    console.error("[AdminAnalyticsPage] Failed to load aggregate analytics", error instanceof Error ? error.name : "unknown error");
    return <CmsFrame><section className="rounded-2xl border border-red-200 bg-white p-7" role="alert"><h1 className="font-serif text-2xl font-bold text-ink">পরিসংখ্যান লোড করা যায়নি</h1><p className="mt-2 text-sm leading-7 text-ink-muted">এই মুহূর্তে তথ্য পাওয়া যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।</p><Link href="/admin" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest">নিউজরুমে ফিরুন <ArrowUpRight size={15} /></Link></section></CmsFrame>;
  }

  const cards = [
    { label: "মোট সংবাদ", value: analytics.totalArticles, icon: Newspaper, note: "মুছে ফেলা সংবাদ বাদে" },
    { label: "প্রকাশিত সংবাদ", value: analytics.publishedArticles, icon: FileText, note: "বর্তমানে প্রকাশিত" },
    { label: "খসড়া", value: analytics.draftArticles, icon: FileText, note: "সম্পাদনাধীন" },
    { label: "পর্যালোচনার অপেক্ষায়", value: analytics.pendingReviewArticles, icon: FileText, note: "জমা ও পর্যালোচনায়" },
    { label: "মোট ভিডিও", value: analytics.totalVideos, icon: Clapperboard, note: "মুছে ফেলা ভিডিও বাদে" },
    { label: "সক্রিয় ব্যবহারকারী", value: analytics.totalUsers, icon: UsersRound, note: "বর্তমান সক্রিয় অ্যাকাউন্ট" },
    { label: "নতুন ব্যবহারকারী", value: analytics.newUsers, icon: UsersRound, note: "নির্বাচিত সময়ে যোগ দিয়েছেন" },
    { label: "সংবাদ ভিউ", value: analytics.articleViews, icon: Eye, note: "নির্বাচিত সময়সীমা" },
    { label: "ভিডিও ভিউ", value: analytics.videoViews, icon: Eye, note: "নির্বাচিত সময়সীমা" },
    { label: "সংরক্ষিত সংবাদ", value: analytics.savedArticles, icon: Bookmark, note: "এই সময়ে সংরক্ষণ করা হয়েছে" },
    { label: "পছন্দের সংবাদ", value: analytics.favouriteArticles, icon: Heart, note: "এই সময়ে পছন্দ করা হয়েছে" },
  ];

  return <CmsFrame><div className="space-y-7">
    <header className="relative overflow-hidden rounded-3xl bg-forest px-6 py-7 text-white sm:px-9 sm:py-9"><div className="absolute -right-10 -top-24 size-72 rounded-full border border-white/10" /><div className="relative"><p className="text-xs font-bold tracking-[0.18em] text-white/65">দৈনিক আজকের দিগন্ত · ADMIN</p><div className="mt-3 flex items-center gap-3"><ChartNoAxesCombined size={28} /><h1 className="font-serif text-3xl font-bold sm:text-4xl">অ্যাডমিন পরিসংখ্যান</h1></div><p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">নিউজরুমের সারসংক্ষেপ, পাঠ-ভিউ এবং জনপ্রিয় কনটেন্ট। এখানে ব্যক্তিগত পাঠকতথ্য দেখানো হয় না।</p></div></header>

    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><form action="/admin/analytics" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto] lg:items-end">
      <label className="grid gap-1.5 text-xs font-semibold text-ink">সময়সীমা<select name="period" defaultValue={analytics.period.period} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"><option value="today">আজ</option><option value="7d">শেষ ৭ দিন</option><option value="30d">শেষ ৩০ দিন</option><option value="custom">নিজস্ব সময়সীমা</option></select></label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink">শুরু<input name="from" type="date" defaultValue={analytics.period.from} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15" /></label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink">শেষ<input name="to" type="date" defaultValue={analytics.period.to} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15" /></label>
      <button className="min-h-11 rounded-xl bg-forest px-5 text-sm font-bold text-white transition hover:bg-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">প্রয়োগ করুন</button>
    </form><p className="mt-3 text-xs leading-5 text-ink-muted">তারিখ বাংলাদেশ সময় অনুযায়ী গণনা করা হয়: {analytics.period.from} — {analytics.period.to}। মোট কনটেন্ট ও সক্রিয় ব্যবহারকারী বর্তমান হিসাব; ভিউ, নতুন ব্যবহারকারী, সংরক্ষণ, পছন্দ ও জনপ্রিয় তালিকা নির্বাচিত সময়ের।</p></section>

    <section aria-label="মূল পরিসংখ্যান" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ label, value, icon: Icon, note }) => <article key={label} className="rounded-2xl border border-line bg-white p-4 transition hover:shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold leading-5 text-ink-muted">{label}</p><p className="mt-2 font-serif text-3xl font-bold tabular-nums text-ink">{count(value)}</p></div><span className="grid size-10 place-items-center rounded-xl bg-paper-100 text-forest"><Icon size={19} /></span></div><p className="mt-3 text-[11px] text-ink-muted">{note}</p></article>)}</section>

    <section className="grid gap-4 xl:grid-cols-3"><PopularList title="জনপ্রিয় সংবাদ" items={analytics.popularArticles} kind="article" /><PopularList title="জনপ্রিয় ভিডিও" items={analytics.popularVideos} kind="video" /><PopularList title="জনপ্রিয় বিভাগ" items={analytics.popularCategories} kind="category" /></section>
  </div></CmsFrame>;
}
