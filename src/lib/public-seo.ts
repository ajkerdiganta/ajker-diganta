import type { Metadata } from "next";
import { env } from "@/lib/env";
import { jsonLdScript } from "@/lib/article-seo";

export function publicOrigin() {
  return (env.PUBLIC_SITE_URL ?? env.BETTER_AUTH_URL).replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
  return new URL(path, `${publicOrigin()}/`).toString();
}

export function pageMetadata(input: { title: string; description?: string | null; path: string; noIndex?: boolean }): Metadata {
  const description = input.description?.trim() || `দৈনিক আজকের দিগন্তে ${input.title} পড়ুন।`;
  const canonical = absoluteUrl(input.path);
  return {
    title: input.title,
    description,
    alternates: { canonical },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "website", locale: "bn_BD", siteName: "দৈনিক আজকের দিগন্ত", title: input.title, description, url: canonical },
    twitter: { card: "summary", title: input.title, description },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return jsonLdScript({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
  });
}
