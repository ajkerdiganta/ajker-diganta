"use client";

import { useState } from "react";

type Entry = { id: string; name: string | null; email: string; phone: string | null; subject: string | null; message: string; type?: "ADVERTISEMENT" | "NEWSLETTER"; status: "RECEIVED" | "RESOLVED"; createdAt: Date | string; resolvedAt: Date | string | null };

export function SubmissionInbox({ initialContacts, initialFooter }: { initialContacts: Entry[]; initialFooter: Entry[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [footer, setFooter] = useState(initialFooter);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  async function reload() {
    try {
      const response = await fetch("/api/admin/submissions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "তথ্য আনা যায়নি");
      setContacts(data.contacts); setFooter(data.footer); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "তথ্য আনা যায়নি"); }
  }
  async function changeStatus(entry: Entry, kind: "contact" | "footer") {
    setBusyId(entry.id); setError("");
    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(entry.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, action: entry.status === "RECEIVED" ? "resolve" : "reopen" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "অবস্থা বদলানো যায়নি");
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "অবস্থা বদলানো যায়নি"); }
    finally { setBusyId(""); }
  }
  function renderEntry(entry: Entry, kind: "contact" | "footer") {
    return <article key={`${kind}-${entry.id}`} className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-ink">{entry.name || "নাম দেওয়া হয়নি"} · {kind === "contact" ? "যোগাযোগ" : entry.type === "ADVERTISEMENT" ? "বিজ্ঞাপন" : "নিউজলেটার"}</p><p className="mt-1 text-xs text-ink-muted">{new Date(entry.createdAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })} · {entry.status === "RECEIVED" ? "নতুন" : "নিষ্পত্তি হয়েছে"}</p></div><button type="button" disabled={busyId === entry.id} onClick={() => void changeStatus(entry, kind)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-forest disabled:opacity-60">{busyId === entry.id ? "হচ্ছে…" : entry.status === "RECEIVED" ? "নিষ্পত্তি চিহ্নিত" : "আবার খুলুন"}</button></div>
      {entry.subject && <h3 className="mt-3 font-semibold">{entry.subject}</h3>}<p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-muted">{entry.message}</p><div className="mt-3 flex flex-wrap gap-4 text-xs"><a className="text-forest underline" href={`mailto:${encodeURIComponent(entry.email)}`}>{entry.email}</a>{entry.phone && <a className="text-forest underline" href={`tel:${entry.phone.replace(/[^+\d]/g, "")}`}>{entry.phone}</a>}</div>
    </article>;
  }
  return <div className="space-y-8"><header><p className="text-xs font-bold text-red-brand">সংবেদনশীল পাঠক তথ্য · শুধু অনুমতিপ্রাপ্ত কর্মী</p><h1 className="mt-1 font-serif text-3xl font-bold">পাঠকের অনুরোধ</h1><p className="mt-2 text-sm text-ink-muted">যোগাযোগ, বিজ্ঞাপন ও নিউজলেটারের সর্বশেষ ১০০টি অনুরোধ দেখা যায়। প্রতিটি অবস্থা পরিবর্তন audit log-এ নথিবদ্ধ হয়।</p></header>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<section><h2 className="mb-3 font-serif text-xl font-bold">যোগাযোগ ({contacts.length})</h2><div className="space-y-3">{contacts.length ? contacts.map((entry) => renderEntry(entry, "contact")) : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-muted">কোনো যোগাযোগ অনুরোধ নেই।</p>}</div></section><section><h2 className="mb-3 font-serif text-xl font-bold">বিজ্ঞাপন ও নিউজলেটার ({footer.length})</h2><div className="space-y-3">{footer.length ? footer.map((entry) => renderEntry(entry, "footer")) : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-muted">কোনো বিজ্ঞাপন/নিউজলেটার অনুরোধ নেই।</p>}</div></section></div>;
}
