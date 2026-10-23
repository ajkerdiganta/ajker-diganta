"use client";

import { useMemo, useState } from "react";
import { Menu as MenuIcon, Pencil, Plus, Trash2 } from "lucide-react";

type Category = { id: string; name: string; parentId: string | null; slug: string };
type Item = {
  id: string;
  menuId: string;
  parentId: string | null;
  categoryId: string | null;
  label: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
  category?: { id: string; name: string; slug: string } | null;
};
type Menu = { id: string; name: string; slug: string; location: "HEADER_MAIN" | "HAMBURGER"; items: Item[] };
type Props = { menus: Menu[]; categories: Category[] };
type Draft = { label: string; href: string; parentId: string; categoryId: string; sortOrder: number };

const field = "mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-forest";
const blank: Draft = { label: "", href: "/", parentId: "", categoryId: "", sortOrder: 0 };

export function NavigationManager({ menus: initialMenus, categories }: Props) {
  const [menus, setMenus] = useState(initialMenus);
  const [selectedId, setSelectedId] = useState(initialMenus[0]?.id ?? "");
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Draft>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const menu = menus.find((item) => item.id === selectedId) ?? menus[0];
  const parentItems = useMemo(() => {
    const menuItems = menu?.items ?? [];
    return menuItems.filter((item) => !item.parentId && item.id !== editing?.id && !menuItems.some((child) => child.parentId === item.id));
  }, [menu, editing]);

  function start(item?: Item) {
    setEditing(item ?? null);
    setForm(item ? { label: item.label, href: item.href, parentId: item.parentId ?? "", categoryId: item.categoryId ?? "", sortOrder: item.sortOrder } : blank);
    setFormOpen(true);
    setMessage("");
  }

  async function refresh() {
    const response = await fetch("/api/admin/navigation", { cache: "no-store" });
    const data = await response.json() as { menus?: Menu[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "মেনু তালিকা হালনাগাদ করা যায়নি");
    setMenus(data.menus ?? []);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menu) return;
    setBusy(true);
    setMessage("");
    const payload = {
      menuId: menu.id,
      label: form.label.normalize("NFC").trim(),
      href: form.href.trim(),
      parentId: form.parentId || null,
      categoryId: form.categoryId || null,
      sortOrder: Number(form.sortOrder),
      isActive: true,
    };
    try {
      const response = await fetch(editing ? `/api/admin/navigation/${editing.id}` : "/api/admin/navigation", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "মেনু সংরক্ষণ করা যায়নি");
      await refresh();
      setEditing(null);
      setFormOpen(false);
      setForm(blank);
      setMessage("মেনু সংরক্ষণ হয়েছে");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "মেনু সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm(`“${item.label}” মেনু আইটেমটি সরাবেন? এর সক্রিয় উপ-আইটেমও সরানো হবে।`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/navigation/${item.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "মেনু অপসারণ করা যায়নি");
      await refresh();
      setMessage("মেনু আইটেম সরানো হয়েছে");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "মেনু অপসারণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold tracking-wide text-red-brand">শুধু অনুমতিপ্রাপ্ত নিউজরুম</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-ink">নেভিগেশন ব্যবস্থাপনা</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">হেডারের মূল নেভিগেশন ও hamburger মেনুর লিংক এবং সর্বোচ্চ দুই স্তরের উপবিভাগ সাজান। পরিবর্তন public header-এ দেখাবে; মেনু থেকে আইটেম সরালে সেটি public site থেকেও সরে যাবে। বিভাগ/উপবিভাগ তৈরির পর এখানে যুক্ত করুন।</p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="নেভিগেশন মেনু নির্বাচন">
          {menus.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={selectedId === item.id} onClick={() => { setSelectedId(item.id); setFormOpen(false); setEditing(null); }} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${selectedId === item.id ? "bg-forest text-white" : "border border-line bg-white text-ink-muted hover:text-forest"}`}>
              {item.name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => start()} disabled={!menu || busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />নতুন আইটেম</button>
      </section>

      {message && <p role="status" className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-muted">{message}</p>}

      {formOpen && menu && (
        <form onSubmit={save} className="grid gap-4 rounded-2xl border border-forest/15 bg-white p-4 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2"><h2 className="font-serif text-xl font-bold text-ink">{editing ? "আইটেম সম্পাদনা" : "নতুন মেনু আইটেম"}</h2><p className="mt-1 text-xs text-ink-muted">URL server-এ আবার validate হবে; শুধু same-menu দুই স্তরের hierarchy অনুমোদিত।</p></div>
          <label className="text-xs font-bold text-ink">নাম<input required minLength={2} maxLength={100} className={field} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></label>
          <label className="text-xs font-bold text-ink">লিংক<input required dir="ltr" maxLength={2048} className={field} value={form.href} onChange={(event) => setForm({ ...form, href: event.target.value })} placeholder="/category/bangladesh অথবা https://..." /></label>
          <label className="text-xs font-bold text-ink">উপরের আইটেম (ঐচ্ছিক)<select className={field} value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })}><option value="">মূল আইটেম</option>{parentItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="text-xs font-bold text-ink">বিভাগের সঙ্গে যুক্ত (ঐচ্ছিক)<select className={field} value={form.categoryId} onChange={(event) => { const selected = categories.find((category) => category.id === event.target.value); setForm({ ...form, categoryId: selected?.id ?? "", href: selected ? `/category/${selected.slug}` : form.href }); }}><option value="">কোনো বিভাগ নয়</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentId ? "↳ " : ""}{item.name}</option>)}</select></label>
          <label className="text-xs font-bold text-ink">ক্রম<input type="number" min={0} max={10_000} className={field} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
          <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="min-h-10 rounded-xl bg-forest px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}</button><button type="button" onClick={() => { setEditing(null); setFormOpen(false); setForm(blank); }} className="min-h-10 rounded-xl border border-line px-5 text-sm font-semibold text-ink-muted">বাতিল</button></div>
        </form>
      )}

      <section className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" aria-label="সক্রিয় menu items">
        {(menu?.items ?? []).map((item) => (
          <div key={item.id} className={`flex items-center gap-3 px-4 py-3.5 ${item.parentId ? "bg-paper-50 pl-10" : ""}`}>
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper-100 text-forest"><MenuIcon size={16} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{item.parentId ? "↳ " : ""}{item.label}</p><p className="mt-0.5 truncate text-xs text-ink-muted">{item.href}{item.category?.name ? ` · ${item.category.name}` : ""}</p></div>
            <button type="button" disabled={busy} onClick={() => start(item)} className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-paper-100 hover:text-forest" aria-label={`${item.label} সম্পাদনা`}><Pencil size={15} /></button>
            <button type="button" disabled={busy} onClick={() => void remove(item)} className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-brand" aria-label={`${item.label} অপসারণ`}><Trash2 size={15} /></button>
          </div>
        ))}
        {!menu?.items.length && <p className="p-8 text-center text-sm leading-7 text-ink-muted">এই menu-তে কোনো সক্রিয় item নেই। বিভাগ যুক্ত করতে নতুন আইটেম তৈরি করে একটি বিভাগ বাছুন; খালি menu public site-এ খালিই থাকবে।</p>}
      </section>
    </div>
  );
}
