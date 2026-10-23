import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { PublicFrame } from "@/components/layout/page-frame";
import { Pagination, SectionHeading } from "@/components/public/news-components";
import { formatBangladeshDateTime } from "@/lib/public-format";
import { pageMetadata } from "@/lib/public-seo";
import { getPublicVideoIndex } from "@/lib/public-videos";

export const metadata: Metadata = pageMetadata({ title: "ভিডিও সংবাদ", description: "বাংলাদেশ ও বিশ্বের ভিডিও প্রতিবেদন, সাক্ষাৎকার ও ব্যাখ্যামূলক সংবাদ।", path: "/video" });
type Props = { searchParams: Promise<{ page?: string; category?: string }> };

function duration(seconds: number | null) {
  if (seconds === null) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toLocaleString("bn-BD")}:${String(secs).padStart(2, "0")}`;
}

export default async function VideoIndexPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  const categorySlug = params.category?.trim().slice(0, 100) || undefined;
  const data = await getPublicVideoIndex(page, 24, categorySlug);
  const basePath = "/video";
  const query = data.category ? `&category=${encodeURIComponent(data.category.slug)}` : "";
  return <PublicFrame><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><SectionHeading eyebrow="দেখুন ও জানুন" title={data.category ? `${data.category.name} ভিডিও` : "ভিডিও সংবাদ"}/>
    {data.categories.length > 0 && <nav aria-label="ভিডিওর বিভাগ" className="mb-6 flex gap-2 overflow-x-auto pb-2"><Link href="/video" aria-current={!data.category ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${!data.category ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted hover:border-forest"}`}>সব ভিডিও</Link>{data.categories.map((category) => <Link key={category.id} href={`/video?category=${encodeURIComponent(category.slug)}`} aria-current={data.category?.id === category.id ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${data.category?.id === category.id ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted hover:border-forest"}`}>{category.name}</Link>)}</nav>}
    {data.videos.length ? <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">{data.videos.map((video) => <article key={video.id ?? video.externalId} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><Link href={`/video/${video.slug}`} className="block" aria-label={`${video.title} — ভিডিও দেখুন`}><div className="relative aspect-video bg-paper-100">{video.thumbnailUrl && <Image src={video.thumbnailUrl} alt={`${video.title} — thumbnail`} fill quality={70} sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" className="object-cover transition duration-300 group-hover:scale-[1.025]"/>}<span className="absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-red-brand/95 text-white"><Play size={20} fill="currentColor"/></span></span>{duration(video.durationSeconds) && <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-[11px] font-bold text-white">{duration(video.durationSeconds)}</span>}</div></Link><div className="p-4"><div className="flex items-center justify-between gap-2 text-[11px] text-ink-muted">{video.category && <Link href={`/video?category=${encodeURIComponent(video.category.slug)}`} className="font-bold text-red-brand hover:underline">{video.category.name}</Link>}{video.publishedAt && <time dateTime={video.publishedAt.toISOString()}>{formatBangladeshDateTime(video.publishedAt)}</time>}</div><Link href={`/video/${video.slug}`} className="mt-2 block font-serif text-lg font-bold leading-8 text-ink hover:text-forest">{video.title}</Link><p className="mt-1 line-clamp-2 text-sm leading-7 text-ink-muted">{video.description}</p>{video.author && <Link href={`/author/${video.author.slug}`} className="mt-3 inline-block text-xs font-semibold text-forest hover:underline">{video.author.name}</Link>}{video.article && <Link href={`/news/${video.article.slug}`} className="mt-2 block text-xs font-semibold text-forest hover:underline">সম্পর্কিত সংবাদ: {video.article.title}</Link>}</div></article>)}</div> : <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm leading-7 text-ink-muted">{data.category ? "এই বিভাগে এখনো ভিডিও প্রকাশিত হয়নি।" : "ভিডিও newsroom-এ অনুমোদন ও প্রকাশের পর এখানে দেখা যাবে।"}</p>}
    <Pagination page={data.page} totalPages={data.totalPages} basePath={basePath} query={query}/>
  </div></PublicFrame>;
}
