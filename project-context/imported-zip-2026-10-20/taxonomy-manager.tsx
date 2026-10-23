"use client";

import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";

type Category = { id: string; name: string; slug: string; description: string | null; parentId: string | null; parent: { id: string; name: string } | null; sortOrder: number; isActive: boolean; seoTitle: string | null; seoDescription: string | null; _count: { articles: number; children: number } };
type Tag = { id: string; name: string; slug: string; _count: { articles: number } };
type Props = { categories: Category[]; tags: Tag[] };
const field = "mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-forest";

export function TaxonomyManager({ categories: initialCategories, tags: initialTags }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [tab, setTab] = useState<"categories" | "tags">("categories");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<Category | null>(null);
  const [tagDraft, setTagDraft] = useState<Tag | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", parentId: "", description: "", sortOrder: 0, seoTitle: "", seoDescription: "" });

  function startCategory(category?: Category) {
    setCategoryDraft(category ?? null); setForm({ name: category?.name ?? "", slug: category?.slug ?? "", parentId: category?.parentId ?? "", description: category?.description ?? "", sortOrder: category?.sortOrder ?? 0, seoTitle: category?.seoTitle ?? "", seoDescription: category?.seoDescription ?? "" }); setMessage("");
  }
  function startTag(tag?: Tag) { setTagDraft(tag ?? null); setForm({ name: tag?.name ?? "", slug: tag?.slug ?? "", parentId: "", description: "", sortOrder: 0, seoTitle: "", seoDescription: "" }); setMessage(""); }
  async function saveCategory(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const payload = { name: form.name.normalize("NFC").trim(), slug: form.slug.trim() || undefined, parentId: form.parentId || null, description: form.description.trim() || null, sortOrder: Number(form.sortOrder), isActive: true, seoTitle: form.seoTitle.trim() || null, seoDescription: form.seoDescription.trim() || null };
      const response = await fetch(categoryDraft ? `/api/admin/categories/${categoryDraft.id}` : "/api/admin/categories", { method: categoryDraft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { category?: Category; error?: string };
      if (!response.ok || !result.category) throw new Error(result.error || "বিভাগ সংরক্ষণ করা যায়নি");
      const dataResponse = await fetch("/api/admin/categories", { cache: "no-store" }); const data = await dataResponse.json() as { categories?: Category[] };
      setCategories(data.categories ?? []); setCategoryDraft(null); setMessage("বিভাগ সংরক্ষণ হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }
  async function saveTag(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const payload = { name: form.name.normalize("NFC").trim(), slug: form.slug.trim() || undefined };
      const response = await fetch(tagDraft ? `/api/admin/tags/${tagDraft.id}` : "/api/admin/tags", { method: tagDraft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { tag?: Tag; error?: string };
      if (!response.ok || !result.tag) throw new Error(result.error || "ট্যাগ সংরক্ষণ করা যায়নি");
      const dataResponse = await fetch("/api/admin/tags", { cache: "no-store" }); const data = await dataResponse.json() as { tags?: Tag[] };
      setTags(data.tags ?? []); setTagDraft(null); setMessage("ট্যাগ সংরক্ষণ হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }
  async function remove(endpoint: string, label: string) {
    if (!window.confirm(`“${label}” অপসারণ করবেন? আগে ব্যবহার হয়ে থাকলে সার্ভার এটি মুছতে দেবে না।`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" }); const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "অপসারণ করা যায়নি");
      if (endpoint.startsWith("/api/admin/categories")) { const res = await fetch("/api/admin/categories", { cache: "no-store" }); setCategories(((await res.json()) as { categories?: Category[] }).categories ?? []); }
      else { const res = await fetch("/api/admin/tags", { cache: "no-store" }); setTags(((await res.json()) as { tags?: Tag[] }).tags ?? []); }
      setMessage("তালিকা হালনাগাদ হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "অপসারণ করা যায়নি"); }
    finally { setBusy(false); }
  }

  const parentRows = categories.filter((category) => !category.parentId && category.id !== categoryDraft?.id);
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">সম্পাদনাযোগ্য taxonomies</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">বিভাগ ও ট্যাগ</h1><p className="mt-1 text-sm text-ink-muted">বিভাগের সর্বোচ্চ দুটি স্তর; মুছে না ফেলে ব্যবহৃত taxonomies সংরক্ষণ করা হয়।</p></div>
    <div className="flex items-center justify-between gap-2"><div className="inline-flex rounded-xl bg-paper-100 p-1"><button type="button" onClick={() => { setTab("categories"); setCategoryDraft(null); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "categories" ? "bg-white text-forest shadow-sm" : "text-ink-muted"}`}>বিভাগ <span className="ml-1 text-[10px]">{categories.length}</span></button><button type="button" onClick={() => { setTab("tags"); setTagDraft(null); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "tags" ? "bg-white text-forest shadow-sm" : "text-ink-muted"}`}>ট্যাগ <span className="ml-1 text-[10px]">{tags.length}</span></button></div><button type="button" onClick={() => tab === "categories" ? startCategory() : startTag()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-3 text-xs font-bold text-white"><Plus size={15} />{tab === "categories" ? "নতুন বিভাগ" : "নতুন ট্যাগ"}</button></div>
    {message && <p role="status" className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-muted">{message}</p>}
    {(tab === "categories" ? Boolean(categoryDraft) : Boolean(tagDraft)) && <form onSubmit={(event) => tab === "categories" ? void saveCategory(event) : void saveTag(event)} className="grid gap-3 rounded-2xl border border-forest/15 bg-white p-4 sm:grid-cols-2 sm:p-5">
      <div className="sm:col-span-2"><h2 className="font-serif text-lg font-bold">{tab === "categories" ? categoryDraft ? "বিভাগ সম্পাদনা" : "নতুন বিভাগ" : tagDraft ? "ট্যাগ সম্পাদনা" : "নতুন ট্যাগ"}</h2></div>
      <label className="text-xs font-bold">{tab === "categories" ? "বিভাগের নাম" : "ট্যাগের নাম"}<input required minLength={2} maxLength={80} className={field} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label className="text-xs font-bold">স্লাগ <span className="font-normal text-ink-muted">(ফাঁকা থাকলে transliteration)</span><input dir="ltr" maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={field} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="bangla-category" /></label>
      {tab === "categories" && <><label className="text-xs font-bold">মূল বিভাগ (উপবিভাগের জন্য)<select value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })} className={field}><option value="">মূল বিভাগ</option>{parentRows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-bold">ক্রম<input type="number" min={0} max={10000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} className={field} /></label><label className="text-xs font-bold sm:col-span-2">বিবরণ<textarea maxLength={500} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label><label className="text-xs font-bold">SEO শিরোনাম<input maxLength={120} value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} className={field} /></label><label className="text-xs font-bold">SEO বিবরণ<input maxLength={170} value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} className={field} /></label></>}
      <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busy} className="rounded-xl bg-forest px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "সংরক্ষণ…" : "সংরক্ষণ"}</button><button type="button" onClick={() => { setCategoryDraft(null); setTagDraft(null); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">বাতিল</button></div>
    </form>}
    {tab === "categories" ? <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{categories.map((category) => <div key={category.id} className="flex items-center gap-3 px-4 py-3.5"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper-100 text-forest"><Tags size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{category.parentId ? <span className="mr-1 text-ink-muted">↳</span> : null}{category.name}<span className="ml-2 text-[10px] font-normal text-ink-muted">{category.slug}</span></p><p className="mt-0.5 text-[11px] text-ink-muted">{category.parent?.name ? `${category.parent.name} · ` : "মূল বিভাগ · "}{category._count.articles.toLocaleString("bn-BD")}টি সংবাদ · {category._count.children.toLocaleString("bn-BD")}টি উপবিভাগ</p></div><button type="button" disabled={busy} onClick={() => startCategory(category)} className="rounded-lg p-2 text-ink-muted hover:bg-paper-100 hover:text-forest" aria-label={`${category.name} সম্পাদনা`}><Pencil size={15} /></button><button type="button" disabled={busy} onClick={() => void remove(`/api/admin/categories/${category.id}`, category.name)} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-brand" aria-label={`${category.name} অপসারণ`}><Trash2 size={15} /></button></div>)}{!categories.length && <p className="p-8 text-center text-sm text-ink-muted">এখনও কোনো বিভাগ তৈরি হয়নি</p>}</div> : <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{tags.map((tag) => <div key={tag.id} className="flex items-center gap-3 px-4 py-3.5"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper-100 text-forest"><Tags size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{tag.name}<span className="ml-2 text-[10px] font-normal text-ink-muted">{tag.slug}</span></p><p className="mt-0.5 text-[11px] text-ink-muted">{tag._count.articles.toLocaleString("bn-BD")}টি সংবাদে ব্যবহৃত</p></div><button type="button" disabled={busy} onClick={() => startTag(tag)} className="rounded-lg p-2 text-ink-muted hover:bg-paper-100 hover:text-forest" aria-label={`${tag.name} সম্পাদনা`}><Pencil size={15} /></button><button type="button" disabled={busy} onClick={() => void remove(`/api/admin/tags/${tag.id}`, tag.name)} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-brand" aria-label={`${tag.name} অপসারণ`}><Trash2 size={15} /></button></div>)}{!tags.length && <p className="p-8 text-center text-sm text-ink-muted">এখনও কোনো ট্যাগ তৈরি হয়নি</p>}</div>}
  </div>;
}
