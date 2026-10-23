import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError } from "@/lib/cms-api";
import { setArticleCollection } from "@/lib/personalization";
import { hasActiveSubscription } from "@/lib/subscription-service";

export const runtime = "nodejs";
const uuid = z.string().uuid();
type Context = { params: Promise<{ id: string; collection: string }> };

async function mutate(request: Request, context: Context, enabled: boolean) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const { id, collection: rawCollection } = await context.params;
  const articleId = uuid.safeParse(id);
  if (!articleId.success || (rawCollection !== "saved" && rawCollection !== "favourite")) return jsonError("সংবাদ পাওয়া যায়নি", 404);
  if (enabled && !(await hasActiveSubscription(principal.id))) return NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", message: "সংবাদ সংরক্ষণ ও পছন্দের তালিকার জন্য সক্রিয় সদস্যতা প্রয়োজন" }, { status: 402, headers: { "Cache-Control": "private, no-store" } });
  try {
    const ok = await setArticleCollection(principal.id, articleId.data, rawCollection, enabled);
    if (!ok) return jsonError("প্রকাশিত সংবাদ পাওয়া যায়নি", 404);
    return NextResponse.json({ collection: rawCollection, enabled }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError("এই মুহূর্তে পরিবর্তনটি সংরক্ষণ করা যায়নি", 503);
  }
}

export async function PUT(request: Request, context: Context) { return mutate(request, context, true); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, false); }
