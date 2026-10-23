import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError } from "@/lib/cms-api";
import { recordUserArticleRead } from "@/lib/personalization";
import { recordPublicArticleView } from "@/lib/public-views";

export const runtime = "nodejs";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return jsonError("সংবাদ পাওয়া যায়নি", 404);
  try {
    const rawIp = request.headers.get("x-real-ip")?.trim() ?? null;
    const counted = await recordPublicArticleView(slug, rawIp);
    try {
      const principal = await getPrincipal(request.headers);
      if (principal) await recordUserArticleRead(principal.id, slug);
    } catch {
      // History is an optional personalization feature; it must not break public view tracking.
    }
    return NextResponse.json({ counted }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("ভিউ গণনা সাময়িকভাবে উপলভ্য নয়", 503);
  }
}
