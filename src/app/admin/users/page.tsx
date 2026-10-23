import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { ROLE_NAMES } from "@/lib/permissions";
import type { RoleCode } from "@/generated/prisma/enums";
import { CmsFrame } from "@/components/cms/cms-frame";
import { UserAccountActions } from "@/components/cms/user-account-actions";
import { createManagedUserAction } from "./actions";

export const metadata: Metadata = { title: "ব্যবহারকারী | দৈনিক আজকের দিগন্ত" };
export const dynamic = "force-dynamic";
const assignableRoles: RoleCode[] = ["ADMIN", "EDITOR", "REPORTER", "VIDEO_EDITOR", "MODERATOR", "USER"];
const createableRoles: RoleCode[] = ["ADMIN", "EDITOR", "REPORTER", "USER"];
const noticeText: Record<string, string> = {
  created: "নতুন অ্যাকাউন্ট তৈরি হয়েছে।",
  removed: "অ্যাকাউন্ট অপসারণ ও লগইন বাতিল হয়েছে। সংরক্ষিত আর্থিক রেকর্ড audit-এর জন্য রাখা হয়েছে।",
  "updated=role": "ব্যবহারকারীর ভূমিকা হালনাগাদ হয়েছে।",
  "updated=status": "অ্যাকাউন্টের অবস্থা হালনাগাদ হয়েছে।",
};
const errorText: Record<string, string> = {
  invalid: "তথ্য সঠিক নয়। ভূমিকা, ইমেইল, ফোন ও পাসওয়ার্ড যাচাই করুন।",
  create: "অ্যাকাউন্ট তৈরি করা যায়নি। ইমেইল আগে থেকে ব্যবহৃত হতে পারে; তথ্য যাচাই করে আবার চেষ্টা করুন।",
  update: "এই পরিবর্তন সম্পন্ন হয়নি। শেষ প্রশাসক ও সংরক্ষিত অ্যাকাউন্টের নিরাপত্তা পরীক্ষা করুন।",
  protected: "এই অ্যাকাউন্ট অপসারণ করা যায়নি। সংরক্ষিত প্রশাসক বা আর্থিক রেকর্ড অক্ষত রাখা হয়েছে।",
};
type PageProps = { searchParams: Promise<{ created?: string; removed?: string; updated?: string; error?: string }> };

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "users.read"))) redirect("/forbidden");
  const canManage = await hasPermission(principal.id, "users.manage");
  const params = await searchParams;
  const notice = params.created ? noticeText.created : params.removed ? noticeText.removed : params.updated ? noticeText[`updated=${params.updated}`] : "";
  const errorMessage = params.error ? errorText[params.error] ?? "অনুরোধটি সম্পন্ন হয়নি।" : "";
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { email: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      roleAssignments: { select: { role: { select: { code: true } } } },
    },
  });
  const roleOptions = assignableRoles.map((code) => ({ code, label: ROLE_NAMES[code] }));

  return <CmsFrame><div className="space-y-6">
    <header><p className="text-xs font-bold text-forest">শুধু অ্যাডমিন ও সুপার অ্যাডমিন</p><h1 className="mt-1 font-serif text-3xl font-bold">ব্যবহারকারী ও ভূমিকা</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">সর্বশেষ ১০০টি সক্রিয় রেকর্ডে নাম, ইমেইল, ঐচ্ছিক ফোন, ভূমিকা ও অবস্থা দেখানো হয়। পাঠক, রিপোর্টার, এডিটর ও অ্যাডমিন account এখান থেকে তৈরি বা নিয়ন্ত্রণ করুন; পাঠকেরা চাইলে public registration-ও ব্যবহার করতে পারেন। Subscriber তালিকা আলাদা। Password, session token বা payment credential এখানে কখনো দেখানো হয় না।</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/admin/subscribers" className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-forest">সক্রিয় Subscriber তালিকা</Link><Link href="/admin/subscriptions" className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-forest">Payment verification queue</Link></div></header>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {errorMessage && <p role="alert" className="rounded-xl border border-red-brand/20 bg-red-brand/5 p-3 text-sm text-red-brand">{errorMessage}</p>}

    {canManage && <section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h2 className="font-serif text-xl font-bold">নতুন account তৈরি</h2><p className="mt-1 text-xs leading-6 text-ink-muted">শুধু Admin / Super Admin এই form ব্যবহার করতে পারবেন। এখান থেকে পাঠক (USER), Reporter, Editor ও Admin account তৈরি করুন; পাঠকেরা public registration-ও ব্যবহার করতে পারেন। প্রথম password hash হয়ে সংরক্ষিত হয়, পরে আর দেখা যাবে না।</p><form action={createManagedUserAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-semibold">নাম<input name="name" autoComplete="name" required minLength={2} maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="text-xs font-semibold">ইমেইল<input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="text-xs font-semibold">ফোন (ঐচ্ছিক)<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} pattern="[+0-9() .-]{5,40}" className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><label className="text-xs font-semibold">ভূমিকা<select name="roleCode" defaultValue="REPORTER" className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm">{createableRoles.map((code) => <option key={code} value={code}>{ROLE_NAMES[code]}</option>)}</select></label><label className="text-xs font-semibold">প্রাথমিক password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm" /></label><div className="flex items-end"><button type="submit" className="h-10 w-full rounded-lg bg-forest px-4 text-sm font-bold text-white">নতুন account তৈরি করুন</button></div></form></section>}

    <section className="overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-paper-100 text-xs text-ink-muted"><tr><th className="p-3">ব্যবহারকারী / যোগাযোগ</th><th className="p-3">ভূমিকা</th><th className="p-3">অবস্থা</th><th className="p-3">যোগদানের তারিখ</th>{canManage && <th className="p-3">পরিচালনা</th>}</tr></thead><tbody className="divide-y divide-line">{users.map((user) => {
      const roleCodes = user.roleAssignments.map(({ role }) => role.code);
      const isProtected = roleCodes.includes("SUPER_ADMIN");
      const isAdmin = roleCodes.includes("ADMIN");
      const canEditTarget = canManage && user.id !== principal.id && !isProtected && (principal.isSuperAdmin || !isAdmin);
      return <tr key={user.id}>
        <td className="p-3"><p className="font-semibold text-ink">{user.name}</p><p className="mt-0.5 text-xs text-ink-muted">{user.email}</p><p className="mt-0.5 text-xs text-ink-muted">ফোন: {user.phone || "দেওয়া হয়নি"}</p></td>
        <td className="p-3">{roleCodes.map((role) => ROLE_NAMES[role as RoleCode]).join(" · ") || "—"}</td>
        <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{user.status === "ACTIVE" ? "সক্রিয়" : "স্থগিত"}</span></td>
        <td className="p-3 text-xs text-ink-muted">{user.createdAt.toLocaleDateString("bn-BD")}</td>
        {canManage && <td className="p-3"><UserAccountActions userId={user.id} userName={user.name} status={user.status} currentRole={roleCodes[0] ?? "USER"} roleOptions={roleOptions} canEditRole={canEditTarget} canChangeStatus={canEditTarget} canRemove={canEditTarget} /></td>}
      </tr>;
    })}</tbody></table>{users.length === 0 && <p className="p-6 text-center text-sm text-ink-muted">এখনো কোনো account নেই।</p>}</section>
    <p className="text-xs leading-6 text-ink-muted">স্থগিত করলে সব active session বাতিল হয়। অপসারণ করলে login credential, session ও role মুছে PII-সহ account পরিচয় anonymize করা হয়; article/audit/subscription/payment history foreign-key নিরাপদে রেখে আর্থিক যাচাইয়ের রেকর্ড সংরক্ষিত থাকে। Super Admin, নিজের account এবং শেষ সক্রিয় administrator অপসারণ/স্থগিত করা যাবে না।</p>
  </div></CmsFrame>;
}
