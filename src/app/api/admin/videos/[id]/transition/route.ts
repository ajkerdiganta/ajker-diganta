import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { videoTransitionSchema } from "@/lib/video-schemas";
import { transitionVideo } from "@/lib/video-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "video-transition", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("ভিডিও পাওয়া যায়নি", 404);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা অত্যন্ত বড়", 400);
  const parsed = videoTransitionSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const { action, ...details } = parsed.data;
    const video = await transitionVideo(id, action, principal, "reason" in details ? details.reason : undefined);
    return NextResponse.json({ video: { id: video.id, slug: video.slug, status: video.status, revisionNumber: video.revisionNumber, publishedAt: video.publishedAt } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
