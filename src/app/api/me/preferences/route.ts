import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { updateUserPreferences } from "@/lib/personalization";

export const runtime = "nodejs";
const preferencesSchema = z.object({
  fontScale: z.enum(["comfortable", "large"]).optional(),
  lowBandwidthMode: z.boolean().optional(),
  readingHistoryEnabled: z.boolean().optional(),
  inAppBreakingEnabled: z.boolean().optional(), emailBreakingEnabled: z.boolean().optional(),
  inAppTopicEnabled: z.boolean().optional(), emailTopicEnabled: z.boolean().optional(),
  inAppVideoEnabled: z.boolean().optional(), emailVideoEnabled: z.boolean().optional(),
  inAppSystemEnabled: z.boolean().optional(), emailSystemEnabled: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "অন্তত একটি পছন্দ দিন");
export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const { prisma } = await import("@/lib/prisma");
  const preferences = await prisma.userPreference.upsert({ where: { userId: principal.id }, create: { userId: principal.id }, update: {}, select: { fontScale: true, lowBandwidthMode: true, readingHistoryEnabled: true, inAppBreakingEnabled: true, emailBreakingEnabled: true, inAppTopicEnabled: true, emailTopicEnabled: true, inAppVideoEnabled: true, emailVideoEnabled: true, inAppSystemEnabled: true, emailSystemEnabled: true } });
  return NextResponse.json(preferences, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export async function PATCH(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const body = await parseJson(request);
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return jsonError("পছন্দের তথ্য সঠিক নয়", 400);
  try {
    const preferences = await updateUserPreferences(principal.id, parsed.data);
    return NextResponse.json({ preferences }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError("পছন্দ সংরক্ষণ করা যায়নি", 503);
  }
}
