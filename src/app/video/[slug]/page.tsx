import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Eye } from "lucide-react";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs, SectionHeading } from "@/components/public/news-components";
import { ShareButton, VideoViewTracker } from "@/components/public/public-client";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/public-seo";
import { jsonLdScript } from "@/lib/article-seo";
import { formatBangladeshDateTime } from "@/lib/public-format";
import { videoEmbedUrl } from "@/lib/video-provider";
import { getPublicVideo, getRelatedPublicVideos } from "@/lib/public-videos";

type Props = { params: Promise<{ slug: string }> };
function isoDuration(seconds: number | null) {
  if (seconds === null) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const secs = seconds % 60;
  if (hours === 0 && minutes === 0 && secs === 0) return "PT0S";
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${secs ? `${secs}S` : ""}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const video = await getPublicVideo(slug);
  if (!video) return { title: "ভিডিও পাওয়া যায়নি", robots: { index: false, follow: false } };
  const base = pageMetadata({ title: video.seoTitle || video.title, description: video.seoDescription || video.description, path: `/video/${video.slug}` });
  return {
    ...base,
    openGraph: { ...base.openGraph, type: "video.other", ...(video.thumbnailUrl ? { images: [video.thumbnailUrl] } : {}) },
    twitter: { ...base.twitter, card: "summary_large_image", ...(video.thumbnailUrl ? { images: [video.thumbnailUrl] } : {}) },
  };
}

export default async function PublicVideoPage({ params }: Props) {
  const { slug } = await params;
  const video = await getPublicVideo(slug);
  if (!video) notFound();
  const relatedVideos = await getRelatedPublicVideos(video.externalId, 4);
  const embedUrl = videoEmbedUrl(video.provider, video.externalId);
  if (!embedUrl) notFound();
  const related = video.relatedArticles;
  const breadcrumbs = [{ label: "প্রচ্ছদ", href: "/" }, { label: "ভিডিও", href: "/video" }, { label: video.title }];
  const schema = {
    "@context": "https://schema.org", "@type": "VideoObject", name: video.title,
    description: video.seoDescription || video.description,
    thumbnailUrl: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
    uploadDate: video.publishedAt?.toISOString(), duration: isoDuration(video.durationSeconds),
    embedUrl, contentUrl: video.videoUrl, url: absoluteUrl(`/video/${video.slug}`),
    inLanguage: "bn-BD", interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: Number(video.viewCount) },
    author: video.author ? { "@type": "Person", name: video.author.name, url: absoluteUrl(`/author/${video.author.slug}`) } : undefined,
    publisher: { "@type": "Organization", name: "দৈনিক আজকের দিগন্ত" },
  };
  return <PublicFrame><article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={breadcrumbs}/><p className="text-xs font-bold text-red-brand">ভিডিও সংবাদ</p><h1 className="mt-2 max-w-4xl font-serif text-3xl font-bold leading-[1.7] text-ink sm:text-4xl">{video.title}</h1><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">{video.category && <Link href={`/video?category=${encodeURIComponent(video.category.slug)}`} className="font-bold text-forest hover:underline">{video.category.name}</Link>}{video.author && <Link href={`/author/${video.author.slug}`} className="font-semibold text-forest hover:underline">{video.author.name}</Link>}{video.publishedAt && <time dateTime={video.publishedAt.toISOString()} className="inline-flex items-center gap-1"><Clock3 size={13}/>{formatBangladeshDateTime(video.publishedAt)}</time>}<VideoViewTracker slug={video.slug} views={video.viewCount}/><ShareButton title={video.title} url={absoluteUrl(`/video/${video.slug}`)}/></div>
    <div className="mt-5 overflow-hidden rounded-2xl bg-black shadow-sm"><div className="aspect-video"><iframe className="h-full w-full" src={embedUrl} title={video.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div></div>
    <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]"><div><p className="whitespace-pre-line text-base leading-8 text-ink-muted">{video.description}</p>{video.tags.length > 0 && <ul className="mt-5 flex flex-wrap gap-2" aria-label="ভিডিও ট্যাগ">{video.tags.map((tag) => <li key={tag.id}><span className="rounded-full bg-paper-100 px-3 py-1 text-xs font-semibold text-forest">{tag.name}</span></li>)}</ul>}{related.length > 0 && <section className="mt-8"><SectionHeading title="সম্পর্কিত সংবাদ"/><ul className="space-y-3">{related.map((article) => <li key={article.id}><Link href={`/news/${article.slug}`} className="inline-flex items-start gap-2 font-serif text-lg font-bold leading-8 text-forest hover:underline"><ArrowLeft size={17} className="mt-2 shrink-0 rotate-180"/>{article.title}</Link></li>)}</ul></section>}</div><aside className="rounded-2xl border border-line bg-white p-4 sm:p-5"><SectionHeading title="আরও ভিডিও" href="/video"/>{relatedVideos.length ? <div className="space-y-4">{relatedVideos.map((item) => <Link key={item.id ?? item.externalId} href={`/video/${item.slug}`} className="group block"><div className="relative aspect-video overflow-hidden rounded-lg bg-paper-100">{item.thumbnailUrl && <Image src={item.thumbnailUrl} alt={`${item.title} — thumbnail`} fill quality={70} sizes="320px" className="object-cover" />}<span className="absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full bg-red-brand text-white"><Eye size={15}/></span></span></div><span className="mt-2 block font-serif text-sm font-bold leading-7 text-ink group-hover:text-forest">{item.title}</span></Link>)}</div> : <p className="text-sm leading-7 text-ink-muted">আরও ভিডিও প্রকাশিত হলে এখানে দেখা যাবে।</p>}</aside></div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(breadcrumbs.map((item) => ({ name: item.label, path: item.href ?? `/video/${video.slug}` }))) }}/></article></PublicFrame>;
}
