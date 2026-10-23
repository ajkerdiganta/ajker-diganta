"use client";
import { useState } from "react";

type Type = "ADVERTISEMENT" | "NEWSLETTER";
export function FooterSubmissionForm({ type }: { type: Type }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/footer-submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "তথ্য জমা দেওয়া যায়নি");
      setStatus(data.message); setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (error) { setStatus(error instanceof Error ? error.message : "তথ্য জমা দেওয়া যায়নি"); } finally { setBusy(false); }
  }
  const input = "mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-forest";
  return <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-8">
    <label className="text-sm font-bold">নাম <span className="text-red-brand">(ঐচ্ছিক)</span><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
    <label className="text-sm font-bold">ইমেইল *<input required type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
    <label className="text-sm font-bold">ফোন নাম্বার *<input required minLength={5} className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
    <label className="text-sm font-bold">বিষয়<input className={input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
    <label className="text-sm font-bold sm:col-span-2">বিস্তারিত তথ্য *<textarea required minLength={5} rows={6} className="mt-1.5 w-full rounded-xl border border-line p-3 text-sm leading-7" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
    {status && <p role="status" className="sm:col-span-2 rounded-xl border border-line bg-paper-50 px-3 py-2 text-sm">{status}</p>}
    <button disabled={busy} className="rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white sm:col-span-2">{busy ? "জমা হচ্ছে…" : "সাবমিট করুন"}</button>
  </form>;
}
