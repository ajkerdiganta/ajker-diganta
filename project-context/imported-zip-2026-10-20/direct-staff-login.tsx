"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";

type DirectMode = "admin" | "staff";
const copy = {
  admin: { eyebrow: "ADMIN ACCESS", title: "অ্যাডমিন CMS লগইন", description: "অ্যাডমিন ও সুপার অ্যাডমিনের জন্য নির্ধারিত নিরাপদ প্রবেশপথ।" },
  staff: { eyebrow: "STAFF ACCESS", title: "রিপোর্টার / এডিটর CMS লগইন", description: "রিপোর্টার ও এডিটর account-এর জন্য নির্ধারিত নিরাপদ প্রবেশপথ।" },
} as const;

export function DirectStaffLogin({ mode }: { mode: DirectMode }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const content = copy[mode];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try {
      const loginResponse = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        cache: "no-store",
      });
      if (!loginResponse.ok) throw new Error("লগইন করা যায়নি। ইমেইল ও পাসওয়ার্ড যাচাই করুন।");
      const response = await fetch(`/api/cms/entry?direct=${mode}`, { cache: "no-store", credentials: "same-origin" });
      const result = await response.json() as { destination?: string; error?: string };
      if (!response.ok || !result.destination) throw new Error(result.error || "এই account-এর CMS অনুমতি নেই।");
      const destination = new URL(result.destination, window.location.origin);
      destination.searchParams.set("session", Date.now().toString(36));
      window.location.replace(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।");
    } finally { setPending(false); }
  }
  return <main className="min-h-[620px] bg-paper-50 px-4 py-12 sm:px-6"><section className="mx-auto w-full max-w-xl rounded-[2rem] border border-line bg-white p-7 shadow-[0_24px_70px_-36px_rgba(26,44,34,0.35)] sm:p-12"><p className="text-xs font-bold tracking-[0.18em] text-red-brand">{content.eyebrow}</p><h1 className="mt-3 font-serif text-3xl font-bold leading-snug text-ink">{content.title}</h1><p className="mt-2 text-sm leading-7 text-ink-muted">{content.description}</p><form onSubmit={submit} className="mt-8 space-y-4" noValidate><label className="block"><span className="mb-1.5 block text-sm font-semibold">ইমেইল</span><span className="relative block"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></span></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">পাসওয়ার্ড</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} /></span></label>{error && <p role="alert" className="rounded-xl border border-red-brand/15 bg-red-brand/5 px-3 py-2.5 text-sm leading-6 text-red-700">{error}</p>}<button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white disabled:opacity-60">{pending && <LoaderCircle size={17} className="animate-spin" />}নিরাপদে লগইন করুন</button></form></section></main>;
}
