import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicFrame } from "@/components/layout/page-frame";

export function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <PublicFrame>
      <section className="relative isolate flex min-h-[620px] items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_15%,rgba(34,91,67,0.11),transparent_32%),radial-gradient(ellipse_at_88%_82%,rgba(193,63,51,0.08),transparent_30%)]" />
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-white shadow-[0_24px_70px_-36px_rgba(26,44,34,0.35)] md:grid-cols-[0.82fr_1.18fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden bg-forest p-9 text-white md:flex">
            <div className="absolute -right-16 -top-14 size-56 rounded-full border border-white/10" />
            <div className="absolute -bottom-20 -left-16 size-64 rounded-full border border-white/10" />
            <Link href="/" className="relative inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white"><ArrowLeft size={14} /> প্রচ্ছদে ফিরুন</Link>
            <div className="relative py-12">
              <p className="text-xs font-bold tracking-[0.18em] text-[#e4c67d]">সত্য · সময় · সমাজ</p>
              <p className="mt-5 font-serif text-3xl font-bold leading-[1.45]">বাংলায় খবর,<br />বিশ্বাসের সাথে।</p>
              <p className="mt-5 max-w-xs text-sm leading-7 text-white/70">দৈনিক আজকের দিগন্তের নিরাপদ পাঠক-পরিসরে স্বাগতম।</p>
            </div>
            <p className="relative text-xs text-white/45">নিরাপদ পরিচয় · পাঠক-কেন্দ্রিক ডিজাইন</p>
          </div>
          <div className="px-6 py-9 sm:px-10 sm:py-12 md:px-12">{children}</div>
        </div>
      </section>
    </PublicFrame>
  );
}
