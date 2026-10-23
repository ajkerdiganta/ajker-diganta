import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { paymentGatewaySettingsSchema } from "@/lib/subscription-schemas";
import { getAdminPaymentDashboard, updatePaymentGateway } from "@/lib/subscription-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "payments.read"))) return jsonError("পেমেন্ট তথ্য দেখার অনুমতি নেই", 403);
  try { return NextResponse.json(await getAdminPaymentDashboard(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return cmsErrorResponse(error); }
}

export async function PATCH(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "payments.manage"))) return jsonError("পেমেন্ট settings পরিচালনার অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "payment-gateway-settings", 20))) return jsonError("খুব দ্রুত পরিবর্তন করা হচ্ছে", 429);
  const parsed = paymentGatewaySettingsSchema.safeParse(await parseJson(request));
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const gateway = await updatePaymentGateway(parsed.data, principal.id);
    return NextResponse.json({ gateway: { method: gateway.method, displayName: gateway.displayName, accountNumber: gateway.accountNumber, transferType: gateway.transferType, instructions: gateway.instructions, isActive: gateway.isActive } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
