import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { jsonError } from "@/lib/cms-api";
import { articleCardSelect } from "@/lib/public-news";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription-service";

export const runtime = "nodejs";
const publicArticleWhere = { status: "PUBLISHED" as const, publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null };
type Context = { params: Promise<{ collection: string }> };
export async function GET(request: Request, context: Context) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const { collection } = await context.params;
  if (collection !== "saved" && collection !== "favourite") return jsonError("তালিকা পাওয়া যায়নি", 404);
  if (!(await hasActiveSubscription(principal.id))) return NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", message: "সংবাদ সংরক্ষণ ও পছন্দের তালিকার জন্য সক্রিয় সদস্যতা প্রয়োজন" }, { status: 402, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(30, Number.parseInt(searchParams.get("pageSize") ?? "30", 10) || 30));
  const where = { userId: principal.id, article: publicArticleWhere };
  const [items, total] = collection === "saved"
    ? await Promise.all([
      prisma.savedArticle.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { createdAt: true, article: { select: articleCardSelect } } }),
      prisma.savedArticle.count({ where }),
    ])
    : await Promise.all([
      prisma.favouriteArticle.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { createdAt: true, article: { select: articleCardSelect } } }),
      prisma.favouriteArticle.count({ where }),
    ]);
  return NextResponse.json({ items, page, total, pageSize }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
