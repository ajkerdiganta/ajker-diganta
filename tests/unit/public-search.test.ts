import { describe, expect, it } from "vitest";
import { normalizeSearchQuery } from "@/lib/public-search-normalize";

describe("Bengali public search query normalization", () => {
  it("normalizes Unicode and Bengali punctuation while preserving terms", () => {
    expect(normalizeSearchQuery("  বাংলাদেশ, ঢাকা।   বিশ্ববিদ্যালয়! ")).toBe("বাংলাদেশ ঢাকা বিশ্ববিদ্যালয়");
  });

  it("handles mixed Bengali-English and collapses Unicode whitespace", () => {
    expect(normalizeSearchQuery("বাংলাদেশ\u00a0Cyber   Security—AI")).toBe("বাংলাদেশ Cyber Security AI");
  });

  it("keeps search text bounded and trims the result", () => {
    expect(normalizeSearchQuery(`${"ঢাকা ".repeat(30)}tail`).length).toBeLessThanOrEqual(100);
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});
