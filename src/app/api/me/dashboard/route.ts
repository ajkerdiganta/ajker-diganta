import { NextResponse } from "next/server";
import { getPersonalizationDashboard } from "@/lib/personalization";
import { getPrincipal } from "@/lib/authorization";
import { getSubscriptionStatus } from "@/lib/subscription-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return NextResponse.json({ error: "লগইন প্রয়োজন" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const [dashboard, membership] = await Promise.all([getPersonalizationDashboard(principal.id), getSubscriptionStatus(principal.id)]);
    const data = {
      ...dashboard,
      savedArticles: membership.active ? dashboard.savedArticles : [],
      favouriteArticles: membership.active ? dashboard.favouriteArticles : [],
      counts: membership.active ? dashboard.counts : { ...dashboard.counts, saved: 0, favourites: 0, unreadNotifications: 0 },
      membership: { active: membership.active, plan: membership.subscription?.plan ?? null, expiresAt: membership.subscription?.expiresAt ?? null },
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "ড্যাশবোর্ডের তথ্য এখন পাওয়া যাচ্ছে না" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
