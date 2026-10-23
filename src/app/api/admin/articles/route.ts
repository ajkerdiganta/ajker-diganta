import { NextResponse } from "next/server";
import { articleInputSchema } from "@/lib/cms-schemas";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { createArticle, listArticles } from "@/lib/article-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const canRead = await hasPermission(principal.id, "article.read.any") || await hasPermission(principal.id, "article.read.own");
  if (!canRead) return jsonError("এই কাজের অনুমতি নেই", 403);
  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? undefined;
  const known = new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);
  if (status && !known.has(status)) return jsonError("সংবাদ অবস্থা সঠিক নয়", 400);
  const pageValue = Number(params.get("page") ?? "1");
  if (!Number.isInteger(pageValue) || pageValue < 1 || pageValue > 1000) return jsonError("পৃষ্ঠা নম্বর সঠিক নয়", 400);
  try {
    const articles = await listArticles(principal, { status: status as never, query: params.get("q") ?? undefined, page: pageValue });
    return NextResponse.json({ articles, page: pageValue, pageSize: 40 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরोधের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "article-create", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  if (!(await hasPermission(principal.id, "article.create"))) return jsonError("খসড়া তৈরির অনুমতি নেই", 403);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা չափազանց বড়", 400);
  const parsed = articleInputSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const article = await createArticle(parsed.data, principal);
    return NextResponse.json({ article: { id: article.id, slug: article.slug, status: article.status, revisionNumber: article.revisionNumber } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
