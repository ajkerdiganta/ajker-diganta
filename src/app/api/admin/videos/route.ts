import { NextResponse } from "next/server";
import { VideoStatus } from "@/generated/prisma/client";
import { getPrincipal } from "@/lib/authorization";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { videoInputSchema } from "@/lib/video-schemas";
import { createVideo, listAdminVideos } from "@/lib/video-service";

export const runtime = "nodejs";
const statuses = new Set(Object.values(VideoStatus));

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const params = new URL(request.url).searchParams;
  const rawStatus = params.get("status") ?? undefined;
  if (rawStatus && !statuses.has(rawStatus as VideoStatus)) return jsonError("ভিডিওর অবস্থা সঠিক নয়", 400);
  const page = Number(params.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > 1000) return jsonError("পৃষ্ঠা নম্বর সঠিক নয়", 400);
  try {
    const result = await listAdminVideos(principal, { status: rawStatus as VideoStatus | undefined, query: params.get("q") ?? undefined, page });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "video-create", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা অত্যন্ত বড়", 400);
  const parsed = videoInputSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const video = await createVideo(parsed.data, principal);
    return NextResponse.json({ video: { id: video.id, slug: video.slug, status: video.status, revisionNumber: video.revisionNumber } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
