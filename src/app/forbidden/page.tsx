import Link from "next/link";
import { PublicFrame } from "@/components/layout/page-frame";

export default function ForbiddenPage() {
  return <PublicFrame><section className="mx-auto max-w-xl px-4 py-24 text-center"><p className="text-sm font-bold tracking-widest text-red-brand">৪০৩ · প্রবেশাধিকার নেই</p><h1 className="mt-4 font-serif text-3xl font-bold text-ink">এই পাতায় প্রবেশের অনুমতি নেই</h1><p className="mt-3 text-sm leading-7 text-ink-muted">আপনার অ্যাকাউন্টে এই কাজের অনুমতি নেই।</p><Link href="/dashboard" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-forest px-5 text-sm font-semibold text-white">ড্যাশবোর্ডে ফিরুন</Link></section></PublicFrame>;
}
