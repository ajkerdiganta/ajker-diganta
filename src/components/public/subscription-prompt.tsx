"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export function SubscriptionPrompt() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const show = () => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpen(true); };
    window.addEventListener("subscription:required", show);
    return () => window.removeEventListener("subscription:required", show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener("keydown", onKeyDown); returnFocus.current?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 motion-safe:animate-[fade-in_150ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="subscription-required-title" tabIndex={-1} className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full text-ink-muted hover:bg-paper-100 focus-visible:outline-2 focus-visible:outline-forest"><X size={20}/></button><p className="text-xs font-bold text-red-brand">পাঠক সদস্যতা</p><h2 id="subscription-required-title" className="mt-2 pr-8 font-serif text-2xl font-bold text-ink">এই সুবিধার জন্য সদস্যতা প্রয়োজন</h2><p className="mt-2 text-sm leading-7 text-ink-muted">সংবাদ সংরক্ষণ, পছন্দের তালিকা ও ইনবক্স বিজ্ঞপ্তি ব্যবহার করতে মাসিক ৳৬০ অথবা বাৎসরিক ৳৬১২-এর সদস্যতা নিন।</p><Link href="/subscribe?required=1" onClick={() => setOpen(false)} className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-forest px-4 font-semibold text-white">প্ল্যান দেখুন</Link></div></div>;
}
