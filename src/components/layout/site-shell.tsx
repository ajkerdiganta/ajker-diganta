import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { localTimeLine } from "@/lib/public-format";
import { HamburgerMenu } from "@/components/layout/hamburger-menu";
import { getFooterSettings } from "@/lib/site-content";

type MenuItem = {
  id: string;
  label: string;
  href: string;
  children?: Array<{ id: string; label: string; href: string }>;
};

export async function SiteHeader() {
  const [categories, headerMenu, hamburgerMenu] = await Promise.all([
    prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
        deletedAt: null,
        articles: { some: { article: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null } } },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        children: {
          where: {
            isActive: true,
            deletedAt: null,
            articles: { some: { article: { status: "PUBLISHED", publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null } } },
          },
          select: { id: true, name: true, slug: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          take: 12,
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 8,
    }).catch(() => []),
    prisma.navigationMenu.findFirst({
      where: { slug: "header-main", isActive: true },
      include: { items: { where: { isActive: true, parentId: null }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
    }).catch(() => null),
    prisma.navigationMenu.findFirst({
      where: { slug: "hamburger", isActive: true },
      include: { items: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
    }).catch(() => null),
  ]);

  const categoryItems: MenuItem[] = categories.map((category) => ({
    id: category.id,
    label: category.name,
    href: `/category/${category.slug}`,
    children: category.children.map((child) => ({ id: child.id, label: child.name, href: `/category/${child.slug}` })),
  }));
  const fallbackItems: MenuItem[] = [
    { id: "home", label: "প্রচ্ছদ", href: "/" },
    { id: "latest", label: "সর্বশেষ", href: "/latest" },
    ...categoryItems,
    { id: "video", label: "ভিডিও", href: "/video" },
    { id: "about", label: "আমাদের কথা", href: "/about" },
    { id: "subscribe", label: "সাবস্ক্রিপশন", href: "/subscribe" },
    { id: "dashboard", label: "আমার ড্যাশবোর্ড", href: "/dashboard" },
    { id: "notifications", label: "বিজ্ঞপ্তি", href: "/notifications" },
    { id: "contact", label: "যোগাযোগ", href: "/contact" },
  ];

  const primaryNavigation = headerMenu
    ? headerMenu.items.map(({ id, label, href }) => ({ id, label, href }))
    : fallbackItems.filter((item) => ["home", "latest", "video", "about", ...categories.map(({ id }) => id)].includes(item.id));
  const managedHamburger = (hamburgerMenu?.items ?? [])
    .filter((item) => item.parentId === null)
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      children: (hamburgerMenu?.items ?? []).filter((child) => child.parentId === item.id).map(({ id, label, href }) => ({ id, label, href })),
    }));
  const hamburgerItems = hamburgerMenu ? managedHamburger : fallbackItems;

  return (
    <header className="relative z-10 border-b border-line bg-paper-50">
      <div className="bg-forest text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[11px] sm:px-6 lg:px-8"><p className="font-semibold">সত্য · সময় · সমাজ</p><p className="text-right text-white/75">{localTimeLine()}</p></div></div>
      <div className="relative mx-auto flex min-h-[158px] max-w-7xl items-end justify-center px-4 pb-2 pt-[98px] sm:px-6 md:min-h-[112px] md:items-center md:justify-end md:py-4 lg:px-8">
        <Link href="/" aria-label="দৈনিক আজকের দিগন্ত — প্রচ্ছদ" className="absolute left-1/2 top-2 w-[min(78vw,20rem)] -translate-x-1/2 md:left-6 md:top-1/2 md:w-[min(35vw,22rem)] md:-translate-y-1/2 md:translate-x-0 lg:left-8">
          <Image src="/assets/dainik-ajker-diganta-logo.png" alt="দৈনিক আজকের দিগন্ত" width={1600} height={533} priority className="h-auto w-full object-contain" />
        </Link>
        <div className="relative z-20 flex shrink-0 items-center gap-2">
          <form action="/search" className="hidden lg:flex"><label className="sr-only" htmlFor="site-search">সংবাদ খুঁজুন</label><input id="site-search" name="q" placeholder="সংবাদ খুঁজুন…" className="h-10 w-44 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-forest md:w-56" /><button type="submit" className="grid size-10 place-items-center rounded-lg bg-white text-forest" aria-label="খুঁজুন"><Search size={17} /></button></form>
          <Link href="/search" className="grid size-10 place-items-center rounded-lg border border-line bg-white text-forest lg:hidden" aria-label="সংবাদ খুঁজুন"><Search size={18} /></Link>
          <HamburgerMenu items={hamburgerItems} />
          <Link href="/login" className="hidden min-h-10 items-center rounded-lg px-3 py-2 text-sm font-semibold text-ink transition hover:bg-paper-100 md:inline-flex">পাঠক লগইন</Link>
          <Link href="/register" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-red-brand px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 sm:gap-2 sm:px-4"><span className="hidden sm:inline">পাঠক নিবন্ধন</span><span className="sm:hidden">নিবন্ধন</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </div>
      <nav aria-label="প্রধান নেভিগেশন" className="border-t border-line bg-white/90"><div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">{primaryNavigation.map((item, index) => <Link key={item.id} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-paper-100 hover:text-forest focus-visible:outline-2 focus-visible:outline-forest ${index === 0 ? "font-bold text-red-brand" : "text-ink-muted"}`}>{item.label}</Link>)}</div></nav>
    </header>
  );
}

function isPublicEmail(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function socialMark(label: string) {
  const platform = label.trim().toLowerCase();
  if (platform === "facebook") return "f";
  if (platform === "youtube") return "▶";
  if (platform === "linkedin") return "in";
  if (platform === "instagram") return "◎";
  if (platform === "x" || platform === "twitter") return "𝕏";
  return "↗";
}

const coreSocialPlatforms = [
  { label: "Facebook", key: "facebook" },
  { label: "YouTube", key: "youtube" },
  { label: "Instagram", key: "instagram" },
  { label: "LinkedIn", key: "linkedin" },
] as const;

export async function SiteFooter() {
  const settings = await getFooterSettings();
  const safePhone = settings.officePhone.replace(/[^+\d]/g, "");
  const email = isPublicEmail(settings.contactRecipientEmail) ? settings.contactRecipientEmail : "";
  const companyLinks = settings.companyLinks.filter((item) => item.enabled);
  const socialLinks = settings.socialLinks.filter((item) => item.enabled);
  const coreSocialKeys = new Set<string>(coreSocialPlatforms.map(({ key }) => key));
  const extraSocialLinks = socialLinks.filter((item) => !coreSocialKeys.has(item.label.trim().toLowerCase()));
  return (
    <footer className="mt-12 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div><Link href="/" aria-label="দৈনিক আজকের দিগন্ত — প্রচ্ছদ" className="inline-flex items-center"><Image src="/assets/dainik-ajker-diganta-logo.png" alt="" aria-hidden="true" width={320} height={107} className="h-9 w-auto object-contain" /></Link><p className="mt-2 text-sm leading-7 text-ink-muted">সত্য · সময় · সমাজ</p><p className="mt-1 text-xs text-ink-muted">বাংলাদেশের সংবাদ, বাংলায়।</p>
          {settings.officeAddress && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink-muted">{settings.officeAddress}</p>}
          {(safePhone || email) && <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-muted">{safePhone && <a href={`tel:${safePhone}`} className="hover:text-forest">ফোন: {settings.officePhone}</a>}{email && <a href={`mailto:${encodeURIComponent(email)}`} className="hover:text-forest">ইমেইল: {email}</a>}</div>}
          {companyLinks.length > 0 && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-forest" aria-label="প্রতিষ্ঠান ও অংশীদার">{companyLinks.map((item) => <a key={`${item.label}-${item.href}`} href={item.href} rel="noopener noreferrer" target="_blank" className="underline">{item.label}</a>)}</div>}
          {(settings.googlePlayUrl || settings.appStoreUrl) && <section className="mt-4" aria-labelledby="footer-apps-heading"><h2 id="footer-apps-heading" className="text-sm font-bold text-ink">মোবাইল অ্যাপ ডাউনলোড</h2><div className="mt-2 flex flex-wrap gap-3 text-xs text-forest">{settings.googlePlayUrl && <a href={settings.googlePlayUrl} rel="noopener noreferrer" target="_blank" className="underline">Google Play</a>}{settings.appStoreUrl && <a href={settings.appStoreUrl} rel="noopener noreferrer" target="_blank" className="underline">Apple App Store</a>}</div></section>}
        </div>
        <div><h2 className="text-sm font-bold text-ink">পাঠক সেবা</h2><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted"><Link href="/latest" className="hover:text-forest">সর্বশেষ সংবাদ</Link><Link href="/video" className="hover:text-forest">ভিডিও</Link><Link href="/search" className="hover:text-forest">সংবাদ খুঁজুন</Link><Link href="/dashboard" className="hover:text-forest">আমার ড্যাশবোর্ড</Link><Link href="/notifications" className="hover:text-forest">বিজ্ঞপ্তি</Link><Link href="/subscribe" className="hover:text-forest">সাবস্ক্রিপশন</Link><Link href="/contact" className="hover:text-forest">যোগাযোগ</Link><Link href="/newsletter" className="hover:text-forest">নিউজলেটার</Link><Link href="/advertising" className="hover:text-forest">বিজ্ঞাপন</Link></div></div>
        <div><h2 className="text-sm font-bold text-ink">নীতিমালা</h2><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted"><Link href="/about" className="hover:text-forest">আমাদের কথা</Link><Link href="/privacy" className="hover:text-forest">গোপনীয়তা</Link><Link href="/terms" className="hover:text-forest">ব্যবহারের শর্ত</Link><Link href="/login" className="hover:text-forest">পাঠক লগইন</Link></div></div>
      </div>
      <section className="mx-auto max-w-7xl px-4 pb-8 text-center sm:px-6 lg:px-8" aria-labelledby="footer-follow-heading">
        <h2 id="footer-follow-heading" className="text-sm font-bold text-ink">অনুসরণ করুন</h2>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3" aria-label="সামাজিক মাধ্যমের profile">
          {coreSocialPlatforms.map((platform) => {
            const links = socialLinks.filter((item) => item.label.trim().toLowerCase() === platform.key);
            return links.length ? links.map((item) => <a key={`${item.label}-${item.href}`} href={item.href} rel="noopener noreferrer" target="_blank" aria-label={`${platform.label} profile — নতুন ট্যাবে খুলবে`} title={platform.label} className="grid size-10 place-items-center rounded-full bg-forest text-sm font-bold text-white transition hover:bg-red-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"><span aria-hidden="true">{socialMark(platform.label)}</span></a>) : <span key={platform.key} role="img" aria-label={`${platform.label} profile URL এখনো যোগ করা হয়নি`} title={platform.label} className="grid size-10 place-items-center rounded-full bg-paper-100 text-sm font-bold text-ink-muted">{socialMark(platform.label)}</span>;
          })}
          {extraSocialLinks.map((item) => <a key={`${item.label}-${item.href}`} href={item.href} rel="noopener noreferrer" target="_blank" aria-label={`${item.label} profile — নতুন ট্যাবে খুলবে`} title={item.label} className="grid size-10 place-items-center rounded-full bg-forest text-sm font-bold text-white transition hover:bg-red-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"><span aria-hidden="true">{socialMark(item.label)}</span></a>)}
        </div>
        {(settings.publisherName || settings.editorName) && <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs leading-6 text-ink-muted">{settings.publisherName && <span>প্রকাশক: {settings.publisherName}</span>}{settings.editorName && <span>সম্পাদক / Editor: {settings.editorName}</span>}</p>}
      </section>
      <div className="border-t border-line"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><span>© {new Date().getFullYear()} দৈনিক আজকের দিগন্ত</span><span>তারিখ ও সময়: বাংলাদেশ স্ট্যান্ডার্ড টাইম</span><a href="https://cyberpointsecurity.com" className="font-semibold hover:text-forest">Developed by cyberpointsecurity</a></div></div>
    </footer>
  );
}
