"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, BookOpenText, ClipboardCheck, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UsersRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const roles = [
  { id: "ADMIN", title: "অ্যাডমিন লগইন", short: "অ্যাডমিন", description: "সাইট পরিচালনা, প্রশাসনিক পরিসংখ্যান ও পূর্ণ CMS নিয়ন্ত্রণ।", icon: ShieldCheck, color: "border-[#d7bf84] bg-[#fffcf2] text-[#765b16]", destination: "/admin" },
  { id: "REPORTER", title: "রিপোর্টার লগইন", short: "রিপোর্টার", description: "নিজস্ব সংবাদ তৈরি, খসড়া সম্পাদনা ও সম্পাদনার জন্য জমা দিন।", icon: BookOpenText, color: "border-[#c8d8cb] bg-[#f4faf5] text-forest", destination: "/admin" },
  { id: "EDITOR", title: "এডিটর লগইন", short: "এডিটর", description: "জমা পড়া সংবাদ পর্যালোচনা, সম্পাদনা, অনুমোদন ও প্রকাশ করুন।", icon: ClipboardCheck, color: "border-[#efd1c8] bg-[#fff7f4] text-red-brand", destination: "/admin" },
] as const;
type CmsRole = (typeof roles)[number]["id"];

export function CmsAccess() {
  const router = useRouter();
  const [selected, setSelected] = useState<CmsRole>("ADMIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const chosen = roles.find((role) => role.id === selected)!;

  function chooseRole(role: CmsRole) {
    setSelected(role);
    setError("");
    document.getElementById("cms-login")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    let sessionIssued = false;
    try {
      const login = await authClient.signIn.email({ email: email.trim(), password });
      if (login.error) throw new Error("লগইন করা যায়নি। ইমেইল ও পাসওয়ার্ড যাচাই করে আবার চেষ্টা করুন।");
      sessionIssued = true;

      // Role membership is verified by the server from the newly issued session.
      const response = await fetch(`/api/cms/entry?role=${encodeURIComponent(selected)}`, { method: "GET", cache: "no-store", credentials: "same-origin", headers: { accept: "application/json" } });
      const responseText = await response.text();
      let result: { destination?: string; error?: string };
      try {
        result = JSON.parse(responseText) as { destination?: string; error?: string };
      } catch {
        throw new Error("নিউজরুম অনুমতি যাচাই করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।");
      }
      if (!response.ok || !result.destination) {
        throw new Error(result.error || "এই প্রবেশ-ধরনটির জন্য আপনার অনুমতি নেই।");
      }
      router.replace(result.destination);
      router.refresh();
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : "অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।";
      if (sessionIssued) {
        try {
          await authClient.signOut();
        } catch {
          message = "প্রবেশ যাচাই সম্পন্ন হয়নি। পুনরায় চেষ্টা করুন; প্রয়োজনে account থেকে লগআউট করুন।";
        }
      }
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return <main className="overflow-hidden bg-paper-50 text-ink">
    <section className="relative isolate overflow-hidden bg-forest text-white">
      <div className="absolute -right-28 -top-32 size-[34rem] rounded-full border border-white/10" />
      <div className="absolute right-24 top-16 size-64 rounded-full border border-white/10" />
      <div className="absolute -bottom-32 left-[18%] size-72 rounded-full bg-white/[0.035] blur-2xl" />
      <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
        <div className="max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"><ArrowLeft size={16} /> প্রচ্ছদে ফিরুন</Link>
          <p className="mt-12 text-xs font-bold tracking-[0.2em] text-[#e4c67d]">দৈনিক আজকের দিগন্ত · CMS ACCESS</p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.45] sm:text-5xl lg:text-6xl">নিউজরুমে স্বাগতম</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">প্রতিবেদন থেকে প্রকাশনা—বিশ্বস্ত সংবাদ তৈরির প্রতিটি ধাপে আমাদের newsroom team-এর জন্য একটি নিরাপদ কর্মপরিসর।</p>
          <a href="#cms-roles" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e4c67d] px-5 text-sm font-bold text-[#29392e] transition hover:bg-[#f0d995]">আপনার প্রবেশপথ বেছে নিন <ArrowDown size={16} /></a>
          <p className="mt-5 text-xs text-white/55">শুধু অনুমোদিত newsroom account-এর জন্য।</p>
        </div>
        <div className="hidden justify-end lg:flex"><div className="relative w-full max-w-sm rounded-[2rem] border border-white/15 bg-white/[0.07] p-7 backdrop-blur-sm"><div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-[#e4c67d]"><BadgeCheck size={28} /></div><h2 className="mt-6 font-serif text-2xl font-bold">নিরাপদ প্রবেশ</h2><ul className="mt-5 space-y-4 text-sm leading-6 text-white/70"><li className="flex gap-3"><KeyRound size={17} className="mt-0.5 shrink-0 text-[#e4c67d]" />ব্যক্তিগত newsroom account ব্যবহার করুন।</li><li className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#e4c67d]" />সার্ভার আপনার প্রকৃত ভূমিকা যাচাই করে।</li><li className="flex gap-3"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#e4c67d]" />ভূমিকার বাইরে কোনো প্রবেশ অনুমোদিত নয়।</li></ul></div></div>
      </div>
    </section>

    <section id="cms-roles" className="scroll-mt-8 mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold tracking-[0.16em] text-red-brand">আপনার পরিচয় অনুযায়ী প্রবেশ</p><h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">কোন ভূমিকায় কাজ করবেন?</h2><p className="mt-4 text-sm leading-7 text-ink-muted">নিজের newsroom role নির্বাচন করুন। লগইনের পর সার্ভার আপনার অ্যাকাউন্টের অনুমতি মিলিয়ে নেবে; শুধু কার্ড নির্বাচন করে অনুমতি পাওয়া যায় না।</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">{roles.map(({ id, title, description, icon: Icon, color }) => <button key={id} type="button" onClick={() => chooseRole(id)} aria-pressed={selected === id} className={`group rounded-2xl border-2 p-6 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest ${color} ${selected === id ? "ring-2 ring-forest ring-offset-2" : ""}`}><span className="grid size-12 place-items-center rounded-xl bg-white/80"><Icon size={24} /></span><span className="mt-5 block font-serif text-xl font-bold">{title}</span><span className="mt-2 block min-h-14 text-sm leading-6 text-ink-muted">{description}</span><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">এই ভূমিকায় প্রবেশ <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></button>)}</div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div className="rounded-2xl bg-[#ecebe4] p-6 sm:p-8"><p className="text-xs font-bold tracking-[0.15em] text-forest">কর্মপ্রবাহ</p><h3 className="mt-3 font-serif text-2xl font-bold">সংবাদ, দায়িত্বশীলভাবে</h3><div className="mt-6 space-y-5">{[{ n: "০১", title: "প্রতিবেদন তৈরি", text: "রিপোর্টার খসড়া তৈরি করে সম্পাদনার জন্য জমা দেন।" }, { n: "০২", title: "সম্পাদনা ও যাচাই", text: "এডিটর তথ্য যাচাই, সম্পাদনা ও প্রকাশের সিদ্ধান্ত নেন।" }, { n: "০৩", title: "নিরাপদ প্রকাশনা", text: "অনুমোদিত account-ই নির্দিষ্ট newsroom কাজ করতে পারে।" }].map((step) => <div key={step.n} className="flex gap-4"><span className="font-serif text-xl font-bold text-red-brand">{step.n}</span><div><h4 className="text-sm font-bold">{step.title}</h4><p className="mt-1 text-sm leading-6 text-ink-muted">{step.text}</p></div></div>)}</div></div>

        <section id="cms-login" className="scroll-mt-8 rounded-2xl border border-line bg-white p-6 shadow-[0_18px_55px_-38px_rgba(31,48,37,0.42)] sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.14em] text-red-brand">{chosen.short.toUpperCase()} · CMS LOGIN</p><h3 className="mt-2 font-serif text-2xl font-bold">{chosen.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">নিজের অনুমোদিত newsroom ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।</p></div><span className="grid size-12 place-items-center rounded-xl bg-paper-100 text-forest"><chosen.icon size={23} /></span></div>
          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">ইমেইল</span><span className="relative block"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="name@example.com" /></span></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">পাসওয়ার্ড</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" /><input className="auth-input pl-10" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={1} maxLength={128} placeholder="আপনার পাসওয়ার্ড" /></span></label>
            {error && <p role="alert" className="rounded-xl border border-red-brand/15 bg-red-brand/5 px-3 py-2.5 text-sm leading-6 text-red-700">{error}</p>}
            <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white transition hover:bg-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-60">{pending ? <LoaderCircle size={17} className="animate-spin" /> : <LockKeyhole size={16} />}নিরাপদে লগইন করুন</button>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted"><Link href="/forgot-password" className="font-semibold text-forest hover:underline">পাসওয়ার্ড ভুলে গেছেন?</Link><span>কোনো newsroom account দরকার? <Link href="/contact" className="font-semibold text-forest hover:underline">প্রশাসনের সাথে যোগাযোগ করুন</Link></span></div>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-6 text-ink-muted">আপনার ভূমিকায় অনুমতি না থাকলে লগইন বাতিল হবে। ভূমিকা পরিবর্তনের জন্য অ্যাডমিনের অনুমোদন প্রয়োজন।</p>
        </section>
      </div>
    </section>

    <section className="border-y border-line bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-3">{[{ icon: ShieldCheck, title: "সার্ভার-যাচাইকৃত অনুমতি", text: "ক্লায়েন্টে role বেছে নিলেই access মেলে না; প্রতিটি CMS পাতা ও API নিজস্ব অনুমতি যাচাই করে।" }, { icon: UsersRound, title: "ব্যক্তিগত অ্যাকাউন্ট", text: "একই newsroom credential অন্যের সাথে ভাগ করবেন না; প্রত্যেক সদস্য নিজের অ্যাকাউন্ট ব্যবহার করবেন।" }, { icon: LockKeyhole, title: "নিরাপদ অভ্যাস", text: "শক্তিশালী অনন্য পাসওয়ার্ড নিন, লগইনের পর কাজ শেষে সাইন আউট করুন।" }].map(({ icon: Icon, title, text }) => <article key={title}><Icon size={23} className="text-forest" /><h3 className="mt-4 font-serif text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-7 text-ink-muted">{text}</p></article>)}</div></section>

    <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-8"><p className="text-sm text-ink-muted">আপনি কি পাঠক হিসেবে লগইন করতে চান?</p><Link href="/login" className="mt-3 inline-flex items-center gap-2 font-semibold text-forest hover:underline">পাঠক লগইন পাতায় যান <ArrowRight size={15} /></Link></section>
  </main>;
}
