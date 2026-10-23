import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError } from "@/lib/cms-api";
import { articleCardSelect } from "@/lib/public-news";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const publicArticleWhere = { status: "PUBLISHED" as const, publishedAt: { not: null }, publishedRevisionNumber: { not: null }, deletedAt: null };
export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(30, Number.parseInt(searchParams.get("pageSize") ?? "30", 10) || 30));
  const where = { userId: principal.id, article: publicArticleWhere };
  const [items, total] = await Promise.all([
    prisma.readingHistory.findMany({ where, orderBy: { lastReadAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { lastReadAt: true, readCount: true, article: { select: articleCardSelect } } }),
    prisma.readingHistory.count({ where }),
  ]);
  return NextResponse.json({ items, page, total, pageSize }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export async function DELETE(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const result = await prisma.readingHistory.deleteMany({ where: { userId: principal.id } });
  return NextResponse.json({ cleared: result.count }, { headers: { "Cache-Control": "private, no-store" } });
}
