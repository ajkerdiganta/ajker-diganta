"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";

type Author = { id: string; name: string; slug: string; title: string | null; bio: string | null; email: string | null; isActive: boolean; _count: { articles: number } };
const input = "mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-forest";
export function AuthorManager({ authors: initial }: { authors: Author[] }) {
  const [authors, setAuthors] = useState(initial);
  const [draft, setDraft] = useState<Author | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", title: "", bio: "", email: "", isActive: true });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function start(author?: Author) { setDraft(author ?? null); setForm({ name: author?.name ?? "", slug: author?.slug ?? "", title: author?.title ?? "", bio: author?.bio ?? "", email: author?.email ?? "", isActive: author?.isActive ?? true }); setOpen(true); setMessage(""); }
  async function reload() { const response = await fetch("/api/admin/authors", { cache: "no-store" }); const data = await response.json() as { authors?: Author[] }; setAuthors(data.authors ?? []); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(draft ? `/api/admin/authors/${draft.id}` : "/api/admin/authors", { method: draft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, name: form.name.normalize("NFC").trim(), slug: form.slug.trim() || undefined, title: form.title.trim() || null, bio: form.bio.trim() || null, email: form.email.trim() || null }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "লেখক সংরক্ষণ করা যায়নি");
      await reload(); setOpen(false); setMessage("লেখক-প্রোফাইল সংরক্ষিত হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }
  async function remove(author: Author) {
    if (!window.confirm(`“${author.name}” লেখক-প্রোফাইল অপসারণ করবেন? ব্যবহৃত হলে সার্ভার অপসারণ আটকাবে।`)) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/admin/authors/${author.id}`, { method: "DELETE" }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "অপসারণ করা যায়নি"); await reload(); setMessage("লেখক তালিকা হালনাগাদ হয়েছে"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "অপসারণ করা যায়নি"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">বাইলাইন ও প্রোফাইল</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">লেখক ও প্রতিবেদক</h1><p className="mt-1 text-sm text-ink-muted">প্রকাশিত byline account role থেকে আলাদা—পরিচয় ও সম্পাদকীয় ক্ষমতা কখনো মেশে না।</p></div><button type="button" onClick={() => start()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white"><Plus size={16} />নতুন লেখক</button></div>
    {message && <p role="status" className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-muted">{message}</p>}
    {open && <form onSubmit={(event) => void save(event)} className="grid gap-3 rounded-2xl border border-forest/15 bg-white p-4 sm:grid-cols-2 sm:p-5"><h2 className="font-serif text-lg font-bold sm:col-span-2">{draft ? "প্রোফাইল সম্পাদনা" : "নতুন লেখক / প্রতিবেদক"}</h2><label className="text-xs font-bold">পূর্ণ নাম <input required minLength={2} maxLength={100} className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="text-xs font-bold">পেশাগত পরিচয় <input maxLength={120} className={input} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="জ্যেষ্ঠ প্রতিবেদক" /></label><label className="text-xs font-bold">বাইলাইন স্লাগ <span className="font-normal text-ink-muted">(ফাঁকা রাখলে transliteration)</span><input dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={180} className={input} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label className="text-xs font-bold">ইমেইল <span className="font-normal text-ink-muted">(ঐচ্ছিক)</span><input type="email" maxLength={254} className={input} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="text-xs font-bold sm:col-span-2">সংক্ষিপ্ত পরিচিতি<textarea rows={4} maxLength={1600} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label><div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-forest px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">সংরক্ষণ</button><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">বাতিল</button></div></form>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{authors.map((author) => <div key={author.id} className="flex items-start gap-3 px-4 py-4"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-100 text-forest"><UserRound size={18} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-base font-bold">{author.name}</h2>{author.title && <span className="rounded-full bg-paper-100 px-2 py-1 text-[10px] text-ink-muted">{author.title}</span>}</div><p className="mt-1 text-xs text-ink-muted">{author.slug} · {author._count.articles.toLocaleString("bn-BD")}টি সংবাদ{author.email ? ` · ${author.email}` : ""}</p>{author.bio && <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{author.bio}</p>}</div><button type="button" disabled={busy} onClick={() => start(author)} aria-label="লেখক সম্পাদনা" className="rounded-lg p-2 text-ink-muted hover:bg-paper-100"><Pencil size={15} /></button><button type="button" disabled={busy} onClick={() => void remove(author)} aria-label="লেখক অপসারণ" className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-brand"><Trash2 size={15} /></button></div>)}{!authors.length && <p className="p-8 text-center text-sm text-ink-muted">এখনও কোনো লেখক প্রোফাইল নেই</p>}</div>
  </div>;
}
