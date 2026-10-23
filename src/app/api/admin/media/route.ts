import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { jsonError } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const canReadAll = await hasPermission(principal.id, "media.read") || await hasPermission(principal.id, "media.manage");
  const canReadOwn = await hasPermission(principal.id, "media.read.own");
  if (!canReadAll && !canReadOwn) return jsonError("মিডিয়া লাইব্রেরি দেখার অনুমতি নেই", 403);
  const query = new URL(request.url).searchParams;
  const cursor = query.get("cursor");
  try {
    const media = await prisma.media.findMany({
      where: {
        deletedAt: null,
        status: "VERIFIED",
        ...(canReadAll ? {} : { uploadedById: principal.id }),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, width: true, height: true, altText: true, caption: true, credit: true, createdAt: true },
    });
    return NextResponse.json({ media: media.map((item) => ({ ...item, sizeBytes: Number(item.sizeBytes), url: `/api/media/${item.id}` })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
