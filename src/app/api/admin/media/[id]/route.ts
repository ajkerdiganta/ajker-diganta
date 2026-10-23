import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { auditCms } from "@/lib/cms-audit";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { mediaStore } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ altText: z.string().trim().max(250).nullable().optional(), caption: z.string().trim().max(500).nullable().optional(), credit: z.string().trim().max(160).nullable().optional() }).strict();
async function principalOrResponse(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return { response: jsonError("লগইন প্রয়োজন", 401) } as const;
  if (!(await allowCmsMutation(principal.id, "media-mutation", 30))) return { response: jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429) } as const;
  return { principal } as const;
}
export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const auth = await principalOrResponse(request); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const media = await prisma.media.findFirst({ where: { id, status: "VERIFIED", deletedAt: null } });
  if (!media) return jsonError("ছবি পাওয়া যায়নি", 404);
  const canManage = await hasPermission(auth.principal.id, "media.manage");
  const canEditOwn = await hasPermission(auth.principal.id, "media.update.own") && media.uploadedById === auth.principal.id;
  if (!canManage && !canEditOwn) return jsonError("এই ছবির তথ্য সম্পাদনার অনুমতি নেই", 403);
  const raw = await parseJson(request); if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = schema.safeParse(raw); if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.media.update({ where: { id }, data: parsed.data });
      await auditCms(tx, { actorId: auth.principal.id, action: "media.metadata.update", resourceType: "Media", resourceId: id });
      return row;
    });
    return NextResponse.json({ media: { id: updated.id, altText: updated.altText, caption: updated.caption, credit: updated.credit } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
export async function DELETE(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const auth = await principalOrResponse(request); if ("response" in auth) return auth.response;
  if (!(await hasPermission(auth.principal.id, "media.delete"))) return jsonError("মিডিয়া অপসারণের অনুমতি নেই", 403);
  const { id } = await context.params;
  const media = await prisma.media.findFirst({ where: { id, deletedAt: null } });
  if (!media) return jsonError("ছবি পাওয়া যায়নি", 404);
  if (await prisma.articleMedia.count({ where: { mediaId: id } })) return jsonError("সংবাদে ব্যবহৃত ছবি অপসারণ করা যাবে না", 409);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.media.update({ where: { id }, data: { deletedAt: new Date(), status: "DELETED", visibility: "PRIVATE" } });
      await auditCms(tx, { actorId: auth.principal.id, action: "media.delete", resourceType: "Media", resourceId: id });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await mediaStore.remove(media.objectKey).catch(() => undefined);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
