import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError } from "@/lib/cms-api";
import { setCategoryFollow } from "@/lib/personalization";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) { return mutate(request, context, true); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, false); }
async function mutate(request: Request, context: Context, enabled: boolean) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const { id } = await context.params;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return jsonError("বিভাগ পাওয়া যায়নি", 404);
  try {
    if (!(await setCategoryFollow(principal.id, parsed.data, enabled))) return jsonError("সক্রিয় বিভাগ পাওয়া যায়নি", 404);
    return NextResponse.json({ followed: enabled }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError("এই মুহূর্তে পরিবর্তনটি সংরক্ষণ করা যায়নি", 503);
  }
}
