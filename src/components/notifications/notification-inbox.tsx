"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Check, LoaderCircle } from "lucide-react";
import { formatBangladeshDateTime } from "@/lib/public-format";

type NotificationItem = {
  id: string;
  type: "BREAKING_NEWS" | "TOPIC" | "VIDEO" | "SYSTEM";
  priority: "NORMAL" | "HIGH" | "URGENT";
  title: string;
  message: string;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};
type InboxData = { items: NotificationItem[]; page: number; total: number; totalPages: number; unreadCount: number };
const typeLabel: Record<NotificationItem["type"], string> = { BREAKING_NEWS: "ব্রেকিং নিউজ", TOPIC: "অনুসরণ করা বিষয়", VIDEO: "ভিডিও", SYSTEM: "সিস্টেম" };
const priorityLabel: Record<NotificationItem["priority"], string> = { NORMAL: "সাধারণ", HIGH: "গুরুত্বপূর্ণ", URGENT: "জরুরি" };

export function NotificationInbox({ initialData, initialUnreadOnly = false }: { initialData: InboxData; initialUnreadOnly?: boolean }) {
  const [data, setData] = useState(initialData);
  const [unreadOnly, setUnreadOnly] = useState(initialUnreadOnly);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState("");

  async function loadPage(page: number, filter = unreadOnly, append = false) {
    setBusyId("page"); setError("");
    try {
      const query = new URLSearchParams({ page: String(page), ...(filter ? { unread: "true" } : {}) });
      const response = await fetch(`/api/me/notifications?${query}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as InboxData & { error?: string };
      if (response.status === 402) window.dispatchEvent(new Event("subscription:required"));
      if (!response.ok) throw new Error(payload.error || "বিজ্ঞপ্তি লোড করা যায়নি।");
      setData((current) => ({ ...payload, items: append ? [...current.items, ...payload.items] : payload.items }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusyId(null); }
  }

  async function setRead(item: NotificationItem, read: boolean) {
    setBusyId(item.id); setError("");
    try {
      const response = await fetch(`/api/me/notifications/${encodeURIComponent(item.id)}`, { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ read }) });
      const payload = await response.json() as { error?: string };
      if (response.status === 402) window.dispatchEvent(new Event("subscription:required"));
      if (!response.ok) throw new Error(payload.error || "বিজ্ঞপ্তির অবস্থা হালনাগাদ করা যায়নি।");
      const timestamp = read ? new Date().toISOString() : null;
      setData((current) => ({ ...current, unreadCount: Math.max(0, current.unreadCount + (read ? -1 : 1)), items: current.items.map((row) => row.id === item.id ? { ...row, readAt: timestamp } : row).filter((row) => !unreadOnly || row.readAt === null) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusyId(null); }
  }

  async function markAllRead() {
    setBusyAll(true); setError("");
    try {
      const response = await fetch("/api/me/notifications", { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read-all" }) });
      const payload = await response.json() as { error?: string };
      if (response.status === 402) window.dispatchEvent(new Event("subscription:required"));
      if (!response.ok) throw new Error(payload.error || "সব বিজ্ঞপ্তি পড়া হিসেবে চিহ্নিত করা যায়নি।");
      const timestamp = new Date().toISOString();
      setData((current) => ({ ...current, unreadCount: 0, ...(unreadOnly ? { total: 0, totalPages: 1, page: 1 } : {}), items: unreadOnly ? [] : current.items.map((row) => ({ ...row, readAt: row.readAt ?? timestamp })) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusyAll(false); }
  }

  async function changeFilter(next: boolean) {
    setUnreadOnly(next);
    await loadPage(1, next, false);
  }

  return <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold text-red-brand">পাঠক সেবা</p><h1 className="mt-1 flex items-center gap-2 font-serif text-3xl font-bold text-ink"><Bell size={25}/> বিজ্ঞপ্তি</h1><p className="mt-2 text-sm text-ink-muted">অপঠিত বিজ্ঞপ্তি: {data.unreadCount.toLocaleString("bn-BD")}</p></div><div className="flex gap-2"><button type="button" onClick={() => void changeFilter(false)} aria-pressed={!unreadOnly} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${!unreadOnly ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted"}`}>সব</button><button type="button" onClick={() => void changeFilter(true)} aria-pressed={unreadOnly} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${unreadOnly ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted"}`}>অপঠিত</button></div></header>
    <div className="mt-5 flex justify-end"><button type="button" disabled={busyAll || data.unreadCount === 0} onClick={() => void markAllRead()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-forest hover:border-forest disabled:opacity-50">{busyAll ? <LoaderCircle size={14} className="animate-spin"/> : <Check size={14}/>}সব পড়া হয়েছে চিহ্নিত করুন</button></div>
    <section aria-label="বিজ্ঞপ্তির তালিকা" className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {data.items.map((item) => <article key={item.id} className={`p-4 sm:p-5 ${item.readAt ? "bg-white" : "bg-forest/[0.035]"}`}><div className="flex items-start gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : item.priority === "URGENT" ? "bg-red-brand" : "bg-forest"}`} aria-hidden="true"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-paper-100 px-2 py-1 font-bold text-forest">{typeLabel[item.type]}</span><span className={item.priority === "URGENT" ? "font-bold text-red-brand" : "text-ink-muted"}>{priorityLabel[item.priority]}</span><time className="text-ink-muted" dateTime={new Date(item.createdAt).toISOString()}>{formatBangladeshDateTime(new Date(item.createdAt))}</time></div><h2 className="mt-2 font-serif text-lg font-bold leading-8 text-ink">{item.title}</h2><p className="mt-1 text-sm leading-7 text-ink-muted">{item.message}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">{item.href && <Link href={item.href} className="text-forest hover:underline">খবরটি দেখুন</Link>}<button type="button" disabled={busyId === item.id} onClick={() => void setRead(item, !item.readAt)} className="text-ink-muted underline underline-offset-4 hover:text-forest disabled:opacity-50">{busyId === item.id ? "হালনাগাদ হচ্ছে…" : item.readAt ? "অপঠিত করুন" : "পড়া হয়েছে চিহ্নিত করুন"}</button></div></div></div></article>)}
      {!data.items.length && <div className="p-8 text-center"><Bell className="mx-auto text-ink-muted" size={24}/><p className="mt-3 text-sm font-semibold text-ink">{unreadOnly ? "কোনো অপঠিত বিজ্ঞপ্তি নেই।" : "এখনো কোনো বিজ্ঞপ্তি নেই।"}</p><p className="mt-1 text-xs leading-6 text-ink-muted">আপনার পছন্দের সংবাদ, ব্রেকিং নিউজ এবং ভিডিওর বিজ্ঞপ্তি এখানে দেখা যাবে।</p></div>}
    </section>
    <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-red-brand">{error}</p>
    {data.page < data.totalPages && <div className="mt-5 text-center"><button type="button" disabled={busyId === "page"} onClick={() => void loadPage(data.page + 1, unreadOnly, true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-forest disabled:opacity-60">{busyId === "page" && <LoaderCircle size={14} className="animate-spin"/>}আরও বিজ্ঞপ্তি দেখুন</button></div>}
  </main>;
}
