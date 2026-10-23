import { getLatestArticles } from "@/lib/public-news";
import { absoluteUrl } from "@/lib/public-seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET() {
  const { articles } = await getLatestArticles(1, 50);
  const items = articles.map((article) => `
    <item>
      <title>${xml(article.title)}</title>
      <link>${xml(absoluteUrl(`/news/${article.slug}`))}</link>
      <guid isPermaLink="true">${xml(absoluteUrl(`/news/${article.slug}`))}</guid>
      <description>${xml(article.excerpt || article.subtitle || article.title)}</description>
      <pubDate>${(article.publishedAt ?? article.updatedAt).toUTCString()}</pubDate>
      ${article.categories[0] ? `<category>${xml(article.categories[0].category.name)}</category>` : ""}
    </item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>দৈনিক আজকের দিগন্ত</title><link>${xml(absoluteUrl("/"))}</link><description>দৈনিক আজকের দিগন্তের সর্বশেষ প্রকাশিত বাংলা সংবাদ</description><language>bn-BD</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" } });
}
