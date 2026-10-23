"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Menu as MenuIcon } from "lucide-react";

type Category = { id: string; name: string; parentId: string | null; slug: string };
type Item = { id: string; menuId: string; parentId: string | null; categoryId: string | null; label: string; href: string; sortOrder: number; isActive: boolean; category?: { id: string; name: string; slug: string } | null };
type Menu = { id: string; name: string; slug: string; location: "HEADER_MAIN" | "HAMBURGER"; items: Item[] };
type Props = { menus: Menu[]; categories: Category[] };
const field = "mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-forest";

export function NavigationManager({ menus: initialMenus, categories }: Props) {
  const [menus, setMenus] = useState(initialMenus); const [selected, setSelected] = useState(initialMenus[0]?.id ?? "");
  const [draft, setDraft] = useState<Item | null>(null); const [formOpen, setFormOpen] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const menu = menus.find((item) => item.id === selected) ?? menus[0];
  const [form, setForm] = useState({ label: "", href: "/", parentId: "", categoryId: "", sortOrder: 0 });
  const parents = useMemo(() => (menu?.items ?? []).filter((item) => !item.parentId && item.id !== draft?.id), [menu, draft]);
  function start(item?: Item) { setDraft(item ?? null); setFormOpen(true); setForm({ label: item?.label ?? "", href: item?.href ?? "/", parentId: item?.parentId ?? "", categoryId: item?.categoryId ?? "", sortOrder: item?.sortOrder ?? 0 }); setMessage(""); }
  async function refresh() { const response = await fetch("/api/admin/navigation", { cache: "no-store" }); const data = await response.json() as { menus?: Menu[] }; setMenus(data.menus ?? []); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return; setBusy(true); setMessage("");
    try {
      const payload = { menuId: menu.id, label: form.label.normalize("NFC").trim(), href: form.href.trim(), parentId: form.parentId || null, categoryId: form.categoryId || null, sortOrder: Number(form.sortOrder), isActive: true };
      const response = await fetch(draft ? `/api/admin/navigation/${draft.id}` : "/api/admin/navigation", { method: draft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "মেনু সংরক্ষণ করা যায়নি");
      await refresh(); setDraft(null); setFormOpen(false); setMessage("মেনু সংরক্ষণ হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "মেনু সংরক্ষণ করা যায়নি"); } finally { setBusy(false); }
  }
  async function remove(item: Item) {
    if (!window.confirm(`“${item.label}” মেনু অপসারণ করবেন?`)) return; setBusy(true); setMessage("");
    try { const response = await fetch(`/api/admin/navigation/${item.id}`, { method: "DELETE" }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "অপসারণ করা যায়নি"); await refresh(); setMessage("মেনু অপসারণ হয়েছে"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "অপসারণ করা যায়নি"); } finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">শুধু অ্যাডমিন</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">মেনু ব্যবস্থাপনা</h1><p className="mt-1 text-sm text-ink-muted">হেডারের মূল মেনু ও হ্যামবার্গার মেনুর বিভাগ, সাব-ক্যাটাগরি, লিংক এবং ক্রম এখান থেকে নিয়ন্ত্রণ করুন।</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{menus.map((item) => <button key={item.id} type="button" onClick={() => { setSelected(item.id); setDraft(null); setFormOpen(false); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${selected === item.id ? "bg-forest text-white" : "border border-line bg-white text-ink-muted"}`}>{item.name}</button>)}</div><button type="button" onClick={() => start()} disabled={!menu} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-3 text-xs font-bold text-white"><Plus size={15} />নতুন মেনু আইটেম</button></div>
    {message && <p role="status" className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-muted">{message}</p>}
    {formOpen ? <form onSubmit={save} className="grid gap-3 rounded-2xl border border-forest/15 bg-white p-4 sm:grid-cols-2 sm:p-5"><div className="sm:col-span-2"><h2 className="font-serif text-lg font-bold">{draft ? "মেনু আইটেম সম্পাদনা" : "নতুন মেনু আইটেম"}</h2></div><label className="text-xs font-bold">নাম<input required minLength={2} maxLength={100} className={field} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label><label className="text-xs font-bold">লিংক<input required dir="ltr" maxLength={2048} className={field} value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/category/bangladesh" /></label><label className="text-xs font-bold">মূল মেনু / সাব-ক্যাটাগরি<select className={field} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}><option value="">মূল মেনু আইটেম</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs font-bold">সংযুক্ত বিভাগ (ঐচ্ছিক)<select className={field} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">কোনো বিভাগ নয়</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentId ? "↳ " : ""}{item.name}</option>)}</select></label><label className="text-xs font-bold">ক্রম<input type="number" min={0} max={10000} className={field} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label><div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-forest px-4 py-2.5 text-sm font-bold text-white">{busy ? "সংরক্ষণ…" : "সংরক্ষণ"}</button><button type="button" onClick={() => { setDraft(null); setFormOpen(false); setForm({ label: "", href: "/", parentId: "", categoryId: "", sortOrder: 0 }); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">বাতিল</button></div></form> : null}
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{(menu?.items ?? []).map((item) => <div key={item.id} className={`flex items-center gap-3 px-4 py-3.5 ${item.parentId ? "bg-paper-50 pl-10" : ""}`}><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper-100 text-forest"><MenuIcon size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.parentId ? "↳ " : ""}{item.label}</p><p className="mt-0.5 truncate text-[11px] text-ink-muted">{item.href}{item.category?.name ? ` · ${item.category.name}` : ""}</p></div><button type="button" disabled={busy} onClick={() => start(item)} className="rounded-lg p-2 text-ink-muted hover:bg-paper-100 hover:text-forest" aria-label={`${item.label} সম্পাদনা`}><Pencil size={15} /></button><button type="button" disabled={busy} onClick={() => void remove(item)} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-brand" aria-label={`${item.label} অপসারণ`}><Trash2 size={15} /></button></div>)}{!menu?.items.length && <p className="p-8 text-center text-sm text-ink-muted">এই মেনুতে এখনো কোনো আইটেম নেই</p>}</div>
  </div>;
}
