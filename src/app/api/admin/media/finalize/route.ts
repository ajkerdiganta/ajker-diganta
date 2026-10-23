import sharp from "sharp";
import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { auditCms } from "@/lib/cms-audit";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { checksum, CmsServiceError } from "@/lib/article-service";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { env } from "@/lib/env";
import { mediaStore, MediaStorageUnavailable } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({ mediaId: z.uuid() }).strict();
const MAX_IMAGE_EDGE = 1920;
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "media.upload"))) return jsonError("ছবি যাচাইয়ের অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "media-upload-finalize", 10, 3_600_000))) return jsonError("ছবি যাচাইয়ের সীমা অতিক্রম হয়েছে", 429);
  const raw = await parseJson(request); if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = schema.safeParse(raw); if (!parsed.success) return jsonError("মিডিয়া আইডি সঠিক নয়", 400);
  const media = await prisma.media.findFirst({ where: { id: parsed.data.mediaId, deletedAt: null } });
  if (!media) return jsonError("ছবি পাওয়া যায়নি", 404);
  const canManage = await hasPermission(principal.id, "media.manage");
  if (!canManage && media.uploadedById !== principal.id) return jsonError("এই ছবির মালিকানা নেই", 404);
  if (media.status === "VERIFIED") return NextResponse.json({ media: { id: media.id, status: media.status, url: `/api/media/${media.id}`, width: media.width, height: media.height } }, { headers: { "Cache-Control": "private, no-store" } });
  if (media.status !== "QUARANTINED") return jsonError("ছবিটি নিরাপদ আপলোড ধাপ সম্পন্ন করেনি", 409);
  try {
    const head = await mediaStore.head(media.objectKey);
    if (!head || head.size <= 0 || head.size > env.MEDIA_MAX_BYTES || head.size !== Number(media.sizeBytes)) return jsonError("ছবি খুঁজে পাওয়া যায়নি বা আকার সঠিক নয়", 400);
    const bytes = await mediaStore.read(media.objectKey);
    if (bytes.byteLength !== head.size) return jsonError("ছবির আকার যাচাই ব্যর্থ হয়েছে", 400);
    const input = sharp(Buffer.from(bytes), { limitInputPixels: 50_000_000, failOn: "error", animated: false });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) return jsonError("শুধু বৈধ PNG, JPEG বা WebP ছবি গ্রহণযোগ্য", 400);
    const { data: output, info: outputInfo } = await input.rotate().resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (!output.byteLength || output.byteLength > env.MEDIA_MAX_BYTES) return jsonError("রূপান্তরের পর ছবির আকার সীমা ছাড়িয়েছে", 400);
    const finalKey = `verified/${new Date().getUTCFullYear()}/${new Date().getUTCMonth() + 1}/${media.id}.webp`;
    await mediaStore.putVerified(finalKey, output);
    try {
      const verified = await prisma.$transaction(async (tx) => {
        const row = await tx.media.update({ where: { id: media.id, uploadedById: media.uploadedById }, data: {
          objectKey: finalKey, mimeType: "image/webp", sizeBytes: BigInt(output.byteLength), checksum: checksum(output),
          width: outputInfo.width, height: outputInfo.height, status: "VERIFIED", visibility: "PUBLIC",
        } });
        await auditCms(tx, { actorId: principal.id, action: "media.finalize", resourceType: "Media", resourceId: row.id, metadata: { sizeBytes: output.byteLength, format: "webp" } });
        return row;
      });
      await mediaStore.remove(media.objectKey).catch(() => undefined);
      return NextResponse.json({ media: { id: verified.id, status: verified.status, url: `/api/media/${verified.id}`, width: verified.width, height: verified.height } }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      await mediaStore.remove(finalKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof MediaStorageUnavailable) return jsonError("মিডিয়া স্টোরেজ কনফিগার করা হয়নি", 503);
    if (error instanceof CmsServiceError) return jsonError(error.message, error.status);
    return jsonError("ছবি যাচাই বা নিরাপদ রূপান্তর করা যায়নি", 400);
  }
}
