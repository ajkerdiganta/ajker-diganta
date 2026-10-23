"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { AlertCircle, ArrowLeft, Check, ImagePlus, LoaderCircle, Save, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { RichTextEditor } from "@/components/cms/rich-text-editor";
import { MediaPicker } from "@/components/cms/media-picker";

type Category = { id: string; name: string; parentId: string | null };
type Named = { id: string; name: string };
type Related = { id: string; title: string; status: string };
type Media = { id: string; altText: string | null; caption: string | null };
type ArticleData = {
  id: string; slug: string; title: string; subtitle: string | null; excerpt: string | null; body: JSONContent; bodyHtml: string;
  status: string; revisionNumber: number; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null;
  categories: Array<{ category: Category; isPrimary: boolean }>;
  authors: Array<{ author: Named; isPrimary: boolean }>;
  tags: Array<{ tag: Named }>;
  media: Array<{ media: Media; role: string }>;
  relatedArticles: Array<{ relatedArticle: Related }>;
  relatedVideos: Array<{ title: string; canonicalUrl: string }>;
  isBreaking: boolean; isFeatured: boolean; isTrending: boolean;
  workflowEvents: Array<{ id: string; fromStatus: string | null; toStatus: string; action: string; reason: string | null; createdAt: string; actor: { name: string } }>;
};
type Props = {
  article?: ArticleData;
  categories: Category[];
  authors: Named[];
  tags: Named[];
  relatedOptions: Related[];
  roles: string[];
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
const STATUS_LABEL: Record<string, string> = { DRAFT: "খসড়া", SUBMITTED: "জমা হয়েছে", UNDER_REVIEW: "পর্যালোচনাধীন", APPROVED: "অনুমোদিত", REJECTED: "সংশোধনের জন্য ফেরত", SCHEDULED: "নির্ধারিত", PUBLISHED: "প্রকাশিত", ARCHIVED: "সংরক্ষণাগার" };
const pill: Record<string, string> = { DRAFT: "bg-paper-100 text-ink-muted", SUBMITTED: "bg-blue-50 text-blue-800", UNDER_REVIEW: "bg-amber-50 text-amber-800", APPROVED: "bg-emerald-50 text-emerald-800", REJECTED: "bg-red-50 text-red-brand", SCHEDULED: "bg-indigo-50 text-indigo-800", PUBLISHED: "bg-green-50 text-green-800", ARCHIVED: "bg-slate-100 text-slate-700" };

function MultiSelect({ label, rows, values, onChange, hint }: { label: string; rows: Named[]; values: string[]; onChange: (value: string[]) => void; hint?: string }) {
  return <fieldset className="min-w-0"><legend className="text-xs font-bold text-ink">{label}</legend>{hint && <p className="mb-2 mt-0.5 text-[11px] text-ink-muted">{hint}</p>}
    <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-line bg-white p-2">
      {rows.map((row) => <label key={row.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper-50"><input type="checkbox" checked={values.includes(row.id)} onChange={(event) => onChange(event.target.checked ? [...values, row.id] : values.filter((value) => value !== row.id))} className="accent-forest" />{row.name}</label>)}
      {!rows.length && <p className="px-2 py-2 text-xs text-ink-muted">তালিকা খালি।</p>}
    </div>
  </fieldset>;
}

export function ArticleEditorForm({ article, categories, authors, tags, relatedOptions, roles }: Props) {
  const router = useRouter();
  const canEditAny = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN") || roles.includes("EDITOR");
  const isReporter = roles.includes("REPORTER");
  const [title, setTitle] = useState(article?.title ?? "");
  const [subtitle, setSubtitle] = useState(article?.subtitle ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [body, setBody] = useState<JSONContent>((article?.body as JSONContent | undefined) ?? EMPTY_DOC);
  const [categoryIds, setCategoryIds] = useState(article?.categories.map(({ category }) => category.id) ?? []);
  const [primaryCategoryId, setPrimaryCategoryId] = useState(article?.categories.find((entry) => entry.isPrimary)?.category.id ?? "");
  const [authorIds, setAuthorIds] = useState(article?.authors.map(({ author }) => author.id) ?? []);
  const [primaryAuthorId, setPrimaryAuthorId] = useState(article?.authors.find((entry) => entry.isPrimary)?.author.id ?? "");
  const [tagIds, setTagIds] = useState(article?.tags.map(({ tag }) => tag.id) ?? []);
  const [featuredImageId, setFeaturedImageId] = useState(article?.media.find((entry) => entry.role === "FEATURED_IMAGE")?.media.id ?? "");
  const [relatedArticleIds, setRelatedArticleIds] = useState(article?.relatedArticles.map(({ relatedArticle }) => relatedArticle.id) ?? []);
  const [videoUrl, setVideoUrl] = useState(article?.relatedVideos[0]?.canonicalUrl ?? "");
  const [videoTitle, setVideoTitle] = useState(article?.relatedVideos[0]?.title ?? "");
  const [seoTitle, setSeoTitle] = useState(article?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(article?.seoDescription ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(article?.canonicalUrl ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [articleId, setArticleId] = useState(article?.id ?? "");
  const [revisionNumber, setRevisionNumber] = useState(article?.revisionNumber ?? 1);
  const imageInserter = useRef<((image: { mediaId: string; src: string; alt: string; caption: string }) => void) | null>(null);
  const status = article?.status ?? "DRAFT";
  const primaryImage = article?.media.find((entry) => entry.role === "FEATURED_IMAGE")?.media;
  const visibleRelated = useMemo(() => relatedOptions.filter((item) => item.id !== article?.id), [relatedOptions, article?.id]);

  async function save() {
    setBusy(true); setError(""); setSuccess("");
    const payload = {
      title, subtitle: subtitle.trim() || null, excerpt: excerpt.trim() || null, slug: slug.trim() || undefined, body,
      categoryIds, primaryCategoryId: primaryCategoryId || undefined, authorIds, primaryAuthorId: primaryAuthorId || undefined,
      tagIds, featuredImageId: featuredImageId || null, relatedArticleIds,
      relatedVideos: videoUrl.trim() ? [{ title: videoTitle.trim() || "সম্পর্কিত ভিডিও", url: videoUrl.trim() }] : [],
      seoTitle: seoTitle.trim() || null, seoDescription: seoDescription.trim() || null, canonicalUrl: canonicalUrl.trim() || null,
      changeNote: changeNote.trim() || null, ...(articleId ? { expectedRevisionNumber: revisionNumber } : {}),
    };
    try {
      const response = await fetch(articleId ? `/api/admin/articles/${articleId}` : "/api/admin/articles", {
        method: articleId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { article?: { id: string; slug: string; status: string; revisionNumber: number }; error?: string; details?: Array<{ field: string; message: string }> };
      if (!response.ok || !result.article) throw new Error(result.details?.map((item) => `${item.field}: ${item.message}`).join(" · ") || result.error || "সংবাদ সংরক্ষণ করা যায়নি");
      setArticleId(result.article.id); setRevisionNumber(result.article.revisionNumber); setSuccess("খসড়া নিরাপদে সংরক্ষণ করা হয়েছে"); setChangeNote("");
      if (!articleId) router.replace(`/admin/articles/${result.article.id}`);
      router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "সংবাদ সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }

  async function transition(action: string, extra: Record<string, unknown> = {}) {
    if (!articleId) { await save(); setError("প্রথমে সংবাদ সংরক্ষণ করুন, তারপর জমা বা প্রকাশ করুন।"); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/articles/${articleId}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const result = await response.json() as { article?: { status: string }; error?: string };
      if (!response.ok) throw new Error(result.error || "ওয়ার্কফ্লো সম্পন্ন করা যায়নি");
      setSuccess(`নতুন অবস্থা: ${STATUS_LABEL[result.article?.status ?? ""] ?? "সম্পন্ন"}`); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "অনুরোধ সম্পন্ন হয়নি"); }
    finally { setBusy(false); }
  }

  async function flagAction(action: "breaking" | "featured" | "trending", enabled: boolean) {
    if (!articleId) return;
    await transition(action, { enabled });
  }

  async function deleteDraft() {
    if (!articleId || status !== "DRAFT" || !window.confirm("এই খসড়া সংবাদটি মুছে ফেলতে চান? এটি public site থেকে সরানো হবে।")) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/articles/${articleId}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "খসড়া অপসারণ করা যায়নি");
      router.push("/admin/articles"); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "খসড়া অপসারণ করা যায়নি"); setBusy(false); }
  }

  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10";
  const transitionButtons: Array<{ action: string; label: string; show: boolean; tone?: string }> = [
    { action: "submit", label: isReporter ? "সম্পাদনার জন্য জমা দিন" : "অনুমোদনের জন্য পাঠান", show: (isReporter || canEditAny) && status === "DRAFT" },
    { action: "resubmit", label: "সংশোধন করে পুনরায় জমা দিন", show: isReporter && status === "DRAFT" && Boolean(article?.workflowEvents.some((event) => event.toStatus === "REJECTED")) },
    { action: "review", label: "পর্যালোচনা শুরু", show: canEditAny && status === "SUBMITTED" },
    { action: "approve", label: "অনুমোদন করুন", show: canEditAny && status === "UNDER_REVIEW" },
    { action: "reject", label: "সংশোধনের জন্য ফেরত", show: canEditAny && status === "UNDER_REVIEW", tone: "outline" },
    { action: "schedule", label: "সময় নির্ধারণ", show: canEditAny && status === "APPROVED" },
    { action: "publish", label: "এখনই প্রকাশ করুন", show: canEditAny && status === "APPROVED" },
    { action: "cancel-schedule", label: "সময়সূচি বাতিল", show: canEditAny && status === "SCHEDULED", tone: "outline" },
    { action: "archive", label: "সংরক্ষণাগারে নিন", show: canEditAny && status === "PUBLISHED", tone: "outline" },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Link href="/admin/articles" className="grid size-10 place-items-center rounded-xl border border-line bg-white hover:bg-paper-100" aria-label="সংবাদ তালিকায় ফিরে যান"><ArrowLeft size={17} /></Link><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-brand">সম্পাদকীয় ডেস্ক</p><h1 className="mt-1 font-serif text-2xl font-bold text-ink sm:text-3xl">{article ? "সংবাদ সম্পাদনা" : "নতুন সংবাদ"}</h1></div></div>
      {article && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${pill[status] ?? pill.DRAFT}`}>{STATUS_LABEL[status] ?? status} · সংস্করণ {revisionNumber}</span>}
    </div>

    {article && <section className="rounded-2xl border border-line bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-ink-muted">সম্পাদকীয় ওয়ার্কফ্লো</p><p className="mt-1 text-sm font-semibold text-ink">{STATUS_LABEL[status] ?? status}<span className="mx-2 text-ink-muted">→</span>{status === "DRAFT" ? "জমা" : status === "SUBMITTED" ? "পর্যালোচনা" : status === "UNDER_REVIEW" ? "অনুমোদন / ফেরত" : status === "APPROVED" ? "সময় নির্ধারণ / প্রকাশ" : "পরবর্তী ধাপ"}</p></div>
        <div className="flex flex-wrap items-end gap-2">
          {transitionButtons.filter((item) => item.show).map((item) => <div key={item.action} className="flex items-end gap-2">
            {item.action === "schedule" && <label className="text-[11px] font-semibold text-ink-muted"><span className="sr-only">প্রকাশের সময়</span><input type="datetime-local" value={scheduleLocal} onChange={(event) => setScheduleLocal(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-2 text-xs" />{!scheduleLocal && <span className="ml-1">সময় দিন</span>}</label>}
            {item.action === "reject" && <label className="text-[11px] font-semibold text-ink-muted"><span className="sr-only">ফেরতের কারণ</span><input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="ফেরতের কারণ" className="h-10 w-36 rounded-xl border border-line px-2 text-xs" /></label>}
            <button type="button" disabled={busy || (item.action === "schedule" && !scheduleLocal) || (item.action === "reject" && rejectReason.trim().length < 8)} onClick={() => {
              if (item.action === "schedule") void transition(item.action, { scheduledAt: new Date(scheduleLocal).toISOString() });
              else if (item.action === "reject") void transition(item.action, { reason: rejectReason });
              else void transition(item.action);
            }} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition disabled:opacity-50 ${item.tone === "outline" ? "border border-line bg-white text-ink hover:bg-paper-50" : "bg-forest text-white hover:bg-forest/90"}`}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : item.action.includes("submit") ? <Send size={14} /> : <Check size={14} />}{item.label}</button>
          </div>)}
          {article && canEditAny && status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void deleteDraft()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-brand transition hover:bg-red-100 disabled:opacity-50"><Trash2 size={15} />খসড়া মুছুন</button>}
        </div>
      </div>
      {canEditAny && status === "PUBLISHED" && <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {(["breaking", "featured", "trending"] as const).map((flag) => {
          const active = flag === "breaking" ? article.isBreaking : flag === "featured" ? article.isFeatured : article.isTrending;
          return <button key={`flag-${flag}`} disabled={busy} type="button" onClick={() => void flagAction(flag, !active)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${active ? "border-forest bg-forest text-white" : "border-line bg-white hover:bg-paper-50"}`}>{flag === "breaking" ? active ? "ব্রেকিং বন্ধ করুন" : "ব্রেকিং নিউজ চিহ্নিত" : flag === "featured" ? active ? "ফিচার সরান" : "ফিচার করুন" : active ? "ট্রেন্ডিং সরান" : "ট্রেন্ডিং চিহ্নিত"}</button>;
        })}
      </div>}
    </section>}

    {(error || success) && <div role={error ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{error ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : <Check size={17} className="mt-0.5 shrink-0" />}{error || success}</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-serif text-lg font-bold text-ink">সংবাদের মূল বিষয়</h2><p className="mt-1 text-xs text-ink-muted">বাংলা ও ইংরেজি মিশিয়ে লিখুন—সব লেখা ইউনিকোডে সংরক্ষিত হয়</p></div><span className="rounded-full bg-paper-100 px-2.5 py-1 text-[10px] font-bold text-ink-muted">{revisionNumber} সংস্করণ</span></div>
          <label className="block text-sm font-bold text-ink">শিরোনাম <span className="text-red-brand">*</span><input value={title} onChange={(event) => setTitle(event.target.value.normalize("NFC"))} maxLength={240} className={inputClass} placeholder="সংবাদের বাংলা শিরোনাম লিখুন" /></label>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="block text-xs font-bold text-ink">উপশিরোনাম<input value={subtitle} onChange={(event) => setSubtitle(event.target.value.normalize("NFC"))} maxLength={300} className={inputClass} placeholder="প্রয়োজনে সংক্ষিপ্ত উপশিরোনাম" /></label><label className="block text-xs font-bold text-ink">URL স্লাগ <span className="font-normal text-ink-muted">(খালি রাখলে স্থিতিশীল ASCII রূপান্তর)</span><input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={180} pattern="[a-z0-9-]+" className={inputClass} placeholder="bangla-sangbad-dhaka" dir="ltr" /></label></div>
          <label className="mt-4 block text-xs font-bold text-ink">সংক্ষিপ্ত বিবরণ / সারাংশ<textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value.normalize("NFC"))} maxLength={600} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest" placeholder="সংবাদটির সংক্ষিপ্ত পরিচিতি" /></label>
        <div className="mt-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-ink">সংবাদের মূল লেখা <span className="text-red-brand">*</span></h3><button type="button" onClick={() => { imageInserter.current = null; setShowMedia(true); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"><ImagePlus size={14} />মিডিয়া লাইব্রেরি</button></div><RichTextEditor value={body} onChange={setBody} disabled={busy || status === "ARCHIVED"} onSelectImage={(insert) => { imageInserter.current = insert; setShowMedia(true); }} /></div>
          <label className="mt-4 block text-xs font-semibold text-ink-muted">পরিবর্তনের নোট<input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} maxLength={300} className={inputClass} placeholder="যেমন: প্রতিবেদকের সংশোধন / সম্পাদকের সম্পাদনা" /></label>
        </section>

        <section className="rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="font-serif text-lg font-bold text-ink">সম্পর্কিত সংবাদ ও ভিডিও</h2>
          <div className="mt-4"><MultiSelect label="সম্পর্কিত সংবাদ" rows={visibleRelated.map((item) => ({ id: item.id, name: `${item.title} — ${STATUS_LABEL[item.status] ?? item.status}` }))} values={relatedArticleIds} onChange={setRelatedArticleIds} hint="শুধু অনুমোদিত বা প্রকাশিত সংবাদ দেখানো হয়েছে" /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-ink">YouTube ভিডিও URL<input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className={inputClass} placeholder="https://www.youtube.com/watch?v=…" dir="ltr" /></label><label className="text-xs font-bold text-ink">ভিডিওর শিরোনাম<input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} className={inputClass} placeholder="ভিডিওর বাংলা শিরোনাম" /></label></div>
        </section>

        {article?.workflowEvents.length ? <section className="rounded-2xl border border-line bg-white p-4 sm:p-6"><h2 className="font-serif text-lg font-bold text-ink">ওয়ার্কফ্লো ইতিহাস</h2><ol className="mt-4 space-y-3">{article.workflowEvents.map((event) => <li key={event.id} className="flex gap-3 border-l-2 border-paper-200 pl-3"><span className="mt-1 size-2 rounded-full bg-forest" /><div><p className="text-sm font-semibold">{STATUS_LABEL[event.toStatus] ?? event.action} <span className="font-normal text-ink-muted">· {event.actor.name}</span></p>{event.reason && <p className="mt-0.5 text-xs text-ink-muted">কারণ: {event.reason}</p>}<p className="mt-0.5 text-[11px] text-ink-muted">{new Date(event.createdAt).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })}</p></div></li>)}</ol></section> : null}
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><h2 className="font-serif text-base font-bold text-ink">প্রকাশনা</h2><p className="mt-1 text-xs text-ink-muted">প্রধান বিভাগ ও লেখক নির্বাচন বাধ্যতামূলক</p>
          <div className="mt-4 space-y-4"><MultiSelect label="বিভাগ নির্বাচন" rows={categories.map((category) => ({ id: category.id, name: `${category.parentId ? "↳ " : ""}${category.name}` }))} values={categoryIds} onChange={(value) => { setCategoryIds(value); if (!value.includes(primaryCategoryId)) setPrimaryCategoryId(value[0] ?? ""); }} />
            <label className="block text-xs font-bold text-ink">প্রধান বিভাগ<select value={primaryCategoryId} onChange={(event) => setPrimaryCategoryId(event.target.value)} className={inputClass}><option value="">নির্বাচন করুন</option>{categories.filter((item) => categoryIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <MultiSelect label="লেখক / প্রতিবেদক" rows={authors} values={authorIds} onChange={(value) => { setAuthorIds(value); if (!value.includes(primaryAuthorId)) setPrimaryAuthorId(value[0] ?? ""); }} />
            <label className="block text-xs font-bold text-ink">প্রধান লেখক<select value={primaryAuthorId} onChange={(event) => setPrimaryAuthorId(event.target.value)} className={inputClass}><option value="">নির্বাচন করুন</option>{authors.filter((item) => authorIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <MultiSelect label="ট্যাগ" rows={tags} values={tagIds} onChange={setTagIds} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><h2 className="font-serif text-base font-bold text-ink">ফিচার ছবি</h2>{featuredImageId && <div className="mt-3 overflow-hidden rounded-xl border border-line"><div className="relative aspect-[16/9] bg-paper-100"><Image src={`/api/media/${featuredImageId}`} alt={primaryImage?.altText ?? title} fill sizes="(max-width: 768px) 100vw, 330px" unoptimized className="object-cover" /></div><p className="p-2 text-xs text-ink-muted">{primaryImage?.caption || primaryImage?.altText || "নির্বাচিত ছবি"}</p></div>}<button type="button" onClick={() => setShowMedia(true)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper-50 px-3 text-xs font-semibold hover:bg-paper-100"><ImagePlus size={15} />{featuredImageId ? "ছবি পরিবর্তন" : "মিডিয়া লাইব্রেরি থেকে নির্বাচন"}</button>{featuredImageId && <button type="button" onClick={() => setFeaturedImageId("")} className="mt-2 w-full text-xs font-semibold text-red-brand">ফিচার ছবি সরান</button>}</section>

        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><h2 className="font-serif text-base font-bold text-ink">সার্চ ও সামাজিক শেয়ার</h2>
          <label className="mt-3 block text-xs font-bold text-ink">SEO শিরোনাম<input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} maxLength={120} className={inputClass} placeholder={title || "ফাঁকা রাখলে শিরোনাম ব্যবহার হবে"} /></label>
          <label className="mt-3 block text-xs font-bold text-ink">মেটা বিবরণ<textarea value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} maxLength={170} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-forest" placeholder={excerpt || "সার্চ ফলাফলের বাংলা বিবরণ"} /></label>
          <label className="mt-3 block text-xs font-bold text-ink">ক্যানোনিক্যাল URL<input value={canonicalUrl} onChange={(event) => setCanonicalUrl(event.target.value)} className={inputClass} placeholder="ফাঁকা রাখলে নিজস্ব URL ব্যবহৃত হবে" dir="ltr" /></label>
          <div className="mt-4 rounded-xl bg-paper-50 p-3"><p className="text-xs font-bold text-ink-muted">OpenGraph প্রিভিউ</p><p className="mt-1 line-clamp-2 text-sm font-bold text-ink">{seoTitle || title || "সংবাদের শিরোনাম"}</p><p className="mt-1 line-clamp-2 text-xs text-ink-muted">{seoDescription || excerpt || "সংবাদের সংক্ষিপ্ত বিবরণ"}</p>{featuredImageId && <p className="mt-2 text-[11px] text-forest">ফিচার ছবির বিকল্প লেখা ব্যবহার হবে</p>}</div>
        </section>

        <section className="sticky bottom-3 rounded-2xl border border-line bg-white p-3 shadow-lg"><button type="button" disabled={busy || !title.trim()} onClick={() => void save()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={16} />}{busy ? "সংরক্ষণ হচ্ছে…" : "খসড়া সংরক্ষণ"}</button><Link href="/admin/articles" className="mt-2 flex justify-center py-1 text-xs text-ink-muted hover:text-forest">তালিকায় ফিরে যান</Link></section>
      </aside>
    </div>
    <MediaPicker open={showMedia} onClose={() => { setShowMedia(false); imageInserter.current = null; }} onInsert={(item) => imageInserter.current?.(item)} onChoose={(item) => { setFeaturedImageId(item.mediaId); imageInserter.current = null; }} />
  </div>;
}
