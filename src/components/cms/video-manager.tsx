"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LoaderCircle, Play, Save, Send, Trash2 } from "lucide-react";

type Choice = { id: string; name: string };
type RelatedChoice = { id: string; title: string; slug: string };
type Video = {
  id: string; slug: string; title: string; description: string; thumbnailUrl: string | null;
  provider: string; videoUrl: string; externalId: string; durationSeconds: number | null;
  status: string; seoTitle: string | null; seoDescription: string | null; revisionNumber: number;
  viewCount: string; categoryId: string; authorId: string; createdById: string;
  category: { id: string; name: string; slug: string; isActive: boolean };
  author: { id: string; name: string; slug: string; title: string | null; isActive: boolean };
  tags: Array<{ tag: Choice & { slug: string } }>;
  relatedArticles: Array<{ position: number; relatedArticle: RelatedChoice }>;
  workflowEvents: Array<{ fromStatus: string | null; toStatus: string; action: string; reason: string | null; createdAt: Date; actor: { id: string; name: string } }>;
  publishedAt: Date | null;
};

type Permissions = { create: boolean; editAny: boolean; editOwn: boolean; deleteAny: boolean; deleteOwn: boolean; submit: boolean; resubmit: boolean; review: boolean; approve: boolean; reject: boolean; publish: boolean; archive: boolean };
type Props = { videos: Video[]; categories: Choice[]; tags: Array<Choice & { slug: string }>; authors: Choice[]; relatedArticles: RelatedChoice[]; permissions: Permissions; actorId: string; initialVideo?: Video };

const statusNames: Record<string, string> = { DRAFT: "খসড়া", SUBMITTED: "জমা", UNDER_REVIEW: "পর্যালোচনায়", APPROVED: "অনুমোদিত", REJECTED: "সংশোধন প্রয়োজন", PUBLISHED: "প্রকাশিত", ARCHIVED: "সংরক্ষণাগার" };

export function VideoManager({ videos, categories, tags, authors, relatedArticles, permissions, actorId, initialVideo }: Props) {
  const router = useRouter();
  const video = initialVideo;
  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(video?.videoUrl ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(video?.thumbnailUrl ?? "");
  const [duration, setDuration] = useState(video?.durationSeconds?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(video?.categoryId ?? categories[0]?.id ?? "");
  const [authorId, setAuthorId] = useState(video?.authorId ?? authors[0]?.id ?? "");
  const [tagIds, setTagIds] = useState(video?.tags.map(({ tag }) => tag.id) ?? []);
  const [relatedIds, setRelatedIds] = useState(video?.relatedArticles.map(({ relatedArticle }) => relatedArticle.id) ?? []);
  const [seoTitle, setSeoTitle] = useState(video?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(video?.seoDescription ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canEdit = Boolean(video && (permissions.editAny || (permissions.editOwn && video.createdById === actorId)));
  const allowedActions = video ? [
    ...(video.status === "DRAFT" && permissions.submit ? ["submit"] : []),
    ...(video.status === "DRAFT" && permissions.resubmit && video.workflowEvents.some((event) => event.action === "REJECT") ? ["resubmit"] : []),
    ...(video.status === "SUBMITTED" && permissions.review ? ["review"] : []),
    ...(video.status === "UNDER_REVIEW" && permissions.approve ? ["approve"] : []),
    ...(video.status === "UNDER_REVIEW" && permissions.reject ? ["reject"] : []),
    ...(video.status === "APPROVED" && permissions.publish ? ["publish"] : []),
    ...(video.status === "PUBLISHED" && permissions.archive ? ["archive"] : []),
  ] : [];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const payload = {
      title, description, provider: "YOUTUBE", videoUrl, thumbnailUrl: thumbnailUrl.trim() || null,
      durationSeconds: duration.trim() ? Number(duration) : null, categoryId, authorId, tagIds, relatedArticleIds: relatedIds,
      seoTitle: seoTitle.trim() || null, seoDescription: seoDescription.trim() || null,
      ...(video ? { expectedRevisionNumber: video.revisionNumber } : {}),
    };
    try {
      const response = await fetch(video ? `/api/admin/videos/${video.id}` : "/api/admin/videos", { method: video ? "PATCH" : "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; video?: { id: string } };
      if (!response.ok) throw new Error(result.error ?? "ভিডিও সংরক্ষণ করা যায়নি।");
      setMessage("ভিডিও খসড়া সংরক্ষিত হয়েছে।");
      if (result.video?.id && !video) router.push(`/admin/videos/${result.video.id}`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusy(false); }
  }

  async function transition(action: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/videos/${video!.id}/transition`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...(action === "reject" ? { reason } : {}) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "ভিডিও workflow সম্পন্ন হয়নি।");
      setMessage("ভিডিওর সম্পাদকীয় অবস্থা হালনাগাদ হয়েছে।"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!video) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/videos/${video.id}`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "ভিডিও অপসারণ করা যায়নি।");
      router.push("/admin/videos"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold text-red-brand">ভিডিও নিউজরুম</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">{video ? "ভিডিও সম্পাদনা" : "ভিডিও প্ল্যাটফর্ম"}</h1><p className="mt-1 text-sm leading-6 text-ink-muted">YouTube-এ হোস্ট করা ভিডিওর নিরাপদ বাংলা মেটাডেটা, সম্পর্ক ও প্রকাশনা পরিচালনা করুন।</p></div>{video && <span className="rounded-full bg-paper-100 px-3 py-1.5 text-xs font-bold text-forest">{statusNames[video.status] ?? video.status}</span>}</header>
    {(!video && permissions.create || video && canEdit && ["DRAFT", "REJECTED"].includes(video.status)) && <form onSubmit={(event) => void save(event)} className="grid gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
      <h2 className="font-serif text-xl font-bold">{video ? "ভিডিওর তথ্য" : "নতুন ভিডিও"}</h2>
      {video && <p className="text-xs text-ink-muted">স্থিতিশীল URL: <code>/video/{video.slug}</code> · সংস্করণ {video.revisionNumber}</p>}
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">বাংলা শিরোনাম</span><input required minLength={3} maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-11 w-full rounded-lg border border-line px-3 text-sm" /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">বিবরণ</span><textarea required minLength={5} maxLength={5000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-line p-3 text-sm leading-7" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold">YouTube ভিডিও URL</span><input type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="min-h-11 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">দৈর্ঘ্য (সেকেন্ড)</span><input type="number" min="0" max="86400" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} className="min-h-11 w-full rounded-lg border border-line px-3 text-sm" /></label></div>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">Thumbnail URL <span className="font-normal text-ink-muted">(ঐচ্ছিক; নির্দিষ্ট YouTube thumbnail host-এ সীমাবদ্ধ)</span></span><input type="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="ফাঁকা রাখলে YouTube thumbnail স্বয়ংক্রিয়ভাবে ব্যবহৃত হবে" className="min-h-11 w-full rounded-lg border border-line px-3 text-sm" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold">বিভাগ</span><select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">ভিডিও সম্পাদক / লেখক</span><select required value={authorId} onChange={(e) => setAuthorId(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm">{authors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold">ট্যাগ</span><select multiple value={tagIds} onChange={(e) => setTagIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))} className="min-h-32 w-full rounded-lg border border-line bg-white p-2 text-sm">{tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-1 block text-[11px] text-ink-muted">একাধিক ট্যাগ বাছতে Ctrl/Command ধরে রাখুন।</span></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">সম্পর্কিত প্রকাশিত সংবাদ</span><select multiple value={relatedIds} onChange={(e) => setRelatedIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))} className="min-h-32 w-full rounded-lg border border-line bg-white p-2 text-sm">{relatedArticles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold">SEO শিরোনাম</span><input maxLength={120} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="min-h-11 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">SEO বিবরণ</span><input maxLength={170} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="min-h-11 w-full rounded-lg border border-line px-3 text-sm" /></label></div>
      <button disabled={busy || categories.length === 0 || authors.length === 0} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-forest px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{video ? "খসড়া হালনাগাদ" : "খসড়া তৈরি"}</button>
    </form>}
    {video && <section className="rounded-2xl border border-line bg-white p-4 sm:p-6"><h2 className="font-serif text-lg font-bold">প্রকাশনা workflow</h2><p className="mt-1 text-sm text-ink-muted">খসড়া → জমা → পর্যালোচনা → অনুমোদন → প্রকাশিত</p>{video.status === "UNDER_REVIEW" && permissions.reject && <label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold">ফেরত দেওয়ার কারণ</span><textarea minLength={8} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-lg border border-line p-3 text-sm" /></label>}<div className="mt-4 flex flex-wrap gap-2">{allowedActions.map((action) => <button key={action} type="button" disabled={busy || action === "reject" && reason.trim().length < 8} onClick={() => void transition(action)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold ${action === "reject" ? "border border-red-brand text-red-brand" : "bg-forest text-white"} disabled:opacity-50`}>{action === "submit" || action === "resubmit" ? <Send size={15} /> : <Play size={15} />}{({ submit: "পর্যালোচনায় জমা", resubmit: "পুনরায় জমা", review: "পর্যালোচনা শুরু", approve: "অনুমোদন", reject: "সংশোধনে ফেরত", publish: "প্রকাশ করুন", archive: "সংরক্ষণাগারে নিন" } as Record<string, string>)[action]}</button>)}{video.status === "PUBLISHED" && <span className="self-center text-xs text-ink-muted">প্রকাশিত URL: <Link href={`/video/${video.slug}`} target="_blank" className="font-semibold text-forest hover:underline">দেখুন</Link></span>}{(permissions.deleteAny || permissions.deleteOwn) && ["DRAFT", "REJECTED", "ARCHIVED"].includes(video.status) && <button type="button" disabled={busy || !permissions.deleteAny && video.createdById !== actorId} onClick={() => void remove()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-brand px-4 text-sm font-bold text-red-brand disabled:opacity-50"><Trash2 size={15} />ভিডিও অপসারণ</button>}</div></section>}
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-bold">ভিডিও তালিকা</h2>{permissions.create && <Link href="/admin/videos/new" className="rounded-lg bg-forest px-3 py-2 text-xs font-bold text-white">নতুন ভিডিও</Link>}</div>{videos.length ? <div className="divide-y divide-line">{videos.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="min-w-0"><Link href={`/admin/videos/${item.id}`} className="font-serif font-bold leading-7 text-ink hover:text-forest">{item.title}</Link><p className="mt-1 text-xs text-ink-muted">{item.category.name} · {item.author.name} · {statusNames[item.status] ?? item.status} · {Number(item.viewCount).toLocaleString("bn-BD")} ভিউ</p></div><Link href={`/admin/videos/${item.id}`} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-forest">সম্পাদনা</Link></article>)}</div> : <p className="rounded-xl border border-dashed border-line p-6 text-sm text-ink-muted">এখনো কোনো ভিডিও খসড়া নেই।</p>}</section>
    <p role="status" aria-live="polite" className="min-h-5 text-sm text-forest">{message}</p>
  </div>;
}
