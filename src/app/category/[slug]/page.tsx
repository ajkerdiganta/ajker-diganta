import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs, NewsCard, Pagination, SectionHeading } from "@/components/public/news-components";
import { getCategoryBySlug } from "@/lib/public-news";
import { pageMetadata } from "@/lib/public-seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug, 1);
  if (!category) return pageMetadata({ title: "বিভাগ পাওয়া যায়নি", path: `/category/${encodeURIComponent(slug)}`, noIndex: true });
  return pageMetadata({ title: category.seoTitle || category.name, description: category.seoDescription || category.description || `${category.name} বিভাগের সর্বশেষ প্রকাশিত বাংলা সংবাদ।`, path: `/category/${category.slug}` });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const data = await getCategoryBySlug(slug, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  if (!data) notFound();
  const breadcrumb = data.parent ? [{ label: "প্রচ্ছদ", href: "/" }, { label: data.parent.name, href: `/category/${data.parent.slug}` }, { label: data.name }] : [{ label: "প্রচ্ছদ", href: "/" }, { label: data.name }];
  return <PublicFrame><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={breadcrumb}/><section className="mb-8 border-l-4 border-forest pl-4"><p className="text-xs font-bold text-red-brand">বিভাগ</p><h1 className="mt-1 font-serif text-3xl font-bold leading-relaxed text-ink">{data.name}</h1>{data.description && <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">{data.description}</p>}</section>{data.children.length > 0 && <nav aria-label="উপবিভাগ" className="mb-6 flex flex-wrap gap-2">{data.children.map((child) => <Link key={child.id} href={`/category/${child.slug}`} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-forest hover:border-forest">{child.name}</Link>)}</nav>}<SectionHeading title="এই বিভাগের সংবাদ"/><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{data.articles.map((article) => <NewsCard key={article.id} article={article}/>)}</div>{!data.articles.length && <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">এই বিভাগে এখনো প্রকাশিত সংবাদ নেই।</p>}<Pagination page={data.page} totalPages={data.totalPages} basePath={`/category/${data.slug}`}/></div></PublicFrame>;
}
