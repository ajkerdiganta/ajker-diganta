import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const PAGE_SLUGS = ["about", "privacy", "terms"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export const defaultPages: Record<PageSlug, { title: string; body: string }> = {
  about: { title: "আমাদের কথা", body: "দৈনিক আজকের দিগন্ত একটি বাংলা-প্রথম সংবাদমাধ্যমের ডিজিটাল প্রকাশনা।\nবাংলাদেশ ও বিশ্বের খবর বাংলা ভাষায় সহজে পড়া, নির্ভরযোগ্য তথ্য ও দায়িত্বশীল প্রকাশনা—এই অভিজ্ঞতা গড়ে তোলাই আমাদের লক্ষ্য।" },
  privacy: { title: "গোপনীয়তা", body: "আপনার অ্যাকাউন্ট, যোগাযোগ ও পাঠ-অভিজ্ঞতার তথ্য নিরাপত্তা ও প্রয়োজনীয় সেবা প্রদানের উদ্দেশ্যে ব্যবহার করা হয়।\nপ্রয়োজনীয় আইনগত কারণ ছাড়া ব্যক্তিগত তথ্য বিক্রি বা অপ্রয়োজনীয়ভাবে প্রকাশ করা হয় না।" },
  terms: { title: "ব্যবহারের শর্ত", body: "এই সাইট ব্যবহার করে আপনি দায়িত্বশীলভাবে সংবাদ ও সেবা ব্যবহার করতে সম্মত হন।\nপ্রকাশিত কনটেন্টের পুনঃব্যবহার, মন্তব্য ও যোগাযোগে প্রযোজ্য আইন ও স্বত্বাধিকার সম্মান করতে হবে।" },
};

const settingKey = "global";
export type FooterLink = { label: string; href: string };
export type FooterSocial = FooterLink & { enabled?: boolean };
export const defaultCompanyLinks: FooterLink[] = [
  { label: "TheLens24", href: "https://thelens24.com" },
  { label: "Habigonj24", href: "https://habigonj24.com" },
];
export const defaultSocialLinks: FooterSocial[] = [
  { label: "Facebook", href: "https://facebook.com", enabled: true },
  { label: "X", href: "https://x.com", enabled: true },
  { label: "YouTube", href: "https://youtube.com", enabled: true },
  { label: "LinkedIn", href: "https://linkedin.com", enabled: true },
];
function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Encrypted CMS settings require BETTER_AUTH_SECRET");
  return createHash("sha256").update(secret).digest();
}
export function encryptSetting(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptSetting(value?: string | null) {
  if (!value) return "";
  try { const [iv, tag, encrypted] = value.split("."); const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url")); return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"); } catch { return ""; }
}

export async function getSitePage(slug: PageSlug) {
  const fallback = defaultPages[slug];
  try {
    return await prisma.sitePage.upsert({ where: { slug }, update: {}, create: { slug, title: fallback.title, body: fallback.body } });
  } catch {
    return { id: `preview-${slug}`, slug, title: fallback.title, body: fallback.body, updatedById: null, createdAt: new Date(), updatedAt: new Date() };
  }
}
export async function getSiteSettings() {
  try { return await prisma.siteSetting.upsert({ where: { id: settingKey }, update: {}, create: { id: settingKey } }); }
  catch { return { id: settingKey, officeAddress: null, officePhone: null, contactRecipientEmail: null, emailFrom: null, resendApiKeyEncrypted: null, r2Endpoint: null, r2Bucket: null, r2AccessKeyEncrypted: null, r2SecretEncrypted: null, r2PublicBaseUrl: null, publisherName: null, editorName: null, companyLinks: null, socialLinks: null, googlePlayUrl: null, appStoreUrl: null, updatedById: null, createdAt: new Date(), updatedAt: new Date() }; }
}
export async function getRuntimeSettings() {
  const saved = await getSiteSettings();
  return {
    officeAddress: saved.officeAddress ?? "",
    officePhone: saved.officePhone ?? "",
    contactRecipientEmail: saved.contactRecipientEmail ?? "",
    emailFrom: saved.emailFrom ?? process.env.EMAIL_FROM ?? "",
    resendApiKey: decryptSetting(saved.resendApiKeyEncrypted) || process.env.RESEND_API_KEY || "",
    r2Endpoint: saved.r2Endpoint ?? process.env.R2_ENDPOINT ?? "",
    r2Bucket: saved.r2Bucket ?? process.env.R2_BUCKET ?? "",
    r2AccessKeyId: decryptSetting(saved.r2AccessKeyEncrypted) || process.env.R2_ACCESS_KEY_ID || "",
    r2SecretAccessKey: decryptSetting(saved.r2SecretEncrypted) || process.env.R2_SECRET_ACCESS_KEY || "",
    r2PublicBaseUrl: saved.r2PublicBaseUrl ?? process.env.R2_PUBLIC_BASE_URL ?? "",
  };
}

export async function getFooterSettings() {
  const saved = await getSiteSettings();
  const savedSocials = Array.isArray(saved.socialLinks) ? saved.socialLinks as FooterSocial[] : [];
  const socialLinks = savedSocials.length
    ? [...defaultSocialLinks.map((fallback) => savedSocials.find((item) => item.label.trim().toLowerCase() === fallback.label.toLowerCase()) ?? fallback), ...savedSocials.filter((item) => !defaultSocialLinks.some((fallback) => item.label.trim().toLowerCase() === fallback.label.toLowerCase()))]
    : defaultSocialLinks;
  return {
    publisherName: saved.publisherName ?? "মতিউর রহমান",
    editorName: saved.editorName ?? "মতিউর রহমান",
    companyLinks: Array.isArray(saved.companyLinks) && saved.companyLinks.length ? saved.companyLinks as FooterLink[] : defaultCompanyLinks,
    socialLinks,
    googlePlayUrl: saved.googlePlayUrl ?? "",
    appStoreUrl: saved.appStoreUrl ?? "",
  };
}
