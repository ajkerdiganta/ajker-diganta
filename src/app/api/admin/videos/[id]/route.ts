import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { videoInputSchema } from "@/lib/video-schemas";
import { deleteVideo, getAdminVideo, updateVideo } from "@/lib/video-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const updateSchema = videoInputSchema.extend({ expectedRevisionNumber: z.number().int().positive().max(1_000_000) });

export async function GET(request: Request, context: Context) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("ভিডিও পাওয়া যায়নি", 404);
  try {
    const video = await getAdminVideo(principal, id);
    return NextResponse.json({ video }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "video-update", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("ভিডিও পাওয়া যায়নি", 404);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা অত্যন্ত বড়", 400);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const video = await updateVideo(id, parsed.data, principal);
    return NextResponse.json({ video: { id: video.id, slug: video.slug, status: video.status, revisionNumber: video.revisionNumber } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "video-delete", 20))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("ভিডিও পাওয়া যায়নি", 404);
  try {
    return NextResponse.json(await deleteVideo(id, principal), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
