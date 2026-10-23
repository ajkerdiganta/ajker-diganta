import { describe, expect, it } from "vitest";
import { normalizeArticleBody } from "@/lib/article-content";
import { asciiSlug } from "@/lib/slug";

const mediaId = "25f65ce9-4b97-4469-9d93-665817237fca";

describe("Bengali CMS content handling", () => {
  it("keeps Bengali and mixed-script text in NFC while creating stable ASCII routes", () => {
    expect("বাংলা".normalize("NFC")).toBe("বাংলা");
    expect(asciiSlug("বাংলা খবর — Dhaka 24")).toBe("baanlaa-khbr-dhaka-24");
    expect(asciiSlug(" ")).toBe("news-news");
    expect(asciiSlug("admin")).toBe("admin-news");
    expect(asciiSlug("বাংলা খবর — Dhaka 24")).toMatch(/^[a-z0-9-]+$/);
  });

  it("converts mixed Bengali/English TipTap content and strips executable links/markup", () => {
    const result = normalizeArticleBody({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2, onclick: "alert(1)" }, content: [{ type: "text", text: "ঢাকায় ‘বাংলা’ news today" }] },
        { type: "paragraph", content: [{ type: "text", text: "<script>alert('x')</script> — বাংলা সংবাদ", marks: [{ type: "link", attrs: { href: "javascript:alert(document.cookie)", target: "_blank" } }] }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "‘সত্য ও সময়’", marks: [{ type: "bold" }] }] }] },
      ],
    });
    expect(result.html).toContain("ঢাকায় ‘বাংলা’ news today");
    expect(result.html).toContain("বাংলা সংবাদ");
    expect(result.html).not.toMatch(/<script|javascript:|onclick|document\.cookie/i);
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.json.content?.[0]?.attrs).toEqual({ level: 2 });
    expect(result.json.content?.[0]?.attrs).not.toHaveProperty("onclick");
    expect(result.html).toContain("<blockquote>");
  });

  it("rewrites media URLs to the own-library endpoint and strips arbitrary client sources", () => {
    const result = normalizeArticleBody({
      type: "doc",
      content: [{ type: "image", attrs: { mediaId, src: "https://attacker.invalid/pixel.svg", alt: "বাংলা ক্যাপশন", onerror: "alert(1)" } }],
    });
    expect(result.mediaIds).toEqual([mediaId]);
    expect(result.html).toContain(`/api/media/${mediaId}`);
    expect(result.html).not.toContain("attacker.invalid");
    expect(result.html).not.toContain("onerror");
  });

  it("rejects unknown nodes and media images without a vetted media ID", () => {
    expect(() => normalizeArticleBody({ type: "doc", content: [{ type: "script", content: [] }] })).toThrow(/unsupported|অসমর্থিত/i);
    expect(() => normalizeArticleBody({ type: "doc", content: [{ type: "image", attrs: { src: "https://attacker.invalid/x.png" } }] })).toThrow(/মিডিয়া লাইব্রেরি/);
  });

  it("enforces body byte limits before parsing", () => {
    const text = "খ".repeat(800_000);
    expect(() => normalizeArticleBody({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })).toThrow(/বড়/);
  });

  it("rejects deeply nested or cyclic editor payloads before recursive processing", () => {
    const deep: Record<string, unknown> = { value: "বাংলা" };
    let cursor = deep;
    for (let index = 0; index < 80; index += 1) {
      const child: Record<string, unknown> = {};
      cursor.child = child;
      cursor = child;
    }
    expect(() => normalizeArticleBody({ type: "doc", content: [], attrs: deep })).toThrow(/স্তরসীমা/);

    const cyclic: { type: string; content: unknown[] } = { type: "doc", content: [] };
    cyclic.content.push(cyclic);
    expect(() => normalizeArticleBody(cyclic)).toThrow(/সঠিক নয়/);
  });
});
