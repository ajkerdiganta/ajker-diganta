import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import { PublicFrame } from "@/components/layout/page-frame";
import { SectionHeading } from "@/components/public/news-components";
import { formatBangladeshShortDate } from "@/lib/public-format";
import { getPublicSearchFacets, SEARCH_SORTS, SEARCH_TYPES, searchPublicContent, type PublicSearchResult, type SearchEntityType, type SearchSort, type SearchType } from "@/lib/public-search";
import { pageMetadata } from "@/lib/public-seo";

type RawSearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<RawSearchParams> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = first((await searchParams).q).trim();
  return pageMetadata({ title: q ? `“${q.slice(0, 80)}” খুঁজুন` : "সংবাদ খুঁজুন", description: "দৈনিক আজকের দিগন্তের প্রকাশিত সংবাদ, ভিডিও ও বিষয় খুঁজুন।", path: "/search", noIndex: true });
}

const typeLabels: Record<SearchEntityType, string> = { articles: "সংবাদ", videos: "ভিডিও", authors: "লেখক", tags: "ট্যাগ", categories: "বিভাগ" };
const typeOptions: Array<{ value: SearchType; label: string }> = [
  { value: "all", label: "সব ধরনের ফল" }, { value: "articles", label: "সংবাদ" }, { value: "videos", label: "ভিডিও" }, { value: "authors", label: "লেখক" }, { value: "tags", label: "ট্যাগ" }, { value: "categories", label: "বিভাগ" },
];
const sortLabels: Record<SearchSort, string> = { relevance: "প্রাসঙ্গিকতা", newest: "সাম্প্রতিক আগে", oldest: "পুরোনো আগে", popular: "জনপ্রিয়তা" };

function resultHref(result: PublicSearchResult["results"][number]) { return result.href; }

function ResultCard({ result }: { result: PublicSearchResult["results"][number] }) {
  return <article className="group rounded-xl border border-line bg-white p-4 transition hover:border-forest/40 hover:shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-paper-100 px-2.5 py-1 font-bold text-forest">{typeLabels[result.type]}</span>
      {result.categoryName && result.categorySlug && <Link href={`/category/${encodeURIComponent(result.categorySlug)}`} className="font-semibold text-red-brand hover:underline">{result.categoryName}</Link>}
      {result.publishedAt && <time className="inline-flex items-center gap-1 text-ink-muted" dateTime={result.publishedAt.toISOString()}><CalendarDays size={13}/>{formatBangladeshShortDate(result.publishedAt)}</time>}
    </div>
    <h2 className="mt-2 font-serif text-lg font-bold leading-[1.7] text-ink group-hover:text-forest sm:text-xl"><Link href={resultHref(result)}>{result.title}</Link></h2>
    {result.excerpt && <p className="mt-1 line-clamp-2 text-sm leading-7 text-ink-muted">{result.excerpt}</p>}
    {result.authorName && result.authorSlug && <p className="mt-2 text-xs text-ink-muted">লেখক: <Link href={`/author/${encodeURIComponent(result.authorSlug)}`} className="font-semibold text-forest hover:underline">{result.authorName}</Link></p>}
  </article>;
}

function pageUrl(data: PublicSearchResult, page: number) {
  const params = new URLSearchParams();
  if (data.query) params.set("q", data.query);
  if (data.filters.type !== "all") params.set("type", data.filters.type);
  if (data.filters.category) params.set("category", data.filters.category);
  if (data.filters.author) params.set("author", data.filters.author);
  if (data.filters.from) params.set("from", data.filters.from);
  if (data.filters.to) params.set("to", data.filters.to);
  if (data.filters.sort !== "relevance") params.set("sort", data.filters.sort);
  params.set("page", String(page));
  return `/search?${params.toString()}`;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const input = {
    q: first(params.q), page: Number.parseInt(first(params.page) || "1", 10) || 1,
    type: first(params.type), category: first(params.category), author: first(params.author),
    from: first(params.from), to: first(params.to), sort: first(params.sort),
  };
  let data: PublicSearchResult | null = null;
  let facets = { categories: [] as Array<{ slug: string; name: string }>, authors: [] as Array<{ slug: string; name: string }> };
  let error = false;
  try {
    [data, facets] = await Promise.all([searchPublicContent(input), getPublicSearchFacets()]);
  } catch (cause) {
    console.error("[PublicSearch] Search failed", cause);
    error = true;
  }
  const query = data?.query ?? input.q.trim().normalize("NFC");
  const selectedType = (data?.filters.type ?? (SEARCH_TYPES.includes(input.type as SearchType) ? input.type as SearchType : "all"));
  const selectedSort = (data?.filters.sort ?? (SEARCH_SORTS.includes(input.sort as SearchSort) ? input.sort as SearchSort : "relevance"));
  const hasQuery = query.length > 0;
  return <PublicFrame><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <SectionHeading eyebrow="প্রকাশিত সংবাদ ও বিষয়" title="খুঁজুন"/>
    <form action="/search" method="get" className="mb-7 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <label className="mb-2 block text-sm font-bold text-ink" htmlFor="public-search">কী খুঁজছেন?</label>
      <div className="flex gap-2"><input id="public-search" name="q" defaultValue={query} maxLength={100} placeholder="বাংলা বা English শব্দ লিখুন…" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper-50 px-4 text-base outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"/><button className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white hover:bg-forest-700"><Search size={17}/>খুঁজুন</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-ink-muted">ধরন<select name="type" defaultValue={selectedType} className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink">{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="text-xs font-semibold text-ink-muted">বিভাগ<select name="category" defaultValue={input.category} className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"><option value="">সব বিভাগ</option>{facets.categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-ink-muted">লেখক<select name="author" defaultValue={input.author} className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"><option value="">সব লেখক</option>{facets.authors.map((author) => <option key={author.slug} value={author.slug}>{author.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-ink-muted">তারিখ থেকে<input type="date" name="from" defaultValue={data?.filters.from ?? input.from} className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"/></label>
        <label className="text-xs font-semibold text-ink-muted">তারিখ পর্যন্ত<input type="date" name="to" defaultValue={data?.filters.to ?? input.to} className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"/></label>
        <label className="text-xs font-semibold text-ink-muted">সাজান<select name="sort" defaultValue={selectedSort} className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink">{SEARCH_SORTS.map((sort) => <option key={sort} value={sort}>{sortLabels[sort]}</option>)}</select></label>
      </div>
      <p className="mt-3 text-xs leading-6 text-ink-muted">বিভাগ, লেখক ও তারিখের ফিল্টার সংবাদ ও ভিডিও ফলের ক্ষেত্রে প্রযোজ্য।</p>
    </form>
    {error && <div role="alert" className="mb-5 rounded-xl border border-red-brand/30 bg-red-50 p-4 text-sm leading-7 text-red-brand">এই মুহূর্তে অনুসন্ধান সম্পন্ন করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন। আপনার লেখা অনুসন্ধানটি রাখা হয়েছে।</div>}
    {query.length === 1 && <p className="mb-4 text-sm text-ink-muted">আরও নির্ভুল ফলের জন্য অন্তত দুটি অক্ষর লিখুন।</p>}
    {data && hasQuery && <p className="mb-4 text-sm text-ink-muted">“{data.query}” — মোট {data.total.toLocaleString("bn-BD")}টি ফল</p>}
    {data && data.query.length >= 2 && !data.results.length && <div className="rounded-xl border border-dashed border-line bg-white p-6 text-sm leading-7 text-ink-muted"><p className="font-bold text-ink">কোনো ফল পাওয়া যায়নি</p><p>অন্য শব্দ ব্যবহার করুন, বানান যাচাই করুন, অথবা বিভাগ/লেখক/তারিখের ফিল্টার পরিবর্তন করুন।</p></div>}
    <div className="grid gap-3 sm:grid-cols-2">{data?.results.map((result) => <ResultCard key={`${result.type}-${result.id}`} result={result}/>)}</div>
    {data && data.totalPages > 1 && <nav aria-label="পাতা নির্বাচন" className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5"><span className="text-xs text-ink-muted">পৃষ্ঠা {data.page.toLocaleString("bn-BD")} / {data.totalPages.toLocaleString("bn-BD")}</span><div className="flex gap-2">{data.page > 1 && <Link href={pageUrl(data, data.page - 1)} rel="prev" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-forest">আগের</Link>}{data.page < data.totalPages && <Link href={pageUrl(data, data.page + 1)} rel="next" className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">পরের</Link>}</div></nav>}
  </div></PublicFrame>;
}
