import Link from "next/link";

type PublicIssue = {
  id: string;
  caption: string;
  issueTitle: string;
  publicationMonth: number;
  publicationYear: number;
  releaseDate: Date | string | null;
  subjectSummary: string;
  editorName: string | null;
  publisherName: string | null;
  coverImageUrl: string | null;
  description: string | null;
};
export type PublicPackage = {
  id: string;
  code: string;
  category: "NEWSPAPER" | "MAGAZINE" | "KNOWLEDGE" | "GUIDEBOOK";
  title: string;
  description: string;
  durationLabel: string;
  durationMonths: number | null;
  durationDays: number;
  benefits: string[];
  terms: string;
  issues: PublicIssue[];
};

type Props = { packages: PublicPackage[]; authenticated: boolean };
const categoryLabels = { NEWSPAPER: "দৈনিক সংবাদ প্যাকেজ", MAGAZINE: "মাসিক ম্যাগাজিন", KNOWLEDGE: "আসুন জেনে নেই", GUIDEBOOK: "এসো দক্ষতা বাড়াই" } as const;
const monthNames = ["", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

function packageHref(id: string, authenticated: boolean) {
  const next = `/subscribe?package=${encodeURIComponent(id)}`;
  return authenticated ? next : `/login?next=${encodeURIComponent(next)}`;
}

export function SubscriptionCatalog({ packages, authenticated }: Props) {
  const newspaper = packages.filter((item) => item.category === "NEWSPAPER");
  const editorial = packages.filter((item) => item.category !== "NEWSPAPER");
  return <div className="space-y-12">
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-forest/30 pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">পাঠক সেবা</p><h2 className="mt-2 font-serif text-3xl font-bold text-ink">আপনার পড়ার সময়, আপনার প্যাকেজ</h2></div><p className="max-w-md text-sm leading-7 text-ink-muted">প্যাকেজের মূল্য ও আবেদন-সংক্রান্ত তথ্য লগইনের পর নিরাপদে দেখানো হবে। এখানে সক্রিয় প্যাকেজ, সুবিধা এবং প্রকাশনা তথ্য দেখে পছন্দ করুন।</p></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{newspaper.map((item) => <PackageCard key={item.id} item={item} authenticated={authenticated} />)}</div>
    </section>
    <section className="space-y-7">
      <div className="border-b border-forest/30 pb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">বিশেষ প্রকাশনা</p><h2 className="mt-2 font-serif text-3xl font-bold text-ink">ম্যাগাজিন ও গাইডবুক</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">সম্পাদকীয় জ্ঞান, কৌতূহল ও ব্যবহারিক দক্ষতার জন্য আলাদা বিভাগ। প্রশাসক প্রকাশনা তথ্য যোগ করলে এখানে ইস্যু কার্ড দেখা যাবে।</p></div>
      {editorial.map((item) => <section key={item.id} className="rounded-3xl border border-[#d9c7a8] bg-white p-5 shadow-[0_18px_50px_rgba(37,91,69,0.07)] sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-red-brand">{categoryLabels[item.category]}</p><h3 className="mt-1 font-serif text-2xl font-bold text-ink">{item.title}</h3><p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">{item.description}</p></div><Link href={packageHref(item.id, authenticated)} className="inline-flex min-h-11 items-center rounded-xl bg-forest px-5 text-sm font-bold text-white transition hover:bg-forest/90">সাবস্ক্রাইব করুন</Link></div><div className="mt-6">{item.issues.length ? <div className="grid gap-4 md:grid-cols-2">{item.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</div> : <div className="rounded-2xl border border-dashed border-line bg-paper-50 p-5 text-sm leading-7 text-ink-muted">প্রথম ইস্যুর তথ্য শিগগিরই প্রকাশিত হবে। প্রকাশনা মাস, বিষয়, সম্পাদক ও প্রকাশকের তথ্য Admin CMS থেকে যোগ করা যাবে।</div>}</div></section>)}
    </section>
  </div>;
}

function PackageCard({ item, authenticated }: { item: PublicPackage; authenticated: boolean }) {
  return <article className="group flex flex-col rounded-3xl border border-[#d9c7a8] bg-white p-5 shadow-[0_18px_50px_rgba(37,91,69,0.06)] transition hover:-translate-y-0.5 hover:border-forest/50 sm:p-6"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest">{item.durationLabel}</span><span className="text-xs font-semibold text-ink-muted">{item.durationDays.toLocaleString("bn-BD")} দিন</span></div><h3 className="mt-5 font-serif text-xl font-bold text-ink">{item.title}</h3><p className="mt-2 min-h-14 text-sm leading-7 text-ink-muted">{item.description}</p><ul className="mt-5 flex-1 space-y-2 border-t border-line pt-4 text-sm leading-6 text-ink-muted">{item.benefits.map((benefit) => <li key={benefit} className="flex gap-2"><span className="text-red-brand">•</span><span>{benefit}</span></li>)}</ul><p className="mt-5 text-xs leading-6 text-ink-muted">{item.terms}</p><Link href={packageHref(item.id, authenticated)} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-forest px-4 text-sm font-bold text-forest transition hover:bg-forest hover:text-white">সাবস্ক্রাইব করুন</Link></article>;
}

function IssueCard({ issue }: { issue: PublicIssue }) {
  return <article className="overflow-hidden rounded-2xl border border-line bg-paper-50"><div className="flex min-h-36 gap-4 p-4">{issue.coverImageUrl ? <img src={issue.coverImageUrl} alt={issue.issueTitle} className="h-32 w-24 rounded-xl object-cover" /> : <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-center text-xs font-bold text-forest">কভার<br />শিগগিরই</div>}<div className="min-w-0"><p className="text-xs font-bold text-red-brand">{issue.caption}</p><h4 className="mt-1 font-serif text-lg font-bold text-ink">{issue.issueTitle}</h4><p className="mt-1 text-xs font-semibold text-forest">{monthNames[issue.publicationMonth]} {issue.publicationYear.toLocaleString("bn-BD")}</p><p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-muted">{issue.subjectSummary}</p></div></div><div className="border-t border-line px-4 py-3 text-xs leading-6 text-ink-muted"><p>{issue.editorName ? `সম্পাদক: ${issue.editorName}` : "সম্পাদক: তথ্য যোগ করা হবে"}</p><p>{issue.publisherName ? `প্রকাশক: ${issue.publisherName}` : "প্রকাশক: তথ্য যোগ করা হবে"}</p></div></article>;
}
