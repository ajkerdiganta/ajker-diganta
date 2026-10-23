import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { paymentDecisionSchema } from "@/lib/subscription-schemas";
import { verifyManualPayment } from "@/lib/subscription-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "payments.manage"))) return jsonError("পেমেন্ট যাচাইয়ের অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "payment-verify", 30))) return jsonError("খুব দ্রুত পরিবর্তন করা হচ্ছে", 429);
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("পেমেন্ট অনুরোধ পাওয়া যায়নি", 404);
  const parsed = paymentDecisionSchema.safeParse(await parseJson(request));
  if (!parsed.success) return jsonError("সিদ্ধান্তের তথ্য সঠিক নয়", 400);
  try {
    const result = await verifyManualPayment(id, principal.id, parsed.data.action === "approve");
    if (result.kind === "not-found") return jsonError("পেমেন্ট অনুরোধ পাওয়া যায়নি", 404);
    if (result.kind === "already-processed") return jsonError("এই অনুরোধ ইতোমধ্যে নিষ্পত্তি হয়েছে", 409);
    if (result.kind === "expired") return jsonError("১৫ মিনিটের সময়সীমা পেরিয়ে গেছে; অনুরোধ মেয়াদোত্তীর্ণ", 409);
    if (result.kind === "active-exists") return jsonError("ব্যবহারকারীর সক্রিয় প্ল্যান আছে; আগে বিদ্যমান মেয়াদ যাচাই করুন", 409);
    return NextResponse.json({ result: result.kind, payment: result.payment, subscription: result.subscription }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return jsonError("পেমেন্ট যাচাই সম্পন্ন হয়নি", 503); }
}
