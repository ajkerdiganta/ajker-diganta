import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { subscriptionPackageSchema } from "@/lib/subscription-schemas";
import { getAdminSubscriptionCatalog, upsertSubscriptionPackage } from "@/lib/subscription-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "payments.read"))) return jsonError("পেমেন্ট তথ্য দেখার অনুমতি নেই", 403);
  return NextResponse.json(await getAdminSubscriptionCatalog(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "payments.manage"))) return jsonError("সাবস্ক্রিপশন প্যাকেজ পরিচালনার অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "subscription-package-update", 30))) return jsonError("খুব দ্রুত পরিবর্তন করা হচ্ছে", 429);
  const parsed = subscriptionPackageSchema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ error: "প্যাকেজের তথ্য সঠিক নয়", issues: parsed.error.issues }, { status: 400 });
  try {
    const subscriptionPackage = await upsertSubscriptionPackage(parsed.data, principal.id);
    return NextResponse.json({ subscriptionPackage }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return jsonError("এই package code আগে থেকেই আছে", 409);
    return jsonError("প্যাকেজ সংরক্ষণ করা যায়নি", 503);
  }
}
