"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, Search, Upload, X } from "lucide-react";

type MediaItem = { id: string; originalName: string; mimeType: string; width: number | null; height: number | null; altText: string | null; caption: string | null; credit: string | null; url: string };
type ChosenMedia = { mediaId: string; src: string; alt: string; caption: string };
type Props = { open: boolean; onClose: () => void; onInsert?: (media: ChosenMedia) => void; onChoose?: (media: ChosenMedia) => void };

export function MediaPicker({ open, onClose, onInsert, onChoose }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/media", { cache: "no-store" });
      const payload = await response.json() as { media?: MediaItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "মিডিয়া লোড করা যায়নি");
      setItems(payload.media ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "মিডিয়া লোড করা যায়নি"); }
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/admin/media", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as { media?: MediaItem[]; error?: string } }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || "মিডিয়া লোড করা যায়নি");
        setItems(payload.media ?? []);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "মিডিয়া লোড করা যায়নি");
      });
    return () => controller.abort();
  }, [open]);

  function selectItem(item: MediaItem) {
    setSelected(item); setAltText(item.altText ?? ""); setCaption(item.caption ?? ""); setCredit(item.credit ?? "");
  }

  async function upload(file: File) {
    setBusy(true); setMessage("");
    try {
      const metadata = { filename: file.name, contentType: file.type, size: file.size, altText: altText || file.name.replace(/\.[^.]+$/, ""), caption, credit };
      const intentResponse = await fetch("/api/admin/media/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) });
      const intent = await intentResponse.json() as { mediaId?: string; error?: string };
      if (!intentResponse.ok || !intent.mediaId) throw new Error(intent.error || "আপলোড অনুমতি তৈরি হয়নি");
      const uploadResponse = await fetch(`/api/admin/media/upload?mediaId=${encodeURIComponent(intent.mediaId)}`, {
        method: "PUT", headers: { "Content-Type": file.type }, body: file,
      });
      if (!uploadResponse.ok) {
        const uploadResult = await uploadResponse.json().catch(() => ({})) as { error?: string };
        throw new Error(uploadResult.error || "নিরাপদ স্টোরেজে আপলোড ব্যর্থ হয়েছে");
      }
      const finalResponse = await fetch("/api/admin/media/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: intent.mediaId }) });
      const result = await finalResponse.json() as { error?: string };
      if (!finalResponse.ok) throw new Error(result.error || "ছবিটি যাচাই করা যায়নি");
      setAltText(""); setCaption(""); setCredit(""); await load(); setMessage("ছবি যাচাই করে লাইব্রেরিতে যোগ করা হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "ছবি আপলোড করা যায়নি"); }
    finally { setBusy(false); }
  }

  async function saveMetadata() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/media/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ altText, caption, credit }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "ছবির তথ্য সংরক্ষণ করা যায়নি");
      await load(); setMessage("ছবির বাংলা শিরোনাম ও ক্যাপশন সংরক্ষিত হয়েছে");
    } catch (error) { setMessage(error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  const filtered = items.filter((item) => `${item.originalName} ${item.altText ?? ""} ${item.caption ?? ""}`.toLocaleLowerCase("bn-BD").includes(query.toLocaleLowerCase("bn-BD")));
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="media-picker-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <header className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 id="media-picker-title" className="font-serif text-xl font-bold text-ink">মিডিয়া লাইব্রেরি</h2><p className="mt-0.5 text-xs text-ink-muted">নিরাপদভাবে যাচাইকৃত ছবি নির্বাচন বা নতুন ছবি যোগ করুন</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-paper-100" aria-label="বন্ধ করুন"><X size={18} /></button></header>
      <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[1fr_290px]">
        <div className="min-h-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-paper-50 px-3"><Search size={16} className="text-ink-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="ছবি খুঁজুন" /></label>
            <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white hover:bg-forest/90 ${busy ? "pointer-events-none opacity-60" : ""}`}><Upload size={16} />ছবি যোগ করুন<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => <button key={item.id} type="button" onClick={() => selectItem(item)} className={`group overflow-hidden rounded-2xl border text-left transition ${selected?.id === item.id ? "border-forest ring-2 ring-forest/20" : "border-line hover:border-forest/50"}`}>
              <Image src={item.url} alt={item.altText ?? ""} width={320} height={240} unoptimized className="aspect-[4/3] w-full bg-paper-100 object-cover" />
              <span className="block truncate px-2.5 py-2 text-xs font-medium text-ink">{item.caption || item.originalName}</span>
            </button>)}
            {!filtered.length && <div className="col-span-full grid min-h-48 place-items-center rounded-2xl border border-dashed border-line text-center text-sm text-ink-muted"><div><ImagePlus size={26} className="mx-auto mb-2 opacity-50" />{items.length ? "এই নামে কোনো ছবি নেই" : "মিডিয়া লাইব্রেরিতে ছবি নেই"}</div></div>}
          </div>
        </div>
        <aside className="border-t border-line bg-paper-50 p-4 md:border-l md:border-t-0 sm:p-5">
          <h3 className="text-sm font-bold text-ink">ছবির তথ্য</h3>
          {selected ? <>
            <p className="mt-1 truncate text-xs text-ink-muted">{selected.originalName}{selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ""}</p>
            <label className="mt-4 block text-xs font-semibold">বিকল্প লেখা <span className="font-normal text-ink-muted">(SEO ও প্রবেশগম্যতা)</span><input maxLength={250} value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal" /></label>
            <label className="mt-3 block text-xs font-semibold">ছবির ক্যাপশন<textarea maxLength={500} rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
            <label className="mt-3 block text-xs font-semibold">ছবির কৃতিত্ব<input maxLength={160} value={credit} onChange={(event) => setCredit(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal" placeholder="ছবি: প্রতিবেদক / সংস্থা" /></label>
            <button type="button" disabled={busy} onClick={() => void saveMetadata()} className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-paper-100 disabled:opacity-50">তথ্য সংরক্ষণ</button>
            {onChoose && <button type="button" onClick={() => { onChoose({ mediaId: selected.id, src: selected.url, alt: altText, caption }); onClose(); }} className="mt-2 w-full rounded-xl bg-forest px-3 py-2.5 text-sm font-bold text-white hover:bg-forest/90">ফিচার ছবি হিসেবে ব্যবহার</button>}
            {onInsert && <button type="button" onClick={() => { onInsert({ mediaId: selected.id, src: selected.url, alt: altText, caption }); onClose(); }} className="mt-2 w-full rounded-xl border border-forest px-3 py-2.5 text-sm font-bold text-forest hover:bg-forest/5">সংবাদের মূল লেখায় যোগ করুন</button>}
          </> : <p className="mt-3 text-sm leading-6 text-ink-muted">ছবি নির্বাচন করলে বাংলা বিকল্প লেখা, ক্যাপশন ও কৃতিত্ব সম্পাদনা করতে পারবেন।</p>}
          {busy && <p className="mt-3 inline-flex items-center gap-2 text-xs text-ink-muted"><LoaderCircle size={14} className="animate-spin" />নিরাপদে যাচাই হচ্ছে…</p>}
          {message && <p role="status" className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-ink-muted">{message}</p>}
        </aside>
      </div>
    </section>
  </div>;
}
