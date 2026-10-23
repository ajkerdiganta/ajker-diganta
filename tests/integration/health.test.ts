import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/health/route";

describe("production health endpoint", () => {
  it("returns only database status and disables intermediary caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", checks: { database: "ok" } });
  });
});

afterAll(async () => { await prisma.$disconnect(); });
