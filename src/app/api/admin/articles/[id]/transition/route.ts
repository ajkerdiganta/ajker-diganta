import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { transitionSchema } from "@/lib/cms-schemas";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { setArticleStatus, setArticleFlag } from "@/lib/article-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await allowCmsMutation(principal.id, "article-transition", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  const { id } = await context.params;
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয় বা অত্যন্ত বড়", 400);
  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const value = parsed.data;
    if (value.action === "breaking" || value.action === "featured" || value.action === "trending") {
      const article = await setArticleFlag(id, value.action, value.enabled, value.until, principal);
      return NextResponse.json({ article: { id: article.id, status: article.status, isBreaking: article.isBreaking, isFeatured: article.isFeatured, isTrending: article.isTrending } }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const article = await setArticleStatus(id, value.action, principal, {
      ...(value.action === "reject" ? { reason: value.reason } : {}),
      ...(value.action === "schedule" ? { scheduledAt: value.scheduledAt } : {}),
    });
    return NextResponse.json({ article: { id: article.id, slug: article.slug, status: article.status, publishedAt: article.publishedAt, scheduledAt: article.scheduledAt } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
