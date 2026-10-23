import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { GET as getFeed } from "@/app/feed.xml/route";

describe("public SEO route smoke tests", () => {
  it("builds canonical sitemap and robots rules for the Bengali public route set", async () => {
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/latest"))).toBe(true);
    expect(entries.every((entry) => entry.url.startsWith("http"))).toBe(true);
    const directives = robots();
    expect(directives.sitemap).toContain("/sitemap.xml");
    const rules = Array.isArray(directives.rules) ? directives.rules : directives.rules ? [directives.rules] : [];
    const denied = rules.flatMap((rule) => Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : []);
    expect(denied).toContain("/admin");
    expect(denied).toContain("/dashboard");
  });

  it("returns Bengali RSS XML with a safe public content type", async () => {
    const response = await getFeed();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await response.text()).toContain("দৈনিক আজকের দিগন্ত");
  });
});

afterAll(async () => { await prisma.$disconnect(); });
