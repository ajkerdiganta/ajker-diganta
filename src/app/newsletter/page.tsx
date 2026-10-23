import type { Metadata } from "next";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs } from "@/components/public/news-components";
import { SubmissionForm } from "@/components/public/submission-form";
import { pageMetadata } from "@/lib/public-seo";

export const metadata: Metadata = pageMetadata({ title: "নিউজলেটার", description: "দৈনিক আজকের দিগন্তের নিউজলেটারে আগ্রহ জানাতে অনুরোধ পাঠান।", path: "/newsletter" });

export default function NewsletterPage() {
  return <PublicFrame><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: "নিউজলেটার" }]}/><p className="text-xs font-bold text-red-brand">পাঠক সেবা</p><h1 className="mt-2 font-serif text-3xl font-bold text-ink sm:text-4xl">নিউজলেটার সম্পর্কে আগ্রহ</h1><p className="mt-3 text-sm leading-7 text-ink-muted">আপনার আগ্রহ সংরক্ষিত হবে। নিউজলেটার পাঠানো/সাবস্ক্রিপশন চালু করতে আলাদা অনুমোদিত ইমেইল সেবা প্রয়োজন।</p><div className="mt-6"><SubmissionForm type="NEWSLETTER" /></div></div></PublicFrame>;
}
