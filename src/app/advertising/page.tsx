import type { Metadata } from "next";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs } from "@/components/public/news-components";
import { SubmissionForm } from "@/components/public/submission-form";
import { pageMetadata } from "@/lib/public-seo";

export const metadata: Metadata = pageMetadata({ title: "বিজ্ঞাপন", description: "দৈনিক আজকের দিগন্তে বিজ্ঞাপন বিষয়ে অনুরোধ পাঠান।", path: "/advertising" });

export default function AdvertisingPage() {
  return <PublicFrame><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: "বিজ্ঞাপন" }]}/><p className="text-xs font-bold text-red-brand">বাণিজ্যিক যোগাযোগ</p><h1 className="mt-2 font-serif text-3xl font-bold text-ink sm:text-4xl">বিজ্ঞাপন সম্পর্কে যোগাযোগ</h1><p className="mt-3 text-sm leading-7 text-ink-muted">আপনার প্রস্তাব সুরক্ষিত নিউজরুম ইনবক্সে সংরক্ষিত হবে; বিজ্ঞাপন প্রকাশের আগে সম্পাদকীয় ও বাণিজ্যিক পর্যালোচনা প্রয়োজন।</p><div className="mt-6"><SubmissionForm type="ADVERTISEMENT" /></div></div></PublicFrame>;
}
