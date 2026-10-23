import type { Metadata } from "next";
import { env } from "@/lib/env";

type SeoArticle = {
  id: string; slug: string; title: string; subtitle: string | null; excerpt: string | null;
  seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null;
  publishedAt: Date | null; updatedAt: Date;
  authors: Array<{ author: { name: string; slug: string } }>;
  categories: Array<{ category: { name: string; slug: string } }>;
  media: Array<{ media: { id: string; altText: string | null; width: number | null; height: number | null; objectKey: string; visibility: string } }>;
};

export function articleMetadata(article: SeoArticle): Metadata {
  const origin = (env.PUBLIC_SITE_URL ?? env.BETTER_AUTH_URL).replace(/\/$/, "");
  const canonical = article.canonicalUrl ?? `${origin}/news/${article.slug}`;
  const featured = article.media.find(({ media }) => media.visibility === "PUBLIC");
  const imageUrl = featured ? `${origin}/api/media/${featured.media.id}` : undefined;
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || article.subtitle || article.title;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: article.publishedAt !== null, follow: article.publishedAt !== null },
    openGraph: {
      type: "article", locale: "bn_BD", siteName: "দৈনিক আজকের দিগন্ত", title, description, url: canonical,
      publishedTime: article.publishedAt?.toISOString(), modifiedTime: article.updatedAt.toISOString(),
      authors: article.authors.map(({ author }) => author.name),
      section: article.categories.find((entry) => entry.category.slug)?.category.name,
      images: imageUrl ? [{ url: imageUrl, alt: featured?.media.altText ?? article.title, width: featured?.media.width ?? undefined, height: featured?.media.height ?? undefined }] : [],
    },
    twitter: { card: imageUrl ? "summary_large_image" : "summary", title, description, images: imageUrl ? [imageUrl] : [] },
  };
}

export function articleJsonLd(article: SeoArticle) {
  const origin = (env.PUBLIC_SITE_URL ?? env.BETTER_AUTH_URL).replace(/\/$/, "");
  const featured = article.media.find(({ media }) => media.visibility === "PUBLIC");
  const canonical = article.canonicalUrl ?? `${origin}/news/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.seoTitle || article.title,
    alternativeHeadline: article.subtitle ?? undefined,
    description: article.seoDescription || article.excerpt || article.subtitle || article.title,
    mainEntityOfPage: canonical,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: article.authors.map(({ author }) => ({ "@type": "Person", name: author.name, url: `${origin}/author/${author.slug}` })),
    articleSection: article.categories.map(({ category }) => category.name),
    image: featured ? { "@type": "ImageObject", url: `${origin}/api/media/${featured.media.id}`, width: featured.media.width ?? undefined, height: featured.media.height ?? undefined, caption: featured.media.altText ?? article.title } : undefined,
    publisher: { "@type": "Organization", name: "দৈনিক আজকের দিগন্ত", url: origin },
    inLanguage: "bn-BD",
  };
}

export function jsonLdScript(value: object) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
