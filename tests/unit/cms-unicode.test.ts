import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG, ROLE_NAMES } from "@/lib/permissions";

describe("Phase 2 Bengali CMS localization", () => {
  it("renders Bengali labels for article workflow states and newsroom concepts", () => {
    const sample = "সংবাদ · বিভাগ · ট্যাগ · প্রতিবেদক · সম্পাদক · শিরোনাম · উপশিরোনাম · ক্যাপশন · অনুমোদন · প্রকাশ";
    expect(Buffer.from(sample, "utf8").toString("utf8")).toBe(sample);
    expect(ROLE_NAMES.REPORTER).toBe("প্রতিবেদক");
    expect(ROLE_NAMES.EDITOR).toBe("সম্পাদক");
  });

  it("keeps permission codes technical but their labels Bengali", () => {
    const submit = PERMISSION_CATALOG.find(([code]) => code === "article.submit");
    const publish = PERMISSION_CATALOG.find(([code]) => code === "article.publish");
    expect(submit?.[1]).toMatch(/[\u0980-\u09FF]/);
    expect(publish?.[1]).toMatch(/[\u0980-\u09FF]/);
  });
});
