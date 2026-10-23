"use client";

import { useState } from "react";

type Gateway = { method: "NAGAD" | "BKASH" | "ROCKET"; displayName: string; accountNumber: string; transferType: string; instructions: string };
type Status = { active: boolean; subscription: { plan: string; amountBdt: number; expiresAt: Date | string | null } | null; latestPayment: { id: string; method: string; amountBdt: number; status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED"; expiresAt: Date | string; createdAt: Date | string } | null };
const PLANS = [
  { id: "MONTHLY", label: "মাসিক", amount: 60, days: 31, badge: "" },
  { id: "YEARLY", label: "বাৎসরিক", amount: 612, days: 365, badge: "১৫% সাশ্রয়" },
] as const;

export function SubscriptionCheckout({ gateways, initialStatus, accountEmail, initialName }: { gateways: Gateway[]; initialStatus: Status; accountEmail: string; initialName: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [plan, setPlan] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [method, setMethod] = useState<Gateway["method"] | "">(gateways[0]?.method ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const gateway = gateways.find((row) => row.method === method);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!gateway) return;
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = { plan, method, customerName: String(form.get("customerName") ?? ""), phone: String(form.get("phone") ?? ""), address: String(form.get("address") ?? ""), transactionId: String(form.get("transactionId") ?? "") };
    try {
      const response = await fetch("/api/me/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "অনুরোধ জমা হয়নি");
      setStatus((current) => ({ ...current, latestPayment: data.payment }));
      setMessage(data.message ?? "অনুরোধ জমা হয়েছে।");
    } catch (error) { setMessage(error instanceof Error ? error.message : "অনুরোধ জমা হয়নি"); }
    finally { setBusy(false); }
  }
  const expiry = status.subscription?.expiresAt ? new Date(status.subscription.expiresAt).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" }) : "";
  const paymentStatus = status.latestPayment ? ({ PENDING: "যাচাইয়ের অপেক্ষায়", VERIFIED: "অনুমোদিত", REJECTED: "বাতিল", EXPIRED: "সময় শেষ" } as const)[status.latestPayment.status] : "";
  return <div className="space-y-6">
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h2 className="font-serif text-xl font-bold">পাঠক সদস্যতার সুবিধা</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-muted"><li>সংবাদ পরে পড়ার জন্য সংরক্ষণ</li><li>পছন্দের সংবাদ তালিকা</li><li>ব্যক্তিগত ইনবক্সে বিজ্ঞপ্তি</li></ul></section>
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h2 className="font-serif text-xl font-bold">সদস্যতা ও পরিকল্পনা</h2>
      {status.active && <div className="mt-4 rounded-xl border border-forest/30 bg-forest/5 p-4"><p className="font-semibold text-forest">আপনার সদস্যতা সক্রিয়</p><p className="mt-1 text-sm text-ink-muted">মেয়াদ শেষ: {expiry}</p></div>}
      {!status.active && status.latestPayment && <div className="mt-4 rounded-xl border border-line bg-paper-50 p-4"><p className="font-semibold">সর্বশেষ অনুরোধ: {paymentStatus}</p><p className="mt-1 text-xs text-ink-muted">{status.latestPayment.amountBdt.toLocaleString("bn-BD")} টাকা · মেয়াদসীমা {new Date(status.latestPayment.expiresAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</p></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{PLANS.map((item) => <button key={item.id} type="button" disabled={status.active} aria-pressed={plan === item.id} onClick={() => setPlan(item.id)} className={`rounded-xl border p-4 text-left transition ${plan === item.id ? "border-forest bg-forest/5" : "border-line"} disabled:opacity-60`}><span className="flex items-center justify-between font-bold">{item.label}{item.badge && <span className="rounded-full bg-forest/10 px-2 py-1 text-[10px] text-forest">{item.badge}</span>}</span><span className="mt-1 block text-2xl font-bold text-forest">৳{item.amount.toLocaleString("bn-BD")}</span><span className="mt-1 block text-xs text-ink-muted">{item.days.toLocaleString("bn-BD")} দিন</span></button>)}</div>
    </section>
    {!status.active && gateways.length === 0 && <section className="rounded-2xl border border-[#ead79c] bg-[#fff9e8] p-5 text-sm leading-7 text-[#705a20]"><b>ম্যানুয়াল পেমেন্ট এখনো চালু নয়।</b> নিরাপদে কোনো placeholder account দেখানো হচ্ছে না। অনুমোদিত Admin gateway account যোগ ও সক্রিয় করলে এই পাতায় নির্দেশনা দেখাবে।</section>}
    {!status.active && status.latestPayment?.status === "PENDING" && <p role="status" className="rounded-xl border border-[#ead79c] bg-[#fff9e8] p-4 text-sm leading-7 text-[#705a20]">আপনার একটি transfer অনুরোধ যাচাইয়ের অপেক্ষায় আছে। সেটি নিষ্পত্তি বা মেয়াদোত্তীর্ণ না হওয়া পর্যন্ত নতুন অনুরোধ জমা দেওয়া যাবে না।</p>}
    {!status.active && gateways.length > 0 && status.latestPayment?.status !== "PENDING" && <section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h2 className="font-serif text-xl font-bold">ম্যানুয়াল ট্রান্সফার</h2><p className="mt-1 text-sm leading-7 text-ink-muted">নিচের সক্রিয় নম্বরে নির্বাচিত অঙ্ক পাঠিয়ে transaction ID জমা দিন। কোনো gateway API বা স্বয়ংক্রিয় charge নেই; newsroom হাতে যাচাই করবে। অনুরোধ জমার ১৫ মিনিটের মধ্যে যাচাই সম্পন্ন না হলে সেটি মেয়াদোত্তীর্ণ হবে; নতুন অনুরোধের জন্য নতুন transfer/transaction ID লাগবে।</p>
      <form onSubmit={submit} className="mt-5 space-y-4"><fieldset><legend className="text-sm font-semibold">পেমেন্ট পদ্ধতি</legend><div className="mt-2 flex flex-wrap gap-2">{gateways.map((item) => <button key={item.method} type="button" aria-pressed={method === item.method} onClick={() => setMethod(item.method)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${method === item.method ? "border-forest bg-forest/5 text-forest" : "border-line text-ink-muted"}`}>{item.displayName}</button>)}</div></fieldset>
        {gateway && <div className="rounded-xl border border-forest/20 bg-forest/5 p-4"><p className="font-semibold text-forest">{gateway.displayName} · {gateway.transferType}</p><p className="mt-1 text-lg font-bold">{gateway.accountNumber}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-muted">{gateway.instructions}</p><p className="mt-2 text-xs text-ink-muted">পরিমাণ: ৳{PLANS.find((item) => item.id === plan)?.amount.toLocaleString("bn-BD")}</p></div>}
        <label className="block text-sm font-semibold">অ্যাকাউন্ট নাম<input name="customerName" required minLength={2} maxLength={120} defaultValue={initialName} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">অ্যাকাউন্ট ইমেইল<input type="email" readOnly value={accountEmail} className="mt-1 block w-full rounded-lg border border-line bg-paper-50 px-3 py-2.5 text-ink-muted" /></label><label className="block text-sm font-semibold">ফোন<input name="phone" type="tel" required minLength={7} maxLength={40} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label></div>
        <label className="block text-sm font-semibold">ঠিকানা<textarea name="address" required minLength={5} maxLength={1000} rows={2} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5" /></label>
        <label className="block text-sm font-semibold">লেনদেনের Transaction ID<input name="transactionId" required minLength={3} maxLength={120} autoComplete="off" className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 uppercase" /><span className="mt-1 block text-xs font-normal text-ink-muted">শুধু transaction ID দিন; PIN, OTP, password বা card তথ্য কখনো দেবেন না।</span></label>
        <button disabled={busy || !gateway} className="rounded-lg bg-forest px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "জমা হচ্ছে…" : "যাচাইয়ের অনুরোধ জমা দিন"}</button><p role="status" aria-live="polite" className="text-sm text-forest">{message}</p>
      </form>
    </section>}
  </div>;
}
