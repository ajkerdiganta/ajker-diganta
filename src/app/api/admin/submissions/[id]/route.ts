import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { auditCms } from "@/lib/cms-audit";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const actionSchema = z.object({ kind: z.enum(["contact", "footer"]), action: z.enum(["resolve", "reopen"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "submissions.manage"))) return jsonError("অনুরোধ নিষ্পত্তির অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "submission-status", 60))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const status = parsed.data.action === "resolve" ? "RESOLVED" : "RECEIVED";
      const resolvedAt = parsed.data.action === "resolve" ? new Date() : null;
      if (parsed.data.kind === "contact") {
        const existing = await tx.contactSubmission.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return null;
        const updated = await tx.contactSubmission.update({ where: { id }, data: { status, resolvedAt, resolvedById: parsed.data.action === "resolve" ? principal.id : null } });
        await auditCms(tx, { actorId: principal.id, action: `contact-submission.${parsed.data.action}`, resourceType: "ContactSubmission", resourceId: id });
        return updated;
      }
      const existing = await tx.footerSubmission.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return null;
      const updated = await tx.footerSubmission.update({ where: { id }, data: { status, resolvedAt, resolvedById: parsed.data.action === "resolve" ? principal.id : null } });
      await auditCms(tx, { actorId: principal.id, action: `footer-submission.${parsed.data.action}`, resourceType: "FooterSubmission", resourceId: id });
      return updated;
    });
    if (!result) return jsonError("অনুরোধটি পাওয়া যায়নি", 404);
    return NextResponse.json({ id: result.id, status: result.status, resolvedAt: result.resolvedAt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
