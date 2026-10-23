import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`SELECT 1 AS ok`);
    return NextResponse.json({ status: "ok", checks: { database: "ok" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", checks: { database: "unavailable" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
