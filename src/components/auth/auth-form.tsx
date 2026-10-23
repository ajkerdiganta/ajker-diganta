"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, LoaderCircle, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Mode = "login" | "register" | "forgot" | "reset";
type LoginSurface = "reader" | "admin" | "staff";

const copy = {
  login: { eyebrow: "পাঠকের প্রবেশদ্বার", title: "আবার স্বাগতম", description: "আপনার নিরাপদ পাঠক-পরিসরে প্রবেশ করুন।", submit: "লগইন করুন" },
  register: { eyebrow: "আমাদের সাথে যুক্ত হোন", title: "নতুন পাঠক নিবন্ধন", description: "দৈনিক আজকের দিগন্তে আপনার অ্যাকাউন্ট তৈরি করুন।", submit: "নিবন্ধন সম্পন্ন করুন" },
  forgot: { eyebrow: "অ্যাকাউন্ট সহায়তা", title: "পাসওয়ার্ড পুনরুদ্ধার", description: "আপনার ইমেইলে পাসওয়ার্ড পরিবর্তনের নির্দেশনা পাঠানো হবে।", submit: "রিসেট লিংক পাঠান" },
  reset: { eyebrow: "অ্যাকাউন্ট সুরক্ষা", title: "নতুন পাসওয়ার্ড দিন", description: "কমপক্ষে ১২ অক্ষরের একটি নতুন পাসওয়ার্ড বেছে নিন।", submit: "পাসওয়ার্ড সংরক্ষণ করুন" },
} as const;

export function AuthForm({ mode, resetToken, loginSurface = "reader" }: { mode: Mode; resetToken?: string; loginSurface?: LoginSurface }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    if ((mode === "register" || mode === "reset") && password.length < 12) {
      setError("পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে।");
      return;
    }
    if (mode === "reset" && password !== confirmation) {
      setError("দুটি পাসওয়ার্ড মিলছে না।");
      return;
    }
    if (mode === "register" && name.trim().length < 2) {
      setError("অনুগ্রহ করে আপনার নাম লিখুন।");
      return;
    }
    if (mode === "register" && phone.trim() && !/^[+\d() .-]{5,40}$/.test(phone.trim())) {
      setError("সঠিক ফোন নম্বর দিন।");
      return;
    }
    setPending(true);
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error("লগইন করা যায়নি। ইমেইল ও পাসওয়ার্ড যাচাই করুন।");
        const entry = await fetch(`/api/cms/entry?surface=${loginSurface}`, { method: "GET", cache: "no-store", credentials: "same-origin" });
        const access = await entry.json() as { destination?: string; error?: string };
        if (!entry.ok || !access.destination) {
          await authClient.signOut();
          throw new Error(access.error || "অনুগ্রহ করে সঠিক প্রবেশপাতা ব্যবহার করুন।");
        }
        router.replace(access.destination);
        router.refresh();
      } else if (mode === "register") {
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, ...(phone.trim() ? { phone: phone.trim() } : {}) });
        if (result.error) throw new Error("নিবন্ধন সম্পন্ন হয়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।");
        router.replace("/dashboard");
        router.refresh();
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) throw new Error("এই মুহূর্তে অনুরোধটি সম্পন্ন করা যায়নি। পরে আবার চেষ্টা করুন।");
        setNotice("যদি এই ইমেইলে অ্যাকাউন্ট থাকে, পাসওয়ার্ড পরিবর্তনের নির্দেশনা পাঠানো হবে।");
      } else {
        if (!resetToken) throw new Error("রিসেট লিংকটি অনুপস্থিত বা মেয়াদোত্তীর্ণ।");
        const result = await authClient.resetPassword({ newPassword: password, token: resetToken });
        if (result.error) throw new Error("লিংকটি অবৈধ বা মেয়াদোত্তীর্ণ। নতুন রিসেট লিংক নিন।");
        setNotice("পাসওয়ার্ড পরিবর্তিত হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।");
    } finally {
      setPending(false);
    }
  }

  const content = mode === "login" && loginSurface === "admin"
    ? { eyebrow: "প্রশাসনিক প্রবেশ", title: "অ্যাডমিন লগইন", description: "অ্যাডমিন বা সুপার অ্যাডমিন account দিয়ে নিরাপদে প্রবেশ করুন।", submit: "অ্যাডমিন হিসেবে লগইন" }
    : mode === "login" && loginSurface === "staff"
      ? { eyebrow: "নিউজরুম কর্মী প্রবেশ", title: "রিপোর্টার / এডিটর লগইন", description: "রিপোর্টার বা এডিটর account দিয়ে newsroom-এ প্রবেশ করুন।", submit: "নিউজরুমে লগইন" }
      : copy[mode];
  return (
    <div className="w-full max-w-md">
      <div className="mb-7">
        <p className="text-xs font-bold tracking-[0.14em] text-red-brand">{content.eyebrow}</p>
        <h1 className="mt-3 font-serif text-3xl font-bold leading-snug text-ink">{content.title}</h1>
        <p className="mt-2 text-sm leading-7 text-ink-muted">{content.description}</p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "register" && <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">আপনার নাম</span><span className="relative block"><UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="নাম লিখুন" /></span></label>}
        {mode === "register" && <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">ফোন নম্বর (ঐচ্ছিক)</span><span className="relative block"><Phone size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="ফোন নম্বর" /></span></label>}
        {mode !== "reset" && <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">ইমেইল</span><span className="relative block"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} placeholder="আপনার ইমেইল ঠিকানা" /></span></label>}
        {(mode === "login" || mode === "register" || mode === "reset") && <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">পাসওয়ার্ড</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "login" ? 1 : 12} maxLength={128} placeholder={mode === "login" ? "পাসওয়ার্ড লিখুন" : "কমপক্ষে ১২ অক্ষর"} /></span></label>}
        {mode === "reset" && <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">পাসওয়ার্ড নিশ্চিত করুন</span><input className="auth-input" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={12} maxLength={128} placeholder="পাসওয়ার্ড আবার লিখুন" /></label>}
        {mode === "login" && <div className="-mt-1 flex justify-end"><Link href="/forgot-password" className="text-xs font-semibold text-forest hover:underline">পাসওয়ার্ড ভুলে গেছেন?</Link></div>}
        {error && <p role="alert" className="rounded-xl border border-red-brand/15 bg-red-brand/5 px-3 py-2.5 text-sm leading-6 text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-forest/15 bg-forest/5 px-3 py-2.5 text-sm leading-6 text-forest">{notice}</p>}
        {mode === "reset" && !resetToken && <p className="rounded-xl border border-red-brand/15 bg-red-brand/5 px-3 py-2.5 text-sm text-red-700">রিসেট টোকেন পাওয়া যায়নি। নতুন লিংক নিন।</p>}
        <Button className="w-full" type="submit" disabled={pending || (mode === "reset" && !resetToken)}>{pending && <LoaderCircle size={16} className="animate-spin" />} {content.submit}</Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        {mode === "login" && loginSurface === "reader" ? <span>নতুন পাঠক? <Link href="/register" className="font-semibold text-forest hover:underline">নিবন্ধন করুন</Link></span> : mode !== "login" ? <Link href="/login" className="font-semibold text-forest hover:underline">লগইনে ফিরুন</Link> : <span>{loginSurface === "admin" ? "শুধু অ্যাডমিন ও সুপার অ্যাডমিনের জন্য" : "শুধু রিপোর্টার ও এডিটরদের জন্য"}</span>}
        {mode === "register" && <Link href="/login" className="inline-flex items-center gap-1 text-xs"><ArrowLeft size={13} /> লগইন</Link>}
      </div>
      {mode === "reset" && notice && <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-forest hover:underline">লগইন পাতায় যান</Link>}
    </div>
  );
}
