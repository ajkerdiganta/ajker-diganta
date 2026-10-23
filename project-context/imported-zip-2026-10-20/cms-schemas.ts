import { z } from "zod";

const uuidList = z.array(z.uuid()).max(30).default([]);
const slugInput = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional();
const httpsUrl = z.url().max(2048).refine((value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "HTTPS URL প্রয়োজন");

export const articleInputSchema = z.object({
  expectedRevisionNumber: z.number().int().positive().max(1_000_000).optional(),
  title: z.string().trim().min(5).max(240),
  subtitle: z.string().trim().max(300).nullable().optional(),
  excerpt: z.string().trim().max(600).nullable().optional(),
  body: z.unknown(),
  slug: slugInput,
  categoryIds: uuidList,
  primaryCategoryId: z.uuid().nullable().optional(),
  authorIds: uuidList,
  primaryAuthorId: z.uuid().nullable().optional(),
  tagIds: uuidList,
  featuredImageId: z.uuid().nullable().optional(),
  relatedArticleIds: uuidList,
  relatedVideos: z.array(z.object({ title: z.string().trim().min(1).max(240), url: httpsUrl }).strict()).max(10).default([]),
  seoTitle: z.string().trim().max(120).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  canonicalUrl: httpsUrl.nullable().optional(),
  changeNote: z.string().trim().max(300).nullable().optional(),
}).strict();

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugInput,
  description: z.string().trim().max(500).nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().trim().max(120).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
}).strict();

export const navigationItemSchema = z.object({
  menuId: z.uuid(),
  parentId: z.uuid().nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  label: z.string().trim().min(2).max(100),
  href: z.string().trim().min(1).max(2048).regex(/^(?:\/|https:\/\/)/, "অভ্যন্তরীণ লিংক / দিয়ে শুরু হতে হবে অথবা HTTPS URL হতে হবে"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
}).strict();

export const tagSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugInput,
}).strict();

export const authorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugInput,
  title: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1600).nullable().optional(),
  email: z.email().max(254).nullable().optional(),
  isActive: z.boolean().default(true),
}).strict();

export const transitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }).strict(),
  z.object({ action: z.literal("resubmit") }).strict(),
  z.object({ action: z.literal("review") }).strict(),
  z.object({ action: z.literal("approve") }).strict(),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(8).max(1000) }).strict(),
  z.object({ action: z.literal("schedule"), scheduledAt: z.iso.datetime({ offset: true }) }).strict(),
  z.object({ action: z.literal("cancel-schedule") }).strict(),
  z.object({ action: z.literal("publish") }).strict(),
  z.object({ action: z.literal("archive") }).strict(),
  z.object({ action: z.literal("breaking"), enabled: z.boolean(), until: z.iso.datetime({ offset: true }).optional() }).strict(),
  z.object({ action: z.literal("featured"), enabled: z.boolean(), until: z.iso.datetime({ offset: true }).optional() }).strict(),
  z.object({ action: z.literal("trending"), enabled: z.boolean(), until: z.iso.datetime({ offset: true }).optional() }).strict(),
]);

export type ArticleInput = z.infer<typeof articleInputSchema>;
