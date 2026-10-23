import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs, NewsCard, Pagination, SectionHeading } from "@/components/public/news-components";
import { getPublicAuthor } from "@/lib/public-news";
import { pageMetadata } from "@/lib/public-seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicAuthor(slug);
  if (!data) return pageMetadata({ title: "লেখক পাওয়া যায়নি", path: `/author/${encodeURIComponent(slug)}`, noIndex: true });
  return pageMetadata({ title: `${data.author.name} — লেখক পরিচিতি`, description: data.author.bio || `${data.author.name}-এর সর্বশেষ প্রকাশিত সংবাদ ও প্রতিবেদন।`, path: `/author/${data.author.slug}` });
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const data = await getPublicAuthor(slug, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  if (!data) notFound();
  return <PublicFrame><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: "লেখক", href: "/latest" }, { label: data.author.name }]}/><header className="mb-8 rounded-2xl border border-line bg-white p-5 sm:p-8"><p className="text-xs font-bold text-red-brand">লেখক পরিচিতি</p><h1 className="mt-2 font-serif text-3xl font-bold leading-relaxed text-ink">{data.author.name}</h1>{data.author.title && <p className="mt-1 text-sm font-semibold text-forest">{data.author.title}</p>}{data.author.bio && <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-8 text-ink-muted">{data.author.bio}</p>}</header><SectionHeading title="লেখকের সংবাদ"/><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{data.articles.map((article) => <NewsCard key={article.id} article={article}/>)}</div>{!data.articles.length && <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">এই লেখকের কোনো প্রকাশিত সংবাদ পাওয়া যায়নি।</p>}<Pagination page={data.page} totalPages={data.totalPages} basePath={`/author/${data.author.slug}`}/></div></PublicFrame>;
}
