import { describe, expect, it } from "vitest";
import { videoRouteSlug } from "@/lib/public-video";

describe("public video slugs", () => {
  it("uses a stable ASCII route plus an immutable YouTube identifier", () => {
    expect(videoRouteSlug("ঢাকার সংবাদ সাক্ষাৎকার", "abcdefgh123")).toBe("video--yt-abcdefgh123");
    expect(videoRouteSlug("পরিবর্তিত ভিডিও শিরোনাম", "abcdefgh123")).toBe("video--yt-abcdefgh123");
  });

});
