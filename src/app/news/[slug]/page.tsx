import type { Metadata } from "next";
import { createHmac } from "node:crypto";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicFrame } from "@/components/layout/page-frame";
import { ArticleMetaLine, Breadcrumbs, PublicArticleInteractions, SectionHeading } from "@/components/public/news-components";
import { ArticlePersonalizationButtons } from "@/components/personalization/dashboard-client";
import { getArticleRedirect, getPublicArticle } from "@/lib/public-news";
import { getArticlePersonalizationState } from "@/lib/personalization";
import { getPrincipal } from "@/lib/authorization";
import { sanitizePublicArticleHtml } from "@/lib/article-content";
import { articleJsonLd, articleMetadata, jsonLdScript } from "@/lib/article-seo";
import { breadcrumbJsonLd } from "@/lib/public-seo";
import { formatBangladeshDateTime } from "@/lib/public-format";
import { env } from "@/lib/env";

type Props = { params: Promise<{ slug: string }> };
async function resolveArticle(slug: string) {
  const article = await getPublicArticle(slug);
  if (article) return article;
  const redirect = await getArticleRedirect(slug);
  if (redirect?.article.status === "PUBLISHED" && !redirect.article.deletedAt) permanentRedirect(`/news/${redirect.article.slug}`);
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) return { title: "সংবাদ পাওয়া যায়নি", robots: { index: false, follow: false } };
  return articleMetadata(article);
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) notFound();
  const principal = await getPrincipal(new Headers(await headers()));
  const personalization = principal ? await getArticlePersonalizationState(principal.id, article.id) : null;
  const viewReaderKey = principal ? createHmac("sha256", env.BETTER_AUTH_SECRET).update(principal.id).digest("hex") : undefined;
  const canonical = article.canonicalUrl || `${process.env.PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL}/news/${article.slug}`;
  const primaryCategory = article.categories[0]?.category;
  const crumbs = [{ label: "প্রচ্ছদ", href: "/" }, ...(primaryCategory ? [{ label: primaryCategory.name, href: `/category/${primaryCategory.slug}` }] : []), { label: article.title }];
  const jsonLd = articleJsonLd(article);
  const breadcrumb = breadcrumbJsonLd(crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href ?? `/news/${article.slug}` })));
  const videos = article.relatedVideos;
  const featured = article.media.find(({ role, media }) => role === "FEATURED_IMAGE" && media.visibility === "PUBLIC");

  return <PublicFrame><article className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
    <Breadcrumbs items={crumbs}/>
    {article.isBreaking && <span className="mb-3 inline-flex rounded-full bg-red-brand px-3 py-1 text-xs font-bold text-white">জরুরি সংবাদ</span>}
    {primaryCategory && <p className="mb-2"><Link href={`/category/${primaryCategory.slug}`} className="text-sm font-bold text-red-brand hover:underline">{primaryCategory.name}</Link></p>}
    <h1 className="max-w-4xl font-serif text-3xl font-bold leading-[1.6] tracking-tight text-ink sm:text-4xl lg:text-5xl">{article.title}</h1>
    {article.subtitle && <p className="mt-3 max-w-4xl text-lg leading-[1.8] text-ink-muted sm:text-xl">{article.subtitle}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4"><ArticleMetaLine article={article}/><PublicArticleInteractions slug={article.slug} title={article.title} canonicalUrl={canonical} views={article.viewCount} viewerKey={viewReaderKey}/></div>
    <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-3">{personalization ? <ArticlePersonalizationButtons articleId={article.id} saved={personalization.saved} favourite={personalization.favourite}/> : <p className="text-xs text-ink-muted"><Link href="/login" className="font-semibold text-forest underline">লগইন</Link> করে সংবাদ সংরক্ষণ বা পছন্দের তালিকায় যোগ করুন।</p>}</div>
    {article.excerpt && <p className="mt-6 border-l-4 border-forest bg-white px-4 py-3 text-base font-medium leading-8 text-ink sm:text-lg">{article.excerpt}</p>}
    {!personalization?.lowBandwidthMode && featured && <figure className="mt-7 overflow-hidden rounded-2xl border border-line bg-white"><div className="relative mx-auto aspect-video max-h-[36rem] w-full"><Image src={`/api/media/${featured.media.id}`} alt={featured.altOverride || featured.media.altText || article.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-contain" unoptimized priority/></div><figcaption className="px-4 py-3 text-sm leading-7 text-ink-muted">{featured.media.caption || featured.altOverride || featured.media.altText || article.title}{featured.media.credit ? ` · ${featured.media.credit}` : ""}</figcaption></figure>}
    <div className={`cms-prose mx-auto mt-7 max-w-3xl font-serif leading-[2.05] text-ink sm:leading-[2.1] ${personalization?.fontScale === "large" ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`} dangerouslySetInnerHTML={{ __html: sanitizePublicArticleHtml(article.bodyHtml) }}/>
    <div className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">{article.tags.map(({ tag }) => <Link key={tag.slug} href={`/search?q=${encodeURIComponent(tag.name)}`} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">#{tag.name}</Link>)}</div>
    <div className="mx-auto mt-5 max-w-3xl text-xs text-ink-muted">শেষ হালনাগাদ: <time dateTime={article.updatedAt.toISOString()}>{formatBangladeshDateTime(article.updatedAt)}</time></div>
    {article.relatedArticles.length > 0 && <section className="mx-auto mt-10 max-w-4xl"><SectionHeading title="সম্পর্কিত সংবাদ"/><div className="grid gap-4 sm:grid-cols-2">{article.relatedArticles.map(({ relatedArticle }) => <Link key={relatedArticle.id} href={`/news/${relatedArticle.slug}`} className="rounded-xl border border-line bg-white p-4 font-serif text-base font-bold leading-8 text-ink transition hover:border-forest hover:text-forest">{relatedArticle.title}</Link>)}</div></section>}
    {videos.length > 0 && <section className="mx-auto mt-10 max-w-4xl"><SectionHeading title="সম্পর্কিত ভিডিও" href="/video"/><div className="grid gap-3 sm:grid-cols-2">{videos.map((video) => <Link key={`${video.provider}-${video.externalId}`} href={`/video/${video.slug}`} className="rounded-xl border border-line bg-white p-4 text-sm font-semibold leading-7 text-ink hover:border-forest hover:text-forest">▶ {video.title}</Link>)}</div></section>}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }}/>
  </article></PublicFrame>;
}
