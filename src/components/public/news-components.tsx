import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import type { PublicArticleCard } from "@/lib/public-news";
import { formatBangladeshDateTime, formatBangladeshShortDate } from "@/lib/public-format";
import { ArticleViewTracker, ShareButton } from "@/components/public/public-client";

export function SectionHeading({ eyebrow, title, href, linkLabel = "সব দেখুন" }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-3"><div>{eyebrow && <p className="text-xs font-bold tracking-wide text-red-brand">{eyebrow}</p>}<h2 className="mt-1 font-serif text-xl font-bold leading-relaxed text-ink sm:text-2xl">{title}</h2></div>{href && <Link className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-forest hover:underline" href={href}>{linkLabel}<ArrowLeft size={14} /></Link>}</div>;
}

export function NewsImage({ article, className = "", priority = false }: { article: PublicArticleCard; className?: string; priority?: boolean }) {
  const entry = article.media[0];
  if (!entry) return <div aria-hidden="true" className={`grid place-items-center bg-[linear-gradient(135deg,#e7e4d8,#f5f3ed_54%,#dde8dd)] ${className}`}><span className="font-serif text-4xl font-bold text-forest/30">দিগন্ত</span></div>;
  const alt = entry.altOverride || entry.media.altText || article.title;
  return <div className={`relative overflow-hidden bg-paper-100 ${className}`}><Image src={`/api/media/${entry.media.id}`} alt={alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 700px" preload={priority} unoptimized className="object-cover transition duration-300 group-hover:scale-[1.025]" /></div>;
}

export function NewsCard({ article, variant = "standard" }: { article: PublicArticleCard; variant?: "standard" | "compact" | "horizontal" }) {
  const category = article.categories[0]?.category;
  const author = article.authors[0]?.author;
  const compact = variant === "compact";
  const horizontal = variant === "horizontal";
  return <article className={`group min-w-0 ${horizontal ? "grid gap-3 sm:grid-cols-[180px_1fr]" : ""}`}>
    {(!compact || horizontal) && <Link href={`/news/${article.slug}`} className="block overflow-hidden rounded-xl" aria-label={`${article.title} — সংবাদ পড়ুন`}><NewsImage article={article} className={horizontal ? "aspect-[16/10]" : "aspect-[16/9]"} /></Link>}
    <div className={compact ? "" : "pt-2"}>
      {category && <Link href={`/category/${category.slug}`} className="text-xs font-bold text-red-brand hover:underline">{category.name}</Link>}
      <h3 className={`${compact ? "text-sm" : horizontal ? "text-lg sm:text-xl" : "text-lg"} mt-1 font-serif font-bold leading-[1.65] text-ink group-hover:text-forest`}><Link href={`/news/${article.slug}`}>{article.title}</Link></h3>
      {!compact && article.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink-muted">{article.excerpt}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        {author && <Link href={`/author/${author.slug}`} className="font-semibold text-forest hover:underline">{author.name}</Link>}
        {article.publishedAt && <time dateTime={article.publishedAt.toISOString()} title={formatBangladeshDateTime(article.publishedAt)}>{formatBangladeshShortDate(article.publishedAt)}</time>}
      </div>
    </div>
  </article>;
}

export function CompactNewsList({ articles, empty = "এখনো প্রকাশিত সংবাদ নেই।" }: { articles: PublicArticleCard[]; empty?: string }) {
  if (!articles.length) return <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm leading-7 text-ink-muted">{empty}</p>;
  return <div className="divide-y divide-line">{articles.map((article) => <div key={article.id} className="py-3 first:pt-0 last:pb-0"><NewsCard article={article} variant="compact" /></div>)}</div>;
}

export function ArticleMetaLine({ article }: { article: Pick<PublicArticleCard, "publishedAt" | "authors"> }) {
  const author = article.authors[0]?.author;
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">{author && <span>লেখক: <Link className="font-semibold text-forest hover:underline" href={`/author/${author.slug}`}>{author.name}</Link></span>}{article.publishedAt && <time className="inline-flex items-center gap-1" dateTime={article.publishedAt.toISOString()}><Clock3 size={13} />{formatBangladeshDateTime(article.publishedAt)}</time>}</div>;
}

export function Pagination({ page, totalPages, basePath, query = "" }: { page: number; totalPages: number; basePath: string; query?: string }) {
  if (totalPages < 2) return null;
  const href = (n: number) => `${basePath}?page=${n}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  return <nav aria-label="পাতা নির্বাচন" className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5"><span className="text-xs text-ink-muted">পৃষ্ঠা {page} / {totalPages}</span><div className="flex gap-2">{page > 1 && <Link href={href(page - 1)} rel="prev" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-forest"><ArrowLeft size={15} className="inline" /> আগের</Link>}{page < totalPages && <Link href={href(page + 1)} rel="next" className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">পরের <ArrowLeft size={15} className="inline rotate-180" /></Link>}</div></nav>;
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <nav aria-label="ব্রেডক্রাম্ব" className="mb-5 text-xs text-ink-muted"><ol className="flex flex-wrap items-center gap-2">{items.map((item, index) => <li key={`${item.label}-${index}`} className="flex items-center gap-2">{index > 0 && <span aria-hidden="true">/</span>}{item.href && index < items.length - 1 ? <Link href={item.href} className="hover:text-forest">{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}

export function ViewCounter({ slug, views = BigInt(0), viewerKey }: { slug: string; views?: bigint; viewerKey?: string }) {
  return <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><ArticleViewTracker slug={slug} viewerKey={viewerKey}/><span>{views.toLocaleString("bn-BD")}</span><span className="sr-only">বার পড়া হয়েছে</span></span>;
}

export function PublicArticleInteractions({ slug, title, canonicalUrl, views, viewerKey }: { slug: string; title: string; canonicalUrl: string; views: bigint; viewerKey?: string }) {
  return <div className="flex items-center gap-4"><ViewCounter slug={slug} views={views} viewerKey={viewerKey} /><ShareButton title={title} url={canonicalUrl} /></div>;
}

export function BreakingBadge() { return <span className="inline-flex items-center rounded-full bg-red-brand px-2.5 py-1 text-[11px] font-bold text-white">জরুরি সংবাদ</span>; }

export function EditorialRule({ children }: { children: ReactNode }) { return <div className="flex items-center gap-3 text-xs font-semibold text-forest"><span className="h-px flex-1 bg-line" />{children}<span className="h-px flex-1 bg-line" /></div>; }

export function FeaturedStory({ article }: { article: PublicArticleCard }) {
  return <article className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><Link href={`/news/${article.slug}`} className="block"><NewsImage article={article} priority className="aspect-[16/10] sm:aspect-[16/9]" /></Link><div className="p-4 sm:p-6">{article.isBreaking && <BreakingBadge />}<h2 className="mt-2 font-serif text-2xl font-bold leading-[1.65] text-ink group-hover:text-forest sm:text-3xl lg:text-4xl"><Link href={`/news/${article.slug}`}>{article.title}</Link></h2>{article.subtitle && <p className="mt-2 text-sm leading-7 text-ink-muted sm:text-base">{article.subtitle}</p>}{article.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-8 text-ink-muted">{article.excerpt}</p>}<div className="mt-4 flex items-center justify-between gap-3"><ArticleMetaLine article={article} /><Link href={`/news/${article.slug}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-red-brand hover:underline">বিস্তারিত <ArrowLeft size={15} /></Link></div></div></article>;
}
