import type { Metadata } from "next";
import { PublicFrame } from "@/components/layout/page-frame";
import { NewsCard, Pagination, SectionHeading } from "@/components/public/news-components";
import { getLatestArticles } from "@/lib/public-news";
import { pageMetadata } from "@/lib/public-seo";

type Props = { searchParams: Promise<{ page?: string }> };
export const metadata: Metadata = pageMetadata({ title: "সর্বশেষ সংবাদ", description: "দৈনিক আজকের দিগন্তের সর্বশেষ প্রকাশিত বাংলা সংবাদ।", path: "/latest" });

export default async function LatestPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const data = await getLatestArticles(page);
  return <PublicFrame><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><SectionHeading eyebrow="নতুন প্রকাশনা" title="সর্বশেষ সংবাদ"/><p className="mb-5 text-sm text-ink-muted">বাংলাদেশ সময় অনুযায়ী নতুন থেকে পুরোনো সংবাদ। মোট {data.total}টি প্রকাশিত সংবাদ।</p>{data.articles.length ? <><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{data.articles.map((article) => <NewsCard key={article.id} article={article}/>)}</div><Pagination page={data.page} totalPages={data.totalPages} basePath="/latest"/></> : <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">এখনো কোনো সংবাদ প্রকাশিত হয়নি।</p>}</div></PublicFrame>;
}
