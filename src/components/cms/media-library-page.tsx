"use client";

import { useState } from "react";
import { ImagePlus, ShieldCheck } from "lucide-react";
import { MediaPicker } from "@/components/cms/media-picker";

export function MediaLibraryPage({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">যাচাইকৃত ছবির ভাণ্ডার</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">মিডিয়া লাইব্রেরি</h1><p className="mt-1 text-sm text-ink-muted">শুধু ছবি—quarantine, WebP re-encode, বাংলা alt/caption ও role-checked selection।</p></div><button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white"><ImagePlus size={16} />লাইব্রেরি খুলুন</button></div>
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-800"><ShieldCheck size={19} /></span><div><h2 className="font-serif font-bold text-ink">নিরাপত্তা যাচাই</h2><p className="mt-1 text-xs text-ink-muted">upload signature · pixel limit · WebP re-encode</p></div></div><p className="mt-4 text-sm leading-6 text-ink-muted">মূল upload public হয় না। finalize ধাপে server-side image decode/metadata verification শেষে quarantine object সরিয়ে নতুন WebP key-তে কপি করা হয়।</p></div><div className={`rounded-2xl border p-5 ${configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs font-bold uppercase tracking-wide">Storage status</p><h2 className="mt-1 font-serif text-lg font-bold">{configured ? "R2-compatible storage প্রস্তুত" : "স্টোরেজ কনফিগার করা নেই"}</h2><p className="mt-2 text-sm leading-6 text-ink-muted">{configured ? "Role-checked signed uploads ও verified-image delivery চালু।" : "Upload ব্যবহারের আগে server-এ .env.example অনুযায়ী R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID ও R2_SECRET_ACCESS_KEY দিন; Bucket CORS-এ আপনার HTTPS site origin-এর POST ও GET অনুমোদন করুন।"}</p></div></section>
    <p className="rounded-xl border border-line bg-white px-4 py-3 text-xs leading-5 text-ink-muted">CDN base URL ছাড়া private signed-read fallback ব্যবহার হয়। `.env`-এর secret client bundle-এ পাঠানো হয় না।</p>
    <MediaPicker open={open} onClose={() => setOpen(false)} />
  </div>;
}
