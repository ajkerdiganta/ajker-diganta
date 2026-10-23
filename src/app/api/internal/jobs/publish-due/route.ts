import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { publishDueArticles } from "@/lib/article-service";
import { cleanupPublicViewDedupKeys } from "@/lib/public-views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = env.JOB_AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "পাবলিশার কনফিগার করা হয়নি" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ error: "অনুমোদিত নয়" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const published = await publishDueArticles();
    const expiredViewKeysDeleted = await cleanupPublicViewDedupKeys();
    return NextResponse.json({ publishedCount: published.length, expiredViewKeysDeleted }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "নির্ধারিত সংবাদ প্রকাশ করা যায়নি" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
