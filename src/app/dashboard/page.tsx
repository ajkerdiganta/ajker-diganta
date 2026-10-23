import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserDashboard } from "@/components/personalization/dashboard-client";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { getPersonalizationDashboard } from "@/lib/personalization";
import { getSubscriptionStatus } from "@/lib/subscription-service";

export const metadata: Metadata = { title: "আমার ড্যাশবোর্ড", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/login?next=%2Fdashboard");
  if (!(await hasPermission(principal.id, "dashboard.access"))) redirect("/forbidden");
  const [dashboard, membership] = await Promise.all([getPersonalizationDashboard(principal.id), getSubscriptionStatus(principal.id)]);
  const data = {
    ...dashboard,
    savedArticles: membership.active ? dashboard.savedArticles : [],
    favouriteArticles: membership.active ? dashboard.favouriteArticles : [],
    counts: membership.active ? dashboard.counts : { ...dashboard.counts, saved: 0, favourites: 0, unreadNotifications: 0 },
    membership: { active: membership.active, plan: membership.subscription?.plan ?? null, expiresAt: membership.subscription?.expiresAt ?? null },
  };

  return <main className="min-h-screen bg-paper-50 text-ink">
    <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8"><Link href="/" className="font-serif text-lg font-bold text-forest">দৈনিক আজকের দিগন্ত</Link><div className="flex items-center gap-3"><span className="hidden text-sm text-ink-muted sm:inline">স্বাগতম, <b className="text-ink">{principal.name}</b></span><SignOutButton /></div></div></header>
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-forest hover:underline"><ArrowLeft size={15} /> প্রচ্ছদে ফিরুন</Link></div>
    <UserDashboard initialData={data} />
  </main>;
}
