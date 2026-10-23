import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { jsonError } from "@/lib/cms-api";
import { MediaStorageUnavailable, mediaStore } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("ছবি পাওয়া যায়নি", 404);
  const media = await prisma.media.findFirst({ where: { id, status: "VERIFIED", deletedAt: null } });
  if (!media) return jsonError("ছবি পাওয়া যায়নি", 404);
  if (media.visibility !== "PUBLIC") {
    const principal = await getPrincipal(request.headers);
    if (!principal) return jsonError("লগইন প্রয়োজন", 401);
    const canRead = media.uploadedById === principal.id || await hasPermission(principal.id, "media.read");
    if (!canRead) return jsonError("ছবি পাওয়া যায়নি", 404);
  }
  try {
    const publicUrl = media.visibility === "PUBLIC" ? mediaStore.publicUrl(media.objectKey) : null;
    const url = publicUrl ?? await mediaStore.readUrl(media.objectKey);
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Cache-Control", media.visibility === "PUBLIC" && publicUrl ? "public, max-age=31536000, immutable" : "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  } catch (error) {
    if (error instanceof MediaStorageUnavailable) return jsonError("মিডিয়া স্টোরেজ কনফিগার করা হয়নি", 503);
    return jsonError("ছবি লোড করা যায়নি", 502);
  }
}
