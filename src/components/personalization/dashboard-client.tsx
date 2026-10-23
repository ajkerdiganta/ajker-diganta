"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { BadgeDollarSign, Bell, Bookmark, Check, Clapperboard, Heart, LoaderCircle, Mail, Trash2, UserRound } from "lucide-react";
import { formatBangladeshDateTime } from "@/lib/public-format";

type Article = { id: string; slug: string; title: string; excerpt: string | null; publishedAt: Date | null; categories: Array<{ category: { name: string; slug: string } }>; authors: Array<{ author: { name: string; slug: string; title: string | null } }>; media: Array<{ altOverride: string | null; media: { id: string; altText: string | null; width: number | null; height: number | null; caption: string | null } }> };
type DashboardData = {
  user: { id: string; name: string; email: string; image: string | null };
  savedArticles: Array<{ createdAt: Date; article: Article }>;
  favouriteArticles: Array<{ createdAt: Date; article: Article }>;
  followedTopics: Array<{ createdAt: Date; topic: { id: string; name: string; slug: string } }>;
  followedCategories: Array<{ createdAt: Date; category: { id: string; name: string; slug: string; description: string | null } }>;
  readingHistory: Array<{ lastReadAt: Date; readCount: number; article: Article }>;
  videoHistory: Array<{ lastViewedAt: Date | string; viewCount: number; video: { id: string; slug: string; title: string; description: string; thumbnailUrl: string | null; provider: string; externalId: string; durationSeconds: number | null; publishedAt: Date | string | null; category: { name: string; slug: string }; author: { name: string; slug: string } } }>;
  availableTopics: Array<{ id: string; name: string; slug: string }>;
  availableCategories: Array<{ id: string; name: string; slug: string; description: string | null }>;
  preferences: { fontScale: string; lowBandwidthMode: boolean; readingHistoryEnabled: boolean; inAppBreakingEnabled: boolean; emailBreakingEnabled: boolean; inAppTopicEnabled: boolean; emailTopicEnabled: boolean; inAppVideoEnabled: boolean; emailVideoEnabled: boolean; inAppSystemEnabled: boolean; emailSystemEnabled: boolean };
  counts: { saved: number; favourites: number; topics: number; categories: number; history: number; videoHistory: number; unreadNotifications: number };
  membership: { active: boolean; plan: "MONTHLY" | "YEARLY" | null; expiresAt: Date | string | null };
};

async function send(path: string, method: "PUT" | "DELETE" | "PATCH", body?: Record<string, unknown>) {
  return fetch(path, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
}

export function ArticlePersonalizationButtons({ articleId, saved: initialSaved, favourite: initialFavourite }: { articleId: string; saved: boolean; favourite: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [favourite, setFavourite] = useState(initialFavourite);
  const [pending, setPending] = useState<"saved" | "favourite" | null>(null);
  const [message, setMessage] = useState("");
  async function toggle(collection: "saved" | "favourite") {
    const current = collection === "saved" ? saved : favourite;
    setPending(collection); setMessage("");
    try {
      const response = await send(`/api/me/articles/${encodeURIComponent(articleId)}/${collection}`, current ? "DELETE" : "PUT");
      if (response.status === 402) { window.dispatchEvent(new Event("subscription:required")); throw new Error("সংরক্ষণ ও পছন্দের তালিকার জন্য সদস্যতা প্রয়োজন।"); }
      if (!response.ok) throw new Error(response.status === 401 ? "সংবাদ সংরক্ষণ করতে লগইন করুন।" : "এই মুহূর্তে পরিবর্তন করা যায়নি। আবার চেষ্টা করুন।");
      if (collection === "saved") setSaved(!current); else setFavourite(!current);
      setMessage(collection === "saved" ? (!current ? "সংরক্ষিত সংবাদে যোগ হয়েছে।" : "সংরক্ষিত সংবাদ থেকে সরানো হয়েছে।") : (!current ? "পছন্দের সংবাদে যোগ হয়েছে।" : "পছন্দের সংবাদ থেকে সরানো হয়েছে।"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setPending(null); }
  }
  return <div className="flex flex-wrap items-center gap-2" aria-label="সংবাদ ব্যক্তিগতকরণ">
    <button type="button" onClick={() => void toggle("saved")} disabled={pending !== null} aria-pressed={saved} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-60 ${saved ? "border-forest bg-forest/5 text-forest" : "border-line bg-white text-ink-muted hover:border-forest hover:text-forest"}`}><Bookmark size={16} fill={saved ? "currentColor" : "none"} />{pending === "saved" ? <LoaderCircle size={14} className="animate-spin" /> : saved ? "সংরক্ষিত" : "সংরক্ষণ"}</button>
    <button type="button" onClick={() => void toggle("favourite")} disabled={pending !== null} aria-pressed={favourite} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-60 ${favourite ? "border-red-brand bg-red-brand/5 text-red-brand" : "border-line bg-white text-ink-muted hover:border-red-brand hover:text-red-brand"}`}><Heart size={16} fill={favourite ? "currentColor" : "none"} />{pending === "favourite" ? <LoaderCircle size={14} className="animate-spin" /> : favourite ? "পছন্দের" : "পছন্দ করুন"}</button>
    <span aria-live="polite" className="sr-only">{message}</span>
  </div>;
}

function ArticleRows({ items: initialItems, empty, dateLabel, collection, total }: { items: Array<{ article: Article; createdAt?: Date | string; lastReadAt?: Date | string; readCount?: number }>; empty: string; dateLabel: string; collection: "saved" | "favourite" | "history"; total: number }) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function loadMore() {
    setLoading(true); setError("");
    try {
      const endpoint = collection === "history" ? "/api/me/history" : `/api/me/collections/${collection}`;
      const response = await fetch(`${endpoint}?page=${page + 1}&pageSize=12`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json();
      if (response.status === 402) window.dispatchEvent(new Event("subscription:required"));
      if (!response.ok) throw new Error("আরও সংবাদ লোড করা যায়নি। আবার চেষ্টা করুন।");
      setItems((current) => [...current, ...payload.items]); setPage(page + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setLoading(false); }
  }
  async function remove(articleId: string) {
    const response = await send(`/api/me/articles/${encodeURIComponent(articleId)}/${collection}`, "DELETE");
    if (!response.ok) { setError("তালিকা থেকে সংবাদটি সরানো যায়নি।"); return; }
    setItems((current) => current.filter((item) => item.article.id !== articleId));
    setRecordTotal((current) => Math.max(0, current - 1));
  }
  if (!items.length && recordTotal === 0) return <p className="rounded-xl border border-dashed border-line bg-paper-50 p-5 text-sm leading-7 text-ink-muted">{empty}</p>;
  return <div><ul className="divide-y divide-line">{items.map((item) => <li key={item.article.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold text-red-brand">{item.article.categories[0]?.category.name ?? "সংবাদ"}</p><Link href={`/news/${item.article.slug}`} className="mt-1 block font-serif text-base font-bold leading-8 text-ink hover:text-forest">{item.article.title}</Link>{item.article.excerpt && <p className="mt-1 line-clamp-2 text-sm leading-7 text-ink-muted">{item.article.excerpt}</p>}</div><div className="shrink-0 text-[11px] text-ink-muted">{dateLabel} {formatBangladeshDateTime(item.lastReadAt ?? item.createdAt)}{item.readCount && item.readCount > 1 ? ` · ${item.readCount.toLocaleString("bn-BD")} বার` : ""}</div></div>{collection !== "history" && <button type="button" onClick={() => void remove(item.article.id)} className="mt-2 min-h-8 text-xs font-semibold text-ink-muted underline decoration-line underline-offset-4 hover:text-red-brand">{collection === "saved" ? "সংরক্ষিত তালিকা থেকে সরান" : "পছন্দের তালিকা থেকে সরান"}</button>}</li>)}</ul><p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-red-brand">{error}</p>{items.length < recordTotal && <button type="button" onClick={() => void loadMore()} disabled={loading} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-forest transition hover:border-forest disabled:opacity-60">{loading && <LoaderCircle size={14} className="animate-spin" />}আরও সংবাদ দেখুন</button>}</div>;
}

function VideoHistoryRows({ initialItems, total }: { initialItems: DashboardData["videoHistory"]; total: number }) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function loadMore() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/me/video-history?page=${page + 1}&pageSize=12`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error("আরও ভিডিও ইতিহাস লোড করা যায়নি।");
      setItems((current) => [...current, ...body.items]); setPage((current) => current + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setLoading(false); }
  }
  if (!items.length && total === 0) return <p className="rounded-xl border border-dashed border-line bg-paper-50 p-5 text-sm leading-7 text-ink-muted">দেখা ভিডিও এখানে দেখা যাবে।</p>;
  return <div><ul className="divide-y divide-line">{items.map((item) => <li key={item.video.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row"><Link href={`/video/${item.video.slug}`} className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-paper-100 sm:w-48">{item.video.thumbnailUrl && <Image src={item.video.thumbnailUrl} alt={`${item.video.title} — thumbnail`} fill quality={70} sizes="192px" className="object-cover"/>}</Link><div className="min-w-0"><p className="text-xs font-semibold text-red-brand">{item.video.category.name}</p><Link href={`/video/${item.video.slug}`} className="mt-1 block font-serif text-base font-bold leading-8 text-ink hover:text-forest">{item.video.title}</Link><p className="mt-1 line-clamp-2 text-sm leading-7 text-ink-muted">{item.video.description}</p><p className="mt-2 text-[11px] text-ink-muted">শেষ দেখেছেন: {formatBangladeshDateTime(item.lastViewedAt)} · {item.viewCount.toLocaleString("bn-BD")} বার</p></div></li>)}</ul><p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-red-brand">{error}</p>{items.length < total && <button type="button" onClick={() => void loadMore()} disabled={loading} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-forest disabled:opacity-60">{loading && <LoaderCircle size={14} className="animate-spin" />}আরও ভিডিও দেখুন</button>}</div>;
}

function Section({ id, title, description, children, icon }: { id: string; title: string; description?: string; children: ReactNode; icon?: ReactNode }) {
  return <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-start gap-3">{icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest/8 text-forest">{icon}</span>}<div><h2 className="font-serif text-xl font-bold text-ink">{title}</h2>{description && <p className="mt-1 text-xs leading-6 text-ink-muted">{description}</p>}</div></div>{children}</section>;
}

function FollowChoices({ kind, choices, followedIds }: { kind: "topics" | "categories"; choices: Array<{ id: string; name: string; slug: string }>; followedIds: string[] }) {
  const [selected, setSelected] = useState(() => new Set(followedIds));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function toggle(id: string) {
    const enabled = !selected.has(id); setBusy(id); setMessage("");
    try {
      const response = await send(`/api/me/${kind}/${encodeURIComponent(id)}`, enabled ? "PUT" : "DELETE");
      if (!response.ok) throw new Error("অনুসরণ হালনাগাদ করা যায়নি। আবার চেষ্টা করুন।");
      setSelected((previous) => { const next = new Set(previous); if (enabled) next.add(id); else next.delete(id); return next; });
      setMessage(enabled ? "অনুসরণ করা হচ্ছে।" : "অনুসরণ বন্ধ করা হয়েছে।");
    } catch (error) { setMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setBusy(null); }
  }
  if (!choices.length) return <p className="text-sm text-ink-muted">এখনো কোনো বিষয় পাওয়া যায়নি।</p>;
  return <div><ul className="flex flex-wrap gap-2">{choices.map((choice) => { const active = selected.has(choice.id); return <li key={choice.id}><button type="button" onClick={() => void toggle(choice.id)} disabled={busy !== null} aria-pressed={active} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-60 ${active ? "border-forest bg-forest text-white" : "border-line bg-paper-50 text-ink hover:border-forest hover:text-forest"}`}>{busy === choice.id ? <LoaderCircle size={13} className="animate-spin" /> : active ? <Check size={13} /> : null}{choice.name}{active ? " · অনুসরণ করছেন" : " · অনুসরণ"}</button></li>; })}</ul><p aria-live="polite" className="mt-2 min-h-5 text-xs text-forest">{message}</p></div>;
}

export function UserDashboard({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [profileName, setProfileName] = useState(initialData.user.name);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [videoHistoryBusy, setVideoHistoryBusy] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setProfileBusy(true); setProfileMessage("");
    try {
      const response = await send("/api/me/profile", "PATCH", { name: profileName });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "প্রোফাইল সংরক্ষণ করা যায়নি।");
      setData((current) => ({ ...current, user: body.user })); setProfileMessage("প্রোফাইল হালনাগাদ হয়েছে।"); router.refresh();
    } catch (error) { setProfileMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setProfileBusy(false); }
  }

  async function updatePreference(patch: Partial<DashboardData["preferences"]>) {
    setPreferenceBusy(true); setPreferenceMessage("");
    try {
      const response = await send("/api/me/preferences", "PATCH", patch);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "পছন্দ সংরক্ষণ করা যায়নি।");
      setData((current) => ({ ...current, preferences: body.preferences, ...(patch.readingHistoryEnabled === false ? { readingHistory: [], videoHistory: [], counts: { ...current.counts, history: 0, videoHistory: 0 } } : {}) }));
      setPreferenceMessage("পছন্দ সংরক্ষণ করা হয়েছে।"); router.refresh();
    } catch (error) { setPreferenceMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setPreferenceBusy(false); }
  }

  async function clearHistory() {
    if (!window.confirm("আপনার সম্পূর্ণ পাঠের ইতিহাস মুছে ফেলবেন? এই কাজটি ফিরিয়ে আনা যাবে না।")) return;
    setHistoryBusy(true);
    try {
      const response = await send("/api/me/history", "DELETE");
      if (!response.ok) throw new Error("পাঠের ইতিহাস মুছতে সমস্যা হয়েছে।");
      setData((current) => ({ ...current, readingHistory: [], counts: { ...current.counts, history: 0 } }));
    } catch (error) { setPreferenceMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setHistoryBusy(false); }
  }

  async function clearVideoHistory() {
    if (!window.confirm("আপনার দেখা ভিডিওর ইতিহাস মুছে ফেলবেন? এই কাজটি ফিরিয়ে আনা যাবে না।")) return;
    setVideoHistoryBusy(true);
    try {
      const response = await send("/api/me/video-history", "DELETE");
      if (!response.ok) throw new Error("ভিডিও ইতিহাস মুছতে সমস্যা হয়েছে।");
      setData((current) => ({ ...current, videoHistory: [], counts: { ...current.counts, videoHistory: 0 } }));
    } catch (error) { setPreferenceMessage(error instanceof Error ? error.message : "অনুরোধ সম্পন্ন হয়নি।"); }
    finally { setVideoHistoryBusy(false); }
  }

  const nav = ["overview", "membership", "saved", "favourites", "topics", "categories", "history", "video-history", "preferences", "profile"] as const;
  const labels = { overview: "সারসংক্ষেপ", membership: "সদস্যতা", saved: "সংরক্ষিত সংবাদ", favourites: "পছন্দের সংবাদ", topics: "অনুসরণ করা বিষয়", categories: "অনুসরণ করা বিভাগ", history: "পাঠের ইতিহাস", "video-history": "ভিডিও ইতিহাস", preferences: "পছন্দসমূহ", profile: "প্রোফাইল" };
  const topicChoices = [...new Map([...data.availableTopics, ...data.followedTopics.map(({ topic }) => topic)].map((item) => [item.id, item])).values()];
  const categoryChoices = [...new Map([...data.availableCategories, ...data.followedCategories.map(({ category }) => category)].map((item) => [item.id, item])).values()];
  const notificationOptions = [
    { title: "ব্রেকিং নিউজ", detail: "সম্পাদক ব্রেকিং হিসেবে প্রকাশিত সংবাদ।", inApp: "inAppBreakingEnabled", email: "emailBreakingEnabled" },
    { title: "অনুসরণ করা বিষয়", detail: "আপনার অনুসরণ করা ট্যাগ বা বিভাগে নতুন সংবাদ।", inApp: "inAppTopicEnabled", email: "emailTopicEnabled" },
    { title: "ভিডিও প্রকাশনা", detail: "নতুন ভিডিও প্রকাশের খবর।", inApp: "inAppVideoEnabled", email: "emailVideoEnabled" },
    { title: "সিস্টেম বার্তা", detail: "অ্যাকাউন্ট ও পরিষেবা-সংক্রান্ত বিজ্ঞপ্তি।", inApp: "inAppSystemEnabled", email: "emailSystemEnabled" },
  ] as const;
  const setNotificationPreference = (key: typeof notificationOptions[number]["inApp"] | typeof notificationOptions[number]["email"], value: boolean) => updatePreference({ [key]: value } as Partial<DashboardData["preferences"]>);
  return <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
    <aside className="h-fit rounded-2xl border border-line bg-white p-3 lg:sticky lg:top-5"><p className="px-3 py-2 text-xs font-bold text-forest">আমার ড্যাশবোর্ড</p><Link href={data.membership.active ? "/notifications" : "/subscribe?required=notifications"} className="mb-2 flex min-h-10 items-center justify-between rounded-lg bg-paper-50 px-3 text-xs font-semibold text-forest hover:bg-paper-100"><span className="inline-flex items-center gap-2"><Bell size={14}/>বিজ্ঞপ্তি</span><span className="rounded-full bg-red-brand px-2 py-0.5 text-[10px] text-white">{data.counts.unreadNotifications.toLocaleString("bn-BD")}</span></Link><nav aria-label="ড্যাশবোর্ড বিভাগ" className="flex gap-1 overflow-x-auto lg:flex-col">{nav.map((item) => <a key={item} href={`#${item}`} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-ink-muted transition hover:bg-paper-100 hover:text-forest">{labels[item]}</a>)}</nav></aside>
    <div className="min-w-0 space-y-5">
      <Section id="overview" title="আমার ড্যাশবোর্ড" description={`স্বাগতম, ${data.user.name}। আপনার পাঠের ব্যক্তিগত পরিসর এক জায়গায়।`} icon={<UserRound size={18} />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">{[["সংরক্ষিত", data.counts.saved], ["পছন্দের", data.counts.favourites], ["বিষয়", data.counts.topics], ["বিভাগ", data.counts.categories], ["সংবাদ ইতিহাস", data.counts.history], ["ভিডিও ইতিহাস", data.counts.videoHistory], ["অপঠিত বিজ্ঞপ্তি", data.counts.unreadNotifications]].map(([label, count]) => <div key={label} className="rounded-xl bg-paper-50 p-3"><p className="text-xs text-ink-muted">{label}</p><p className="mt-1 font-serif text-2xl font-bold text-forest">{Number(count).toLocaleString("bn-BD")}</p></div>)}</div>
      </Section>
      <Section id="membership" title="সদস্যতা" description="সংরক্ষিত সংবাদ, পছন্দের তালিকা ও ইনবক্স বিজ্ঞপ্তি সদস্যতার সুবিধা।" icon={<BadgeDollarSign size={18} />}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm leading-7 text-ink-muted">{data.membership.active ? `সদস্যতা সক্রিয়${data.membership.expiresAt ? ` · মেয়াদ শেষ ${new Date(data.membership.expiresAt).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}` : ""}` : "বর্তমানে কোনো সক্রিয় সদস্যতা নেই।"}</p><Link href="/subscribe" className="inline-flex min-h-10 items-center rounded-lg bg-forest px-4 text-sm font-bold text-white">{data.membership.active ? "সদস্যতার অবস্থা" : "প্ল্যান দেখুন"}</Link></div></Section>
      <Section id="saved" title="সংরক্ষিত সংবাদ" description="পরে পড়ার জন্য আলাদাভাবে সংরক্ষণ করেছেন।" icon={<Bookmark size={18} />}>{data.membership.active ? <ArticleRows key={data.counts.saved} items={data.savedArticles.map((item) => ({ article: item.article, createdAt: item.createdAt }))} dateLabel="সংরক্ষণ:" empty="আপনার সংরক্ষিত সংবাদ এখানে দেখা যাবে।" collection="saved" total={data.counts.saved} /> : <p className="rounded-xl border border-dashed border-line bg-paper-50 p-5 text-sm leading-7 text-ink-muted">এই তালিকা দেখতে সদস্যতা নিন। <Link href="/subscribe?required=saved" className="font-semibold text-forest underline">প্ল্যান দেখুন</Link></p>}</Section>
      <Section id="favourites" title="পছন্দের সংবাদ" description="আপনার পছন্দের তালিকা—সংরক্ষিত সংবাদ থেকে সম্পূর্ণ আলাদা।" icon={<Heart size={18} />}>{data.membership.active ? <ArticleRows key={data.counts.favourites} items={data.favouriteArticles.map((item) => ({ article: item.article, createdAt: item.createdAt }))} dateLabel="পছন্দ করেছেন:" empty="আপনার পছন্দের সংবাদ এখানে দেখা যাবে।" collection="favourite" total={data.counts.favourites} /> : <p className="rounded-xl border border-dashed border-line bg-paper-50 p-5 text-sm leading-7 text-ink-muted">এই তালিকা দেখতে সদস্যতা নিন। <Link href="/subscribe?required=favourite" className="font-semibold text-forest underline">প্ল্যান দেখুন</Link></p>}</Section>
      <Section id="topics" title="অনুসরণ করা বিষয়" description="ট্যাগ-ভিত্তিক বিষয় অনুসরণ করুন বা বন্ধ করুন।"><FollowChoices kind="topics" choices={topicChoices} followedIds={data.followedTopics.map(({ topic }) => topic.id)} /></Section>
      <Section id="categories" title="অনুসরণ করা বিভাগ" description="যে বিভাগগুলো নিয়মিত পড়তে চান সেগুলো বেছে নিন।"><FollowChoices kind="categories" choices={categoryChoices} followedIds={data.followedCategories.map(({ category }) => category.id)} /></Section>
      <Section id="history" title="পাঠের ইতিহাস" description="সাম্প্রতিক পড়া প্রকাশিত সংবাদ—শুধু আপনার অ্যাকাউন্টে দৃশ্যমান।"><div className="mb-4 flex justify-end"><button type="button" onClick={() => void clearHistory()} disabled={historyBusy || !data.readingHistory.length} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-ink-muted transition hover:border-red-brand hover:text-red-brand disabled:opacity-50">{historyBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}সংবাদ ইতিহাস মুছুন</button></div><ArticleRows key={data.counts.history} items={data.readingHistory.map((item) => ({ article: item.article, lastReadAt: item.lastReadAt, readCount: item.readCount }))} dateLabel="শেষ পড়েছেন:" empty="পড়া সংবাদ এখানে দেখা যাবে।" collection="history" total={data.counts.history} /></Section>
      <Section id="video-history" title="ভিডিও ইতিহাস" description="আপনার দেখা প্রকাশিত ভিডিও—এটি সংবাদ পাঠের ইতিহাস থেকে আলাদা ও ব্যক্তিগত।" icon={<Clapperboard size={18} />}><div className="mb-4 flex justify-end"><button type="button" onClick={() => void clearVideoHistory()} disabled={videoHistoryBusy || !data.videoHistory.length} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-ink-muted hover:border-red-brand hover:text-red-brand disabled:opacity-50">{videoHistoryBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}ভিডিও ইতিহাস মুছুন</button></div><VideoHistoryRows key={data.counts.videoHistory} initialItems={data.videoHistory} total={data.counts.videoHistory}/></Section>
      <Section id="preferences" title="পছন্দসমূহ" description="আপনার পড়ার অভিজ্ঞতা, ইতিহাস এবং বিজ্ঞপ্তি নিয়ন্ত্রণ করুন।"><div className="space-y-4"><label className="flex flex-wrap items-center justify-between gap-3"><span><span className="block text-sm font-semibold text-ink">লেখার আকার</span><span className="text-xs text-ink-muted">বাংলা লেখা পড়তে আরামদায়ক আকার বেছে নিন।</span></span><select value={data.preferences.fontScale} disabled={preferenceBusy} onChange={(event) => void updatePreference({ fontScale: event.target.value as "comfortable" | "large" })} className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm"><option value="comfortable">স্বাভাবিক</option><option value="large">বড়</option></select></label><label className="flex items-start justify-between gap-3"><span><span className="block text-sm font-semibold text-ink">কম ডেটা ব্যবহার</span><span className="text-xs text-ink-muted">দুর্বল সংযোগে সংবাদ পাতার বড় ছবি বন্ধ থাকবে।</span></span><input type="checkbox" checked={data.preferences.lowBandwidthMode} disabled={preferenceBusy} onChange={(event) => void updatePreference({ lowBandwidthMode: event.target.checked })} className="mt-1 size-4 accent-forest" /></label><label className="flex items-start justify-between gap-3"><span><span className="block text-sm font-semibold text-ink">পাঠের ইতিহাস সংরক্ষণ</span><span className="text-xs text-ink-muted">বন্ধ করলে আগের ইতিহাস মুছে যাবে এবং নতুন পাঠ আর যোগ হবে না।</span></span><input type="checkbox" checked={data.preferences.readingHistoryEnabled} disabled={preferenceBusy} onChange={(event) => void updatePreference({ readingHistoryEnabled: event.target.checked })} className="mt-1 size-4 accent-forest" /></label>
        <div className="border-t border-line pt-4"><h3 className="font-serif text-lg font-bold">বিজ্ঞপ্তির পছন্দ</h3><p className="mt-1 text-xs leading-6 text-ink-muted">ইনবক্স বিজ্ঞপ্তি ডিফল্টে চালু; ইমেইল ডিফল্টে বন্ধ। ইমেইল পাঠানো চালু হবে কেবল প্রেরণ-সেবা ও কর্মী সংযুক্ত হলে।</p><div className="mt-3 divide-y divide-line">{notificationOptions.map((option) => <div key={option.inApp} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><span><span className="block text-sm font-semibold text-ink">{option.title}</span><span className="text-xs text-ink-muted">{option.detail}</span></span><div className="flex gap-4"><label className="inline-flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={data.preferences[option.inApp]} disabled={preferenceBusy} onChange={(event) => void setNotificationPreference(option.inApp, event.target.checked)} className="size-4 accent-forest"/>ইনবক্স</label><label className="inline-flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={data.preferences[option.email]} disabled={preferenceBusy} onChange={(event) => void setNotificationPreference(option.email, event.target.checked)} className="size-4 accent-forest"/><Mail size={13}/>ইমেইল পছন্দ</label></div></div>)}</div></div>
        <p role="status" aria-live="polite" className="min-h-5 text-xs text-forest">{preferenceMessage}</p></div></Section>
      <Section id="profile" title="প্রোফাইল" description="আপনার নাম সম্পাদনা করুন। ইমেইল ঠিকানা লগইন পরিচয় হিসেবে ব্যবহৃত হয়, তাই এখানে পরিবর্তনযোগ্য নয়." icon={<UserRound size={18} />}><form onSubmit={(event) => void saveProfile(event)} className="max-w-xl space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">নাম</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={2} maxLength={80} required className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-forest" /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">ইমেইল</span><input value={data.user.email} readOnly className="min-h-11 w-full rounded-lg border border-line bg-paper-50 px-3 text-sm text-ink-muted" /></label><button disabled={profileBusy || profileName.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-bold text-white transition hover:bg-forest-700 disabled:opacity-60">{profileBusy && <LoaderCircle size={15} className="animate-spin" />}প্রোফাইল সংরক্ষণ</button><p role="status" aria-live="polite" className="min-h-5 text-xs text-forest">{profileMessage}</p></form></Section>
    </div>
  </div>;
}
