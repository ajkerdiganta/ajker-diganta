import { z } from "zod";
import { SITE_PAGE_SLUGS } from "@/lib/site-content-defaults";

const httpsUrl = z.url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "নিরাপদ HTTPS URL দিন");

const linkSchema = z.object({ label: z.string().normalize().trim().min(1).max(80), href: httpsUrl }).strict();
const enabledLinkSchema = linkSchema.extend({ enabled: z.boolean().default(true) }).strict();

export const sitePageSchema = z.object({
  slug: z.enum(SITE_PAGE_SLUGS),
  title: z.string().normalize().trim().min(2).max(180),
  body: z.string().trim().min(10).max(50_000),
  metaTitle: z.string().normalize().trim().max(120).optional(),
  metaDescription: z.string().normalize().trim().max(170).optional(),
}).strict();

export const siteSettingsSchema = z.object({
  officeAddress: z.string().trim().max(1000).nullable().optional(),
  officePhone: z.string().trim().max(40).nullable().optional(),
  contactRecipientEmail: z.email().max(254).nullable().optional(),
  publisherName: z.string().normalize().trim().max(180).nullable().optional(),
  editorName: z.string().normalize().trim().max(180).nullable().optional(),
  companyLinks: z.array(enabledLinkSchema).max(20).optional(),
  socialLinks: z.array(enabledLinkSchema).max(20).optional(),
  googlePlayUrl: httpsUrl.nullable().optional(),
  appStoreUrl: httpsUrl.nullable().optional(),
}).strict();

const messageText = z.string().trim().min(5).max(10_000);
const phoneText = z.string().trim().min(5).max(40).regex(/^[+\d() .-]+$/, "সঠিক ফোন নম্বর দিন");
const honeypot = z.string().max(0).optional();

export const contactSubmissionSchema = z.object({
  type: z.literal("CONTACT"),
  name: z.string().normalize().trim().min(2).max(120),
  email: z.email().max(254),
  subject: z.string().normalize().trim().min(2).max(180),
  message: messageText,
  phone: phoneText.optional(),
  website: honeypot,
}).strict();

const footerSubmissionBase = z.object({
  name: z.string().normalize().trim().min(2).max(120).optional(),
  email: z.email().max(254),
  phone: phoneText,
  subject: z.string().normalize().trim().max(180).optional(),
  message: messageText,
  website: honeypot,
});

export const footerSubmissionSchema = z.discriminatedUnion("type", [
  footerSubmissionBase.extend({ type: z.literal("ADVERTISEMENT") }).strict(),
  footerSubmissionBase.extend({ type: z.literal("NEWSLETTER"), consent: z.literal(true) }).strict(),
]);

export const publicSubmissionSchema = z.discriminatedUnion("type", [contactSubmissionSchema, footerSubmissionSchema]);
export type SitePageInput = z.infer<typeof sitePageSchema>;
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type PublicSubmissionInput = z.infer<typeof publicSubmissionSchema>;
