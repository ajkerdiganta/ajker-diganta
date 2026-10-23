import { describe, expect, it } from "vitest";
import { formatBangladeshDateTime, formatBangladeshShortDate, localTimeLine } from "@/lib/public-format";

describe("Bengali Bangladesh-local date presentation", () => {
  it("formats UTC timestamps in Asia/Dhaka, never as stored localized strings", () => {
    const instant = new Date("2026-09-26T14:30:00.000Z");
    const value = formatBangladeshDateTime(instant);
    expect(value).toContain("২৬ সেপ্টেম্বর ২০২৬");
    expect(value).toContain("রাত");
    expect(value).toContain("৮:৩০");
    expect(formatBangladeshShortDate(instant)).toContain("২৬");
  });

  it("renders a Bengali masthead date line", () => {
    expect(localTimeLine(new Date("2026-09-26T14:30:00.000Z"))).toContain("ঢাকা");
  });
});
