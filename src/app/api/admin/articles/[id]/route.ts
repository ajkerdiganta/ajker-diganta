import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { articleInputSchema } from "@/lib/cms-schemas";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { getArticleForActor, updateArticle } from "@/lib/article-service";
import { auditCms } from "@/lib/cms-audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const canRead = await hasPermission(principal.id, "article.read.any") || await hasPermission(principal.id, "article.read.own");
  if (!canRead) return jsonError("সংবাদ দেখার অনুমতি নেই", 403);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("সংবাদ পাওয়া যায়নি", 404);
  try {
    const article = await getArticleForActor(id, principal);
    if (!article) return jsonError("সংবাদ পাওয়া যায়নি", 404);
    const serializable = article ? JSON.parse(JSON.stringify(article, (_key, value: unknown) => typeof value === "bigint" ? Number(value) : value)) : null;
    return NextResponse.json({ article: serializable }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "article-update", 60))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const { id } = await context.params;
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা অত্যন্ত বড়", 400);
  const parsed = articleInputSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  if (!parsed.data.expectedRevisionNumber) return jsonError("সম্পাদনার সংস্করণ নম্বর প্রয়োজন", 400);
  const { expectedRevisionNumber, ...input } = parsed.data;
  try {
    const article = await updateArticle(id, input, principal, expectedRevisionNumber);
    return NextResponse.json({ article: { id: article.id, slug: article.slug, status: article.status, revisionNumber: article.revisionNumber } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "article-delete", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const { id } = await context.params;
  const article = await prisma.article.findFirst({ where: { id, deletedAt: null } });
  if (!article) return jsonError("সংবাদ পাওয়া যায়নি", 404);
  const canDeleteAny = await hasPermission(principal.id, "article.delete.any");
  const canDeleteOwnDraft = await hasPermission(principal.id, "article.delete.own") && article.createdById === principal.id && article.status === "DRAFT";
  if (!canDeleteAny && !canDeleteOwnDraft) return jsonError("এই সংবাদ অপসারণের অনুমতি নেই", 403);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.article.update({ where: { id }, data: { deletedAt: new Date(), updatedById: principal.id } });
      await auditCms(tx, { actorId: principal.id, action: "article.delete", resourceType: "Article", resourceId: id, metadata: { priorStatus: article.status } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
