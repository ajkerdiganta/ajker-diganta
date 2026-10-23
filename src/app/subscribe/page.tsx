import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs } from "@/components/public/news-components";
import { SubscriptionCatalog } from "@/components/public/subscription-catalog";
import { SubscriptionCheckout } from "@/components/public/subscription-checkout";
import { getPrincipal } from "@/lib/authorization";
import { pageMetadata } from "@/lib/public-seo";
import { prisma } from "@/lib/prisma";
import { getPublicPaymentGateways, getPublicSubscriptionPackages, getSubscriptionPackageForCustomer, getSubscriptionStatus } from "@/lib/subscription-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({ title: "পাঠক সদস্যতা", description: "দৈনিক সংবাদ, ম্যাগাজিন ও ব্যবহারিক গাইডবুকের জন্য কনফিগারযোগ্য পাঠক প্যাকেজ।", path: "/subscribe" });

type Props = { searchParams: Promise<{ required?: string; package?: string }> };

export default async function SubscribePage({ searchParams }: Props) {
  const query = await searchParams;
  const principal = await getPrincipal(new Headers(await headers()));
  const packages = await getPublicSubscriptionPackages();
  const selectedPackage = principal && query.package ? await getSubscriptionPackageForCustomer(query.package) : null;
  const user = principal ? await prisma.user.findUnique({ where: { id: principal.id }, select: { name: true, email: true } }) : null;
  const status = principal ? await getSubscriptionStatus(principal.id) : null;
  const gateways = principal ? await getPublicPaymentGateways() : [];
  return <PublicFrame><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: "সদস্যতা" }]} /><p className="text-xs font-bold text-red-brand">পাঠক সেবা</p><h1 className="mt-2 font-serif text-4xl font-bold text-ink sm:text-5xl">দৈনিক আজকের দিগন্তের সাবস্ক্রিপশন</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-ink-muted">সংবাদ, জ্ঞান ও দক্ষতার নির্বাচিত প্যাকেজ থেকে আপনার প্রয়োজনেরটি বেছে নিন। মূল্য ও আবেদন ফর্ম কেবল নিরাপদ লগইনের পর দেখানো হয়।</p>{query.required && <p role="status" className="mt-5 rounded-2xl border border-[#ead79c] bg-[#fff9e8] p-4 text-sm leading-7 text-[#705a20]">এই সুবিধা ব্যবহারের জন্য সক্রিয় সদস্যতা প্রয়োজন।</p>}<div className="mt-10"><SubscriptionCatalog packages={packages} authenticated={Boolean(principal)} /></div>{principal && user && status && selectedPackage ? <section className="mt-12 rounded-3xl border border-forest/20 bg-forest/5 p-4 sm:p-7"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold text-red-brand">নিরাপদ আবেদন</p><h2 className="mt-1 font-serif text-2xl font-bold">{selectedPackage.title}</h2><p className="mt-1 text-sm text-ink-muted">প্যাকেজের মূল্য, প্রয়োজনীয় তথ্য ও পেমেন্ট ধাপ এখানে দেখা যাবে।</p></div><Link href="/subscribe" className="text-sm font-semibold text-forest underline">অন্য প্যাকেজ বেছে নিন</Link></div><SubscriptionCheckout gateways={gateways} initialStatus={status} accountEmail={user.email} initialName={user.name} selectedPackage={selectedPackage} /></section> : principal && user && status ? <section className="mt-12 rounded-3xl border border-line bg-white p-6 text-center sm:p-8"><h2 className="font-serif text-2xl font-bold">আবেদন শুরু করতে একটি প্যাকেজ বেছে নিন</h2><p className="mt-2 text-sm leading-7 text-ink-muted">প্যাকেজ কার্ডের “সাবস্ক্রাইব করুন” বোতামে ক্লিক করলে আপনার জন্য মূল্য ও আবেদন ফর্ম খুলবে।</p></section> : <section className="mt-12 rounded-3xl border border-forest/20 bg-forest p-6 text-white sm:p-8"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-bold text-[#f6d889]">নিরাপদ গ্রাহক তথ্য</p><h2 className="mt-1 font-serif text-2xl font-bold">পছন্দের প্যাকেজে আবেদন করতে লগইন করুন</h2><p className="mt-2 text-sm leading-7 text-white/75">আপনার নির্বাচিত প্যাকেজ লগইন বা নিবন্ধনের পরেও সংরক্ষিত থাকবে।</p></div><Link href="/login?next=%2Fsubscribe" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-bold text-forest">লগইন / নিবন্ধন</Link></div></section>}</div></PublicFrame>;
}
