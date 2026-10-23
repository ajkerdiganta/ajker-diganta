import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { PublicFrame } from "@/components/layout/page-frame";
import { Breadcrumbs } from "@/components/public/news-components";
import { getSitePage } from "@/lib/site-content";
import type { SitePageSlug } from "@/lib/site-content-defaults";
import { pageMetadata } from "@/lib/public-seo";

const DRAFT_NOTICES: Partial<Record<SitePageSlug, string>> = {
  privacy: "এই পাতাটি প্রকাশ-পূর্ব সাধারণ খসড়া; প্রযোজ্য আইন ও বাস্তব ডেটা-প্রক্রিয়ার সঙ্গে মিলিয়ে মালিক/আইনজীবীর পর্যালোচনা ছাড়া এটিকে চূড়ান্ত নীতি হিসেবে ব্যবহার করা উচিত নয়।",
  terms: "এই পাতাটি সাধারণ প্রকাশ-পূর্ব খসড়া; প্রযোজ্য আইন ও প্রতিষ্ঠানের নীতির সঙ্গে মিলিয়ে পর্যালোচনা ও অনুমোদনের পরেই চূড়ান্ত শর্ত হিসেবে ব্যবহার করুন।",
};

export async function editableSitePageMetadata(slug: SitePageSlug): Promise<Metadata> {
  const page = await getSitePage(slug);
  return pageMetadata({ title: page.metaTitle || page.title, description: page.metaDescription, path: `/${slug}` });
}

export async function EditableSitePage({ slug }: { slug: SitePageSlug }) {
  const page = await getSitePage(slug);
  const paragraphs = page.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return <PublicFrame><article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: "প্রচ্ছদ", href: "/" }, { label: page.title }]}/><p className="text-xs font-bold text-red-brand">{slug === "about" ? "দৈনিক আজকের দিগন্ত" : "পর্যালোচনার জন্য খসড়া"}</p><h1 className="mt-2 font-serif text-3xl font-bold leading-relaxed text-ink sm:text-4xl">{page.title}</h1>{DRAFT_NOTICES[slug] && <div className="mt-5 rounded-xl border border-[#ead79c] bg-[#fff9e8] p-4 text-sm leading-7 text-[#705a20]"><AlertTriangle className="mr-2 inline" size={17} aria-hidden="true"/>{DRAFT_NOTICES[slug]}</div>}<div className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-5 text-sm leading-8 text-ink-muted sm:p-8">{slug === "about" && <p className="font-serif text-lg font-semibold text-ink">সত্য · সময় · সমাজ</p>}{paragraphs.map((paragraph, index) => <p key={`${slug}-${index}`} className="whitespace-pre-wrap">{paragraph}</p>)}{slug === "about" && <p>সংশোধন বা তথ্যসংক্রান্ত যোগাযোগের জন্য <a className="font-semibold text-forest underline" href="/contact">যোগাযোগ</a> পাতাটি ব্যবহার করুন।</p>}</div></article></PublicFrame>;
}
