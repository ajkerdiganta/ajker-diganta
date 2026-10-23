import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { env } from "@/lib/env";
import { mediaStore, MediaStorageUnavailable, quarantineKey } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(env.MEDIA_MAX_BYTES),
  altText: z.string().trim().max(250).optional(),
  caption: z.string().trim().max(500).optional(),
  credit: z.string().trim().max(160).optional(),
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "media.upload"))) return jsonError("ছবি আপলোডের অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "media-upload-intent", 8, 3_600_000))) return jsonError("এক ঘণ্টায় ছবি আপলোডের সীমা অতিক্রম হয়েছে", 429);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা অত্যন্ত বড়", 400);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "ছবির তথ্য যাচাই করা যায়নি", details: parsed.error.issues }, { status: 400 });
  const originalName = parsed.data.filename.replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop()?.slice(0, 180) || "news-image";
  const mediaId = randomUUID();
  const objectKey = quarantineKey(principal.id, parsed.data.contentType);
  try {
    const bucket = mediaStore.bucketName();
    await prisma.media.create({ data: {
      id: mediaId, bucket, objectKey, originalName, mimeType: parsed.data.contentType,
      sizeBytes: BigInt(parsed.data.size), altText: parsed.data.altText ?? null, caption: parsed.data.caption ?? null,
      credit: parsed.data.credit ?? null, status: "UPLOADING", visibility: "PRIVATE", uploadedById: principal.id,
    } });
    return NextResponse.json({ mediaId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MediaStorageUnavailable) return jsonError("নিরাপদ ছবি সংরক্ষণ ব্যবস্থা কনফিগার করা হয়নি", 503);
    return jsonError("ছবি আপলোড শুরু করা যায়নি", 503);
  }
}
