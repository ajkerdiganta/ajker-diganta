import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/public-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/latest", "/category/", "/news/", "/author/", "/video/", "/about", "/contact", "/privacy", "/terms"], disallow: ["/admin", "/dashboard", "/api/", "/login", "/register", "/forgot-password", "/reset-password", "/search", "/dainik/ajker/diganta/s/a/boss", "/d/a/d/my/staff"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: new URL(absoluteUrl("/")).host,
  };
}
