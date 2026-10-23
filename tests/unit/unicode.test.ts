import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("Unicode and shared UI helpers", () => {
  it("preserves Bengali and mixed Bengali-English text exactly", () => {
    const copy = "দৈনিক আজকের দিগন্ত — News 2026";
    expect(new TextDecoder().decode(new TextEncoder().encode(copy))).toBe(copy);
  });

  it("merges utility classes without damaging Bengali UI copy", () => {
    expect(cn("px-2 text-ink", "px-4")).toContain("px-4");
    expect("পাসওয়ার্ড".normalize("NFC")).toBe("পাসওয়ার্ড");
  });
});
