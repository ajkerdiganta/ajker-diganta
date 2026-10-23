"use client";

import { useState } from "react";

type SubmissionType = "CONTACT" | "ADVERTISEMENT" | "NEWSLETTER";
const COPY: Record<SubmissionType, { name: string; subject: string; message: string; phoneOptional: boolean }> = {
  CONTACT: { name: "যোগাযোগ", subject: "বিষয়", message: "আপনার বার্তা", phoneOptional: true },
  ADVERTISEMENT: { name: "বিজ্ঞাপন", subject: "প্রচারণার বিবরণ", message: "ক্যাম্পেইন বা প্রস্তাবের বিবরণ", phoneOptional: false },
  NEWSLETTER: { name: "নিউজলেটার", subject: "আগ্রহ/বার্তা", message: "আপনার আগ্রহ বা বার্তা", phoneOptional: false },
};

export function SubmissionForm({ type }: { type: SubmissionType }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[type];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload: Record<string, string | boolean> = { type, name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? ""), subject: String(form.get("subject") ?? ""), message: String(form.get("message") ?? ""), website: String(form.get("website") ?? "") };
    if (type === "NEWSLETTER") payload.consent = form.get("consent") === "on";
    if (type === "CONTACT" && !String(payload.phone ?? "").trim()) delete payload.phone;
    if (type === "NEWSLETTER" && !String(payload.subject ?? "").trim()) delete payload.subject;
    try {
      const response = await fetch("/api/public/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "অনুরোধ সংরক্ষণ করা যায়নি");
      setStatus(result.message ?? "তথ্য সংরক্ষণ করা হয়েছে।"); formElement.reset();
    } catch (error) { setStatus(error instanceof Error ? error.message : "অনুরোধ সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-5 sm:p-7">
    <label className="block text-sm font-semibold">নাম<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">ইমেইল<input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label><label className="block text-sm font-semibold">ফোন{copy.phoneOptional ? " (ঐচ্ছিক)" : ""}<input name="phone" type="tel" required={!copy.phoneOptional} maxLength={40} autoComplete="tel" className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label></div>
    <label className="block text-sm font-semibold">{copy.subject}<input name="subject" required={type !== "NEWSLETTER"} maxLength={180} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label>
    <label className="block text-sm font-semibold">{copy.message}<textarea name="message" required minLength={5} maxLength={10000} rows={5} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 leading-7" /></label>
    {type === "NEWSLETTER" && <label className="flex items-start gap-2 text-sm leading-6"><input name="consent" type="checkbox" required className="mt-1 size-4 accent-forest" />আমি নিউজলেটার সংক্রান্ত ভবিষ্যৎ যোগাযোগের জন্য আমার ইমেইল সংরক্ষণে সম্মতি দিচ্ছি। যেকোনো সময় newsroom-এ যোগাযোগ করে সম্মতি প্রত্যাহার করতে পারব।</label>}
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label>এই ঘর ফাঁকা রাখুন<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button disabled={busy} className="rounded-lg bg-forest px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "পাঠানো হচ্ছে…" : "অনুরোধ জমা দিন"}</button>
    <p role="status" aria-live="polite" className="min-h-6 text-sm text-forest">{status}</p>
    <p className="text-xs leading-6 text-ink-muted">এই ফর্ম তথ্যটি নিউজরুমের সুরক্ষিত ইনবক্সে সংরক্ষণ করে; এটি স্বয়ংক্রিয় ইমেইল বা নিউজলেটার পাঠায় না।</p>
  </form>;
}
