import { describe, expect, it } from "vitest";
import { resolveAnalyticsRange } from "@/lib/admin-analytics-range";

describe("admin analytics date ranges", () => {
  const now = new Date("2026-09-29T21:00:00.000Z"); // 03:00 on Sep 30 in Dhaka.

  it("uses the Bangladesh-local day for the today filter", () => {
    const range = resolveAnalyticsRange({ period: "today" }, now);
    expect([range.from, range.to]).toEqual(["2026-09-30", "2026-09-30"]);
    expect(range.startAt.toISOString()).toBe("2026-09-29T18:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-09-30T18:00:00.000Z");
  });

  it("includes exactly seven calendar days for the last-seven-days preset", () => {
    const range = resolveAnalyticsRange({ period: "7d" }, now);
    expect([range.from, range.to]).toEqual(["2026-09-24", "2026-09-30"]);
  });

  it("accepts custom ranges and sorts reversed endpoints", () => {
    const range = resolveAnalyticsRange({ period: "custom", from: "2026-09-25", to: "2026-09-20" }, now);
    expect([range.period, range.from, range.to]).toEqual(["custom", "2026-09-20", "2026-09-25"]);
  });

  it("falls back safely for malformed or impossible custom dates", () => {
    const malformed = resolveAnalyticsRange({ period: "custom", from: "2026-99-12", to: "2026-09-30" }, now);
    const unknown = resolveAnalyticsRange({ period: "unexpected", from: "2026-01-01", to: "2026-01-01" }, now);
    expect(malformed.period).toBe("7d");
    expect([unknown.period, unknown.from, unknown.to]).toEqual(["7d", "2026-09-24", "2026-09-30"]);
  });

  it("caps custom ranges at 366 calendar days", () => {
    const range = resolveAnalyticsRange({ period: "custom", from: "2020-01-01", to: "2026-09-30" }, now);
    expect(range.to).toBe("2026-09-30");
    expect(Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)).toBe(365 * 86_400_000);
  });
});
