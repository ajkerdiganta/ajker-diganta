import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs } from "@/components/public/news-components";
import { SubscriptionCheckout } from "@/components/public/subscription-checkout";
import { getPrincipal } from "@/lib/authorization";
import { pageMetadata } from "@/lib/public-seo";
import { prisma } from "@/lib/prisma";
import { getPublicPaymentGateways, getSubscriptionStatus } from "@/lib/subscription-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({ title: "পাঠক সদস্যতা", description: "সংবাদ সংরক্ষণ, পছন্দ ও ইনবক্স বিজ্ঞপ্তির জন্য পাঠক সদস্যতা।", path: "/subscribe" });

type Props = { searchParams: Promise<{ required?: string }> };

export default async function SubscribePage({ searchParams }: Props) {
  const query = await searchParams;
  const principal = await getPrincipal(new Headers(await headers()));
  const gateways = await getPublicPaymentGateways();
  const user = principal ? await prisma.user.findUnique({ where: { id: principal.id }, select: { name: true, email: true } }) : null;
  const status = principal ? await getSubscriptionStatus(principal.id) : null;
  return <PublicFrame><div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: "সদস্যতা" }]}/><p className="text-xs font-bold text-red-brand">পাঠক সেবা</p><h1 className="mt-2 font-serif text-3xl font-bold text-ink sm:text-4xl">পাঠক সদস্যতা</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">মাসিক ৳৬০ (৩১ দিন) অথবা বাৎসরিক ৳৬১২ (৩৬৫ দিন; ১৫% সাশ্রয়)। সদস্যতা সক্রিয় হলে সংবাদ সংরক্ষণ, পছন্দের তালিকা ও ইনবক্স বিজ্ঞপ্তি ব্যবহার করা যাবে। পেমেন্ট কেবল Admin-সক্রিয় manual transfer নম্বরে—কোনো স্বয়ংক্রিয় charge নেই।</p>{query.required && <p role="status" className="mt-4 rounded-xl border border-[#ead79c] bg-[#fff9e8] p-4 text-sm leading-7 text-[#705a20]">এই সুবিধা ব্যবহারের জন্য সক্রিয় সদস্যতা প্রয়োজন।</p>}
    {user && status ? <div className="mt-6"><SubscriptionCheckout gateways={gateways} initialStatus={status} accountEmail={user.email} initialName={user.name}/></div> : <div className="mt-6 space-y-5"><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h2 className="font-serif text-xl font-bold">সদস্যতার সুবিধা</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-muted"><li>সংবাদ পরে পড়ার জন্য সংরক্ষণ</li><li>পছন্দের সংবাদ তালিকা</li><li>ব্যক্তিগত ইনবক্সে বিজ্ঞপ্তি</li></ul><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-line p-4"><b>মাসিক</b><p className="mt-1 text-2xl font-bold text-forest">৳৬০</p><p className="text-xs text-ink-muted">৩১ দিন</p></div><div className="rounded-xl border border-forest bg-forest/5 p-4"><b>বাৎসরিক</b><p className="mt-1 text-2xl font-bold text-forest">৳৬১২</p><p className="text-xs text-ink-muted">৩৬৫ দিন · ১৫% সাশ্রয়</p></div></div><Link href="/login?next=%2Fsubscribe" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-forest px-5 font-semibold text-white">লগইন করে চালিয়ে যান</Link></section></div>}
    </div></PublicFrame>;
}
