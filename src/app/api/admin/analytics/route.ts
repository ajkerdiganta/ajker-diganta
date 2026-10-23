import { NextResponse } from "next/server";
import { getAdminAnalytics } from "@/lib/admin-analytics";
import { getPrincipal, hasPermission } from "@/lib/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return NextResponse.json({ error: "অনুমোদিত নয়" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  if (!(await hasPermission(principal.id, "analytics.read"))) {
    return NextResponse.json({ error: "এই কাজের অনুমতি নেই" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const params = new URL(request.url).searchParams;
    const analytics = await getAdminAnalytics({ period: params.get("period") ?? undefined, from: params.get("from") ?? undefined, to: params.get("to") ?? undefined });
    return NextResponse.json(analytics, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[AdminAnalytics] aggregate query failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "পরিসংখ্যান এখন পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন।" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
