import { NextResponse } from "next/server";
import { getPublicSubscriptionPackages } from "@/lib/subscription-service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getPublicSubscriptionPackages(), { headers: { "Cache-Control": "public, max-age=60" } });
}
