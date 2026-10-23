import { describe, expect, it } from "vitest";
import { navigationItemSchema } from "@/lib/cms-schemas";

const valid = {
  menuId: "123e4567-e89b-42d3-a456-426614174000",
  label: "বাংলাদেশ",
  href: "/category/bangladesh",
  parentId: null,
  categoryId: null,
  sortOrder: 2,
  isActive: true,
};

describe("navigation item validation", () => {
  it("accepts safe internal paths and HTTPS destinations", () => {
    expect(navigationItemSchema.safeParse(valid).success).toBe(true);
    expect(navigationItemSchema.safeParse({ ...valid, href: "https://news.example/path?q=বাংলা" }).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "//attacker.example", "http://news.example", "\\\\attacker.example", "/a\u0000b", "mailto:news@example.com"]) (
    "rejects unsafe destination %j",
    (href) => expect(navigationItemSchema.safeParse({ ...valid, href }).success).toBe(false),
  );

  it("normalizes Bengali labels and rejects unknown fields or invalid order values", () => {
    const result = navigationItemSchema.safeParse({ ...valid, label: "\u09a6\u09bf\u0997\u09a8\u09cd\u09a4", unexpected: true });
    expect(result.success).toBe(false);
    expect(navigationItemSchema.safeParse({ ...valid, sortOrder: 10_001 }).success).toBe(false);
  });

  it("requires a valid menu UUID and bounded non-empty label", () => {
    expect(navigationItemSchema.safeParse({ ...valid, menuId: "nope" }).success).toBe(false);
    expect(navigationItemSchema.safeParse({ ...valid, label: " " }).success).toBe(false);
  });
});
