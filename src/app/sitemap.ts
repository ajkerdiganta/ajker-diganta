import type { MetadataRoute } from "next";
import { getPublicSitemapData } from "@/lib/public-news";
import { absoluteUrl } from "@/lib/public-seo";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getPublicSitemapData();
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/latest"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/video"), changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "monthly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "monthly", priority: 0.2 },
  ];
  return [
    ...pages,
    ...data.articles.map(({ slug, updatedAt }) => ({ url: absoluteUrl(`/news/${slug}`), lastModified: updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...data.categories.map(({ slug, updatedAt }) => ({ url: absoluteUrl(`/category/${slug}`), lastModified: updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    ...data.authors.map(({ slug, updatedAt }) => ({ url: absoluteUrl(`/author/${slug}`), lastModified: updatedAt, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...data.videos.map((video) => ({ url: absoluteUrl(`/video/${video.slug}`), lastModified: video.publishedAt ?? video.article?.publishedAt ?? undefined, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
