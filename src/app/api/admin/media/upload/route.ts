import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError } from "@/lib/cms-api";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { env } from "@/lib/env";
import { mediaStore, MediaStorageUnavailable } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";
import { readBoundedBytes } from "@/lib/request-json";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "media.upload"))) return jsonError("ছবি আপলোডের অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "media-upload-bytes", 8, 3_600_000))) return jsonError("এক ঘণ্টায় ছবি আপলোডের সীমা অতিক্রম হয়েছে", 429);

  const mediaId = new URL(request.url).searchParams.get("mediaId");
  if (!mediaId || !/^[0-9a-f-]{36}$/iu.test(mediaId)) return jsonError("মিডিয়া আইডি সঠিক নয়", 400);
  const media = await prisma.media.findFirst({ where: { id: mediaId, deletedAt: null } });
  if (!media) return jsonError("ছবি পাওয়া যায়নি", 404);
  const canManage = await hasPermission(principal.id, "media.manage");
  if (!canManage && media.uploadedById !== principal.id) return jsonError("এই ছবির মালিকানা নেই", 404);
  if (media.status !== "UPLOADING") return jsonError("এই আপলোডটি ইতিমধ্যে শুরু হয়েছে বা শেষ হয়েছে", 409);
  if (!["image/jpeg", "image/png", "image/webp"].includes(media.mimeType) || request.headers.get("content-type") !== media.mimeType) {
    return jsonError("ছবির ধরন অনুমোদিত নয়", 415);
  }
  const expectedSize = Number(media.sizeBytes);
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > env.MEDIA_MAX_BYTES) return jsonError("ছবির আকার সীমার বাইরে", 413);
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) !== expectedSize)) return jsonError("ছবির ঘোষিত আকার সঠিক নয়", 400);

  const body = await readBoundedBytes(request, Math.min(env.MEDIA_MAX_BYTES, expectedSize));
  if (!body || body.byteLength !== expectedSize) return jsonError("ছবির আকার সঠিক নয় বা সর্বোচ্চ সীমা অতিক্রম করেছে", 413);

  // Claim the upload intent exactly once before object storage writes, so a leaked ID cannot race uploads.
  const claimed = await prisma.media.updateMany({
    where: { id: media.id, uploadedById: media.uploadedById, status: "UPLOADING", deletedAt: null },
    data: { status: "QUARANTINED" },
  });
  if (claimed.count !== 1) return jsonError("এই আপলোডটি ইতিমধ্যে শুরু হয়েছে বা শেষ হয়েছে", 409);

  try {
    await mediaStore.putQuarantine(media.objectKey, body, media.mimeType);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await prisma.media.updateMany({ where: { id: media.id, status: "QUARANTINED" }, data: { status: "UPLOADING" } }).catch(() => undefined);
    await mediaStore.remove(media.objectKey).catch(() => undefined);
    if (error instanceof MediaStorageUnavailable) return jsonError("নিরাপদ ছবি সংরক্ষণ ব্যবস্থা কনফিগার করা হয়নি", 503);
    return NextResponse.json({ error: "নিরাপদ স্টোরেজে আপলোড ব্যর্থ হয়েছে" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
