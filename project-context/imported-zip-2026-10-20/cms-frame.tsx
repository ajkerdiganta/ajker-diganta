import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PenSquare, ClipboardCheck, CalendarClock, Tags, UsersRound, Images, LayoutDashboard, Clapperboard, ChartNoAxesCombined, Menu, Settings2, CreditCard } from "lucide-react";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { SignOutButton } from "@/components/auth/sign-out-button";

const links = [
  { href: "/admin", label: "নিউজরুম", permission: "admin.access", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "পরিসংখ্যান", permission: "analytics.read", icon: ChartNoAxesCombined },
  { href: "/admin/articles", label: "সংবাদ", permission: "article.read.own", icon: PenSquare },
  { href: "/admin/review", label: "সম্পাদনা ডেস্ক", permission: "article.review", icon: ClipboardCheck },
  { href: "/admin/scheduled", label: "নির্ধারিত প্রকাশ", permission: "article.schedule", icon: CalendarClock },
  { href: "/admin/categories", label: "বিভাগ ও ট্যাগ", permission: "taxonomy.manage", icon: Tags },
  { href: "/admin/navigation", label: "মেনু", permission: "admin.access", icon: Menu, adminOnly: true },
  { href: "/dainik/ajker/diganta/s/a/boss/inbox", label: "সাইট কনটেন্ট ও ইনবক্স", permission: "admin.access", icon: Settings2, adminOnly: true },
  { href: "/admin/subscriptions", label: "সাবস্ক্রিপশন", permission: "admin.access", icon: CreditCard, adminOnly: true },
  { href: "/admin/authors", label: "লেখক", permission: "author.read", icon: UsersRound },
  { href: "/admin/media", label: "মিডিয়া", permission: "media.read.own", icon: Images },
  { href: "/admin/videos", label: "ভিডিও newsroom", permission: "video.read.own", icon: Clapperboard },
];

export async function CmsFrame({ children }: { children: ReactNode }) {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/login");
  if (!(await hasPermission(principal.id, "admin.access"))) notFound();
  const allowed = await Promise.all(links.map(async (item) => ({ ...item, visible: item.adminOnly ? principal.roles.includes("ADMIN") || principal.roles.includes("SUPER_ADMIN") : item.href === "/admin/videos" ? (await hasPermission(principal.id, "video.read.own")) || (await hasPermission(principal.id, "video.read.any")) : await hasPermission(principal.id, item.permission) })));
  const homeHref = principal.roles.some((role) => role === "ADMIN" || role === "SUPER_ADMIN") ? "/dainik/ajker/diganta/s/a/boss" : "/d/a/d/my/staff";
  return <div className="min-h-screen bg-paper-50">
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3"><Link href={homeHref} className="font-serif text-lg font-bold text-forest">দিগন্ত <span className="text-red-brand">নিউজরুম</span></Link><span className="hidden rounded-full bg-paper-100 px-2.5 py-1 text-[11px] font-bold text-ink-muted sm:inline">বাংলা CMS</span></div>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-ink-muted sm:block">{principal.name} · {principal.roles.join(" / ")}</span><SignOutButton /></div>
      </div>
      <nav className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-3 pb-2 sm:px-5" aria-label="নিউজরুম নেভিগেশন">
        {allowed.filter((item) => item.visible).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-ink-muted transition hover:bg-forest/5 hover:text-forest"><Icon size={15} />{label}</Link>)}
      </nav>
    </header>
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-9">{children}</main>
  </div>;
}
