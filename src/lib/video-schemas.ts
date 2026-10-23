import { z } from "zod";

const uuidList = z.array(z.uuid()).max(50).default([]);
const slugInput = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional();

export const videoInputSchema = z.object({
  title: z.string().trim().min(3).max(240),
  slug: slugInput,
  description: z.string().trim().min(5).max(5000),
  provider: z.literal("YOUTUBE").default("YOUTUBE"),
  videoUrl: z.url().max(2048),
  thumbnailUrl: z.url().max(2048).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  categoryId: z.uuid(),
  tagIds: uuidList,
  authorId: z.uuid(),
  relatedArticleIds: uuidList,
  seoTitle: z.string().trim().max(120).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
}).strict();

export const videoTransitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }).strict(),
  z.object({ action: z.literal("resubmit") }).strict(),
  z.object({ action: z.literal("review") }).strict(),
  z.object({ action: z.literal("approve") }).strict(),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(8).max(1000) }).strict(),
  z.object({ action: z.literal("publish") }).strict(),
  z.object({ action: z.literal("archive") }).strict(),
]);

export type VideoInput = z.infer<typeof videoInputSchema>;
export type VideoTransitionInput = z.infer<typeof videoTransitionSchema>;
