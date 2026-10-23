import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError } from "@/lib/cms-api";
import { recordUserVideoRead } from "@/lib/personalization";
import { recordPublicVideoView } from "@/lib/public-videos";

export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return jsonError("ভিডিও পাওয়া যায়নি", 404);
  try {
    const counted = await recordPublicVideoView(slug, request.headers.get("x-real-ip")?.trim() ?? null);
    if (counted) {
      try {
        const principal = await getPrincipal(request.headers);
        if (principal) await recordUserVideoRead(principal.id, slug);
      } catch {
        // Viewer history is optional; it must not disrupt public playback/view metrics.
      }
    }
    return NextResponse.json({ counted }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("ভিডিও ভিউ গণনা সাময়িকভাবে উপলভ্য নয়", 503);
  }
}
