import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CmsFrame } from "@/components/cms/cms-frame";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { getAdminActiveSubscribers } from "@/lib/subscription-service";

export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "payments.read")) || !(await hasPermission(principal.id, "users.read"))) notFound();
  const subscribers = await getAdminActiveSubscribers();

  return <CmsFrame><div className="space-y-5">
    <header><p className="text-xs font-bold text-forest">ব্যক্তিগত তথ্য · শুধু Admin / Super Admin</p><h1 className="mt-1 font-serif text-3xl font-bold">সক্রিয় Subscriber</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">এখানে শুধু বর্তমানে সক্রিয় সদস্যতা আছে এমন অ্যাকাউন্ট দেখানো হয়। ফোন account profile থেকে; profile-এ না থাকলে verified payment-এর encrypted phone এখানে server-side decrypt করে দেখানো হয়।</p><Link href="/admin/subscriptions" className="mt-3 inline-flex rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-forest">Payment যাচাই queue</Link></header>
    <div className="overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-paper-100 text-xs text-ink-muted"><tr><th className="p-3">Subscriber</th><th className="p-3">ফোন</th><th className="p-3">Plan</th><th className="p-3">শুরু</th><th className="p-3">মেয়াদ শেষ</th></tr></thead><tbody className="divide-y divide-line">{subscribers.map((item) => <tr key={item.id}><td className="p-3"><p className="font-semibold">{item.user.name}</p><p className="text-xs text-ink-muted">{item.user.email}</p></td><td className="p-3 text-xs">{item.phone || "দেওয়া হয়নি"}</td><td className="p-3 text-xs">{item.plan === "MONTHLY" ? "মাসিক" : "বাৎসরিক"} · ৳{item.amountBdt.toLocaleString("bn-BD")}</td><td className="p-3 text-xs text-ink-muted">{item.startedAt?.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" }) ?? "—"}</td><td className="p-3 text-xs text-ink-muted">{item.expiresAt?.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" }) ?? "—"}</td></tr>)}</tbody></table>{subscribers.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">এখনো কোনো সক্রিয় Subscriber নেই।</p>}</div>
    <p className="text-xs leading-6 text-ink-muted">সর্বোচ্চ ৫০০টি সক্রিয় সদস্যতা দেখানো হয়। Suspended বা অপসারিত account এখানে আসে না। Payment request ও transaction PII আলাদা verification page-এ সীমিত থাকে।</p>
  </div></CmsFrame>;
}
