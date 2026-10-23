import { prisma } from "@/lib/prisma";
import { auditCms } from "@/lib/cms-audit";
import { DEFAULT_SITE_PAGES, DEFAULT_SITE_SETTINGS, SITE_PAGE_SLUGS, type SitePageSlug } from "@/lib/site-content-defaults";
import type { SitePageInput, SiteSettingsInput } from "@/lib/site-content-schemas";

function safeHttps(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function safeLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .filter((item) => typeof item.label === "string" && item.label.trim().length > 0 && item.label.length <= 80 && safeHttps(item.href))
    .map((item) => ({ label: (item.label as string).trim(), href: item.href as string, enabled: item.enabled !== false }));
}

export async function getSitePage(slug: SitePageSlug) {
  const fallback = DEFAULT_SITE_PAGES[slug];
  try {
    const page = await prisma.sitePage.findUnique({ where: { slug } });
    if (!page) return { ...fallback, slug };
    return {
      ...fallback,
      ...page,
      metaTitle: page.metaTitle ?? fallback.metaTitle,
      metaDescription: page.metaDescription ?? fallback.metaDescription,
    };
  } catch {
    return { ...fallback, slug };
  }
}

export async function listSitePages() {
  const existing = await prisma.sitePage.findMany({ where: { slug: { in: [...SITE_PAGE_SLUGS] } } }).catch(() => []);
  const bySlug = new Map(existing.map((page) => [page.slug, page]));
  return SITE_PAGE_SLUGS.map((slug) => {
    const fallback = DEFAULT_SITE_PAGES[slug];
    const page = bySlug.get(slug);
    return page ? { ...fallback, ...page, slug, metaTitle: page.metaTitle ?? fallback.metaTitle, metaDescription: page.metaDescription ?? fallback.metaDescription } : { ...fallback, slug };
  });
}

export async function getSiteSettings() {
  const saved = await prisma.siteSetting.findUnique({ where: { id: "global" } }).catch(() => null);
  return saved ?? DEFAULT_SITE_SETTINGS;
}

export async function getFooterSettings() {
  const saved = await getSiteSettings();
  return {
    publisherName: saved.publisherName ?? "",
    editorName: saved.editorName ?? "",
    officeAddress: saved.officeAddress ?? "",
    officePhone: saved.officePhone ?? "",
    contactRecipientEmail: saved.contactRecipientEmail ?? "",
    companyLinks: safeLinks(saved.companyLinks ?? DEFAULT_SITE_SETTINGS.companyLinks),
    socialLinks: safeLinks(saved.socialLinks),
    googlePlayUrl: safeHttps(saved.googlePlayUrl) ? saved.googlePlayUrl : "",
    appStoreUrl: safeHttps(saved.appStoreUrl) ? saved.appStoreUrl : "",
  };
}

export async function saveSitePage(input: SitePageInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const page = await tx.sitePage.upsert({
      where: { slug: input.slug },
      create: { ...input, updatedById: actorId },
      update: { title: input.title, body: input.body, metaTitle: input.metaTitle, metaDescription: input.metaDescription, updatedById: actorId },
    });
    await auditCms(tx, { actorId, action: "site-page.update", resourceType: "SitePage", resourceId: page.id, metadata: { slug: input.slug } });
    return page;
  });
}

export async function saveSiteSettings(input: SiteSettingsInput, actorId: string) {
  const data = { ...input, updatedById: actorId };
  return prisma.$transaction(async (tx) => {
    const settings = await tx.siteSetting.upsert({
      where: { id: "global" },
      create: { id: "global", ...data },
      update: data,
    });
    await auditCms(tx, { actorId, action: "site-settings.update", resourceType: "SiteSetting", resourceId: settings.id, metadata: { fields: Object.keys(input) } });
    return settings;
  });
}
