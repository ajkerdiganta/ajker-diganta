import type { Metadata } from "next";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs } from "@/components/public/news-components";
import { SubmissionForm } from "@/components/public/submission-form";
import { pageMetadata } from "@/lib/public-seo";

export const metadata: Metadata = pageMetadata({ title: "যোগাযোগ", description: "দৈনিক আজকের দিগন্তের সম্পাদকীয় দলের কাছে যোগাযোগের অনুরোধ পাঠান।", path: "/contact" });

export default function ContactPage() {
  return <PublicFrame><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: "যোগাযোগ" }]}/><p className="text-xs font-bold text-red-brand">পাঠক সেবা</p><h1 className="mt-2 font-serif text-3xl font-bold text-ink sm:text-4xl">যোগাযোগ</h1><p className="mt-3 text-sm leading-7 text-ink-muted">বার্তা সুরক্ষিত নিউজরুম ইনবক্সে জমা হবে। এটি স্বয়ংক্রিয় ইমেইল পাঠায় না।</p><div className="mt-6"><SubmissionForm type="CONTACT" /></div></div></PublicFrame>;
}
