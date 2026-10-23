"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Page = { slug: "about" | "privacy" | "terms"; title: string; body: string; metaTitle: string | null; metaDescription: string | null };
type ManagedLink = { label: string; href: string; enabled: boolean };
type Settings = { publisherName: string; editorName: string; officeAddress: string; officePhone: string; contactRecipientEmail: string; companyLinks: ManagedLink[]; socialLinks: ManagedLink[]; googlePlayUrl: string; appStoreUrl: string };
const PAGE_LABELS = { about: "আমাদের কথা", privacy: "গোপনীয়তা", terms: "ব্যবহারের শর্ত" } as const;

export function SiteContentManager({ initialPages, initialSettings }: { initialPages: Page[]; initialSettings: Settings }) {
  const [pages, setPages] = useState(initialPages);
  const [settings, setSettings] = useState(initialSettings);
  const [publisherName, setPublisherName] = useState(initialSettings.publisherName);
  const [editorName, setEditorName] = useState(initialSettings.editorName);
  const [selected, setSelected] = useState<Page["slug"]>("about");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const page = pages.find((item) => item.slug === selected) ?? pages[0];
  const [companyLinks, setCompanyLinks] = useState(initialSettings.companyLinks);
  const [socialLinks, setSocialLinks] = useState(initialSettings.socialLinks);

  async function savePage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page) return;
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = { page: { slug: selected, title: String(form.get("title") ?? ""), body: String(form.get("body") ?? ""), metaTitle: String(form.get("metaTitle") ?? ""), metaDescription: String(form.get("metaDescription") ?? "") } };
    try {
      const response = await fetch("/api/admin/site-content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "সংরক্ষণ করা যায়নি");
      setPages((current) => current.map((item) => item.slug === selected ? data.page : item));
      setMessage("পাতার লেখা সংরক্ষণ হয়েছে।");
    } catch (error) { setMessage(error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const emptyToNull = (value: FormDataEntryValue | null) => { const text = String(value ?? "").trim(); return text || null; };
    const payload = { settings: {
      publisherName: publisherName.trim() || null, editorName: editorName.trim() || null,
      officeAddress: emptyToNull(form.get("officeAddress")), officePhone: emptyToNull(form.get("officePhone")),
      contactRecipientEmail: emptyToNull(form.get("contactRecipientEmail")),
      companyLinks, socialLinks,
      googlePlayUrl: emptyToNull(form.get("googlePlayUrl")), appStoreUrl: emptyToNull(form.get("appStoreUrl")),
    } };
    try {
      const response = await fetch("/api/admin/site-content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "সংরক্ষণ করা যায়নি");
      setSettings({ ...settings,
        publisherName: String(payload.settings.publisherName ?? ""), editorName: String(payload.settings.editorName ?? ""),
        officeAddress: String(payload.settings.officeAddress ?? ""), officePhone: String(payload.settings.officePhone ?? ""),
        contactRecipientEmail: String(payload.settings.contactRecipientEmail ?? ""),
        companyLinks, socialLinks,
        googlePlayUrl: String(payload.settings.googlePlayUrl ?? ""), appStoreUrl: String(payload.settings.appStoreUrl ?? ""),
      });
      setMessage("Footer-এর যাচাইকৃত তথ্য সংরক্ষণ হয়েছে।");
    } catch (error) { setMessage(error instanceof Error ? error.message : "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-8">
    <header><p className="text-xs font-bold text-red-brand">সাইট পরিচালনা</p><h1 className="mt-1 font-serif text-3xl font-bold text-ink">সাইটের লেখা ও footer</h1><p className="mt-2 text-sm text-ink-muted">পাতার লেখা সাধারণ text হিসেবে সংরক্ষিত হয়—HTML বা script চালানো হয় না। Privacy ও terms প্রকাশের আগে আইনগত পর্যালোচনা করুন।</p></header>
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="সম্পাদনার পাতা">{(Object.keys(PAGE_LABELS) as Page["slug"][]).map((slug) => <button key={slug} type="button" role="tab" aria-selected={selected === slug} onClick={() => { setSelected(slug); setMessage(""); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${selected === slug ? "bg-forest text-white" : "bg-paper-100 text-ink-muted"}`}>{PAGE_LABELS[slug]}</button>)}</div>
      {page && <form onSubmit={savePage} className="space-y-4">
        <label className="block text-sm font-semibold">পাতার শিরোনাম<input name="title" required maxLength={180} defaultValue={page.title} key={`${page.slug}-title`} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label>
        <label className="block text-sm font-semibold">পাতার লেখা<textarea name="body" required minLength={10} maxLength={50000} rows={13} defaultValue={page.body} key={`${page.slug}-body`} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 leading-7" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Meta title<input name="metaTitle" maxLength={120} defaultValue={page.metaTitle ?? ""} key={`${page.slug}-meta-title`} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label><label className="block text-sm font-semibold">Meta description<textarea name="metaDescription" maxLength={170} rows={2} defaultValue={page.metaDescription ?? ""} key={`${page.slug}-meta-desc`} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label></div>
        <button disabled={busy} className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "সংরক্ষণ হচ্ছে…" : "পাতা সংরক্ষণ"}</button>
      </form>}
    </section>
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h2 className="font-serif text-xl font-bold">যাচাইকৃত footer তথ্য</h2><p className="mt-1 text-sm text-ink-muted">শুধু অনুমোদিত প্রতিষ্ঠানের তথ্য যোগ করুন। বাইরের লিংক HTTPS হতে হবে। Resend ও R2 credentials private server environment-এ পরিচালিত হয়; এই CMS-এ secret paste করবেন না।</p>
      <form onSubmit={saveSettings} className="mt-5 space-y-4">
        <p className="text-xs text-ink-muted">প্রকাশক ও সম্পাদকের নাম footer-এ দেখানো হবে। নাম সরাতে মুছুন চাপুন, এরপর Footer তথ্য সংরক্ষণ করুন।</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2"><label className="flex-1 text-sm font-semibold">প্রকাশকের নাম<input name="publisherName" maxLength={180} value={publisherName} onChange={(event) => setPublisherName(event.target.value)} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label><button type="button" disabled={busy || !publisherName} onClick={() => setPublisherName("")} aria-label="প্রকাশকের নাম মুছুন" className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-2 text-xs font-semibold text-red-brand disabled:opacity-50"><Trash2 size={14} aria-hidden="true" />মুছুন</button></div>
          <div className="flex items-end gap-2"><label className="flex-1 text-sm font-semibold">সম্পাদকের নাম / Editor<input name="editorName" maxLength={180} value={editorName} onChange={(event) => setEditorName(event.target.value)} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label><button type="button" disabled={busy || !editorName} onClick={() => setEditorName("")} aria-label="সম্পাদকের নাম মুছুন" className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-2 text-xs font-semibold text-red-brand disabled:opacity-50"><Trash2 size={14} aria-hidden="true" />মুছুন</button></div>
          <label className="text-sm font-semibold">অফিস ফোন<input name="officePhone" maxLength={40} defaultValue={settings.officePhone} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label><label className="text-sm font-semibold">প্রকাশ্য যোগাযোগ ইমেইল<input name="contactRecipientEmail" type="email" maxLength={254} defaultValue={settings.contactRecipientEmail} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label>
        </div>
        <label className="block text-sm font-semibold">অফিসের ঠিকানা<textarea name="officeAddress" maxLength={1000} rows={2} defaultValue={settings.officeAddress} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Google Play HTTPS URL<input name="googlePlayUrl" type="url" maxLength={2048} defaultValue={settings.googlePlayUrl} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label><label className="block text-sm font-semibold">App Store HTTPS URL<input name="appStoreUrl" type="url" maxLength={2048} defaultValue={settings.appStoreUrl} className="mt-1 block w-full rounded-lg border border-line px-3 py-2" /></label></div>
        <fieldset className="space-y-3 rounded-xl border border-line p-4"><legend className="px-1 text-sm font-bold">প্রতিষ্ঠান ও অংশীদার লিংক</legend><p className="text-xs text-ink-muted">TheLens24 ও Habigonj24 ডিফল্টভাবে দেওয়া আছে। কোনো লিংক মুছলে বা বন্ধ করলে সেই পরিবর্তন সংরক্ষিত হবে।</p>
          {companyLinks.map((link, index) => <div key={`${link.label}-${index}`} className="grid gap-3 rounded-lg bg-paper-50 p-3 sm:grid-cols-[1fr_1.5fr_auto_auto] sm:items-end"><label className="text-xs font-semibold">নাম<input required maxLength={80} value={link.label} onChange={(event) => setCompanyLinks((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} className="mt-1 block h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="text-xs font-semibold">HTTPS URL<input required type="url" maxLength={2048} value={link.href} onChange={(event) => setCompanyLinks((current) => current.map((item, i) => i === index ? { ...item, href: event.target.value } : item))} className="mt-1 block h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={link.enabled} onChange={(event) => setCompanyLinks((current) => current.map((item, i) => i === index ? { ...item, enabled: event.target.checked } : item))} />চালু</label><button type="button" onClick={() => setCompanyLinks((current) => current.filter((_, i) => i !== index))} aria-label={`${link.label} লিংক সরান`} className="grid size-10 place-items-center rounded-lg border border-line text-red-brand hover:bg-red-50"><Trash2 size={16} aria-hidden="true" /></button></div>)}
          <button type="button" onClick={() => setCompanyLinks((current) => [...current, { label: "", href: "", enabled: true }])} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-forest"><Plus size={16} aria-hidden="true" />লিংক যোগ করুন</button>
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border border-line p-4"><legend className="px-1 text-sm font-bold">সামাজিক মাধ্যম</legend><p className="text-xs text-ink-muted">Facebook, YouTube, Instagram ও LinkedIn-এর যাচাইকৃত profile URL যোগ করুন; প্রতিটি profile আলাদাভাবে চালু বা বন্ধ করা যাবে। X বা অন্য profile-ও যোগ করা যাবে। কোনো handle অনুমান করে যোগ করা হয়নি।</p>
          {socialLinks.map((link, index) => <div key={`${link.label}-${index}`} className="grid gap-3 rounded-lg bg-paper-50 p-3 sm:grid-cols-[1fr_1.5fr_auto_auto] sm:items-end"><label className="text-xs font-semibold">মাধ্যম<input required list="social-platform-options" maxLength={80} value={link.label} onChange={(event) => setSocialLinks((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} className="mt-1 block h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="text-xs font-semibold">Profile HTTPS URL<input required type="url" maxLength={2048} value={link.href} onChange={(event) => setSocialLinks((current) => current.map((item, i) => i === index ? { ...item, href: event.target.value } : item))} className="mt-1 block h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={link.enabled} onChange={(event) => setSocialLinks((current) => current.map((item, i) => i === index ? { ...item, enabled: event.target.checked } : item))} />চালু</label><button type="button" onClick={() => setSocialLinks((current) => current.filter((_, i) => i !== index))} aria-label={`${link.label} profile সরান`} className="grid size-10 place-items-center rounded-lg border border-line text-red-brand hover:bg-red-50"><Trash2 size={16} aria-hidden="true" /></button></div>)}
          <datalist id="social-platform-options"><option value="Facebook" /><option value="YouTube" /><option value="Instagram" /><option value="LinkedIn" /><option value="X" /></datalist>
          {socialLinks.length === 0 && <p className="rounded-lg border border-dashed border-line p-3 text-xs text-ink-muted">কোনো verified social profile যুক্ত নেই; যোগ না হওয়া পর্যন্ত footer-এ non-clickable বার্তা দেখাবে।</p>}
          <button type="button" onClick={() => setSocialLinks((current) => [...current, { label: "", href: "", enabled: true }])} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-forest"><Plus size={16} aria-hidden="true" />Profile যোগ করুন</button>
        </fieldset>
        <button disabled={busy} className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "সংরক্ষণ হচ্ছে…" : "Footer তথ্য সংরক্ষণ"}</button>
      </form>
    </section>
    <p aria-live="polite" role="status" className="text-sm font-semibold text-forest">{message}</p>
  </div>;
}
