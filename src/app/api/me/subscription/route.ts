import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { paymentSubmissionSchema } from "@/lib/subscription-schemas";
import { getPublicPaymentGateways, getSubscriptionStatus, submitManualPayment } from "@/lib/subscription-service";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  try {
    const [status, gateways] = await Promise.all([getSubscriptionStatus(principal.id), getPublicPaymentGateways()]);
    return NextResponse.json({ ...status, gateways }, { headers: noStore });
  } catch { return jsonError("সাবস্ক্রিপশনের তথ্য এখন পাওয়া যাচ্ছে না", 503); }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("সাবস্ক্রিপশন অনুরোধের জন্য লগইন করুন", 401);
  const raw = await parseJson(request);
  const parsed = paymentSubmissionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ message: "ফর্মের তথ্য সঠিক নয়", issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400, headers: noStore });
  if (!(await allowCmsMutation(principal.id, "subscription-submit", 5))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে; পরে আবার চেষ্টা করুন", 429);
  try {
    const result = await submitManualPayment(principal.id, parsed.data);
    if (result.kind === "created") return NextResponse.json({ payment: result.payment, subscription: result.subscription, message: "অনুরোধ জমা হয়েছে। ১৫ মিনিটের মধ্যে newsroom আপনার লেনদেন যাচাই করবে।" }, { status: 201, headers: noStore });
    if (result.kind === "not-found") return jsonError("অ্যাকাউন্ট পাওয়া যায়নি", 404);
    if (result.kind === "gateway-unavailable") return jsonError("এই পেমেন্ট পদ্ধতি এখন চালু নয়", 409);
    if (result.kind === "already-active") return jsonError("আপনার একটি সক্রিয় সাবস্ক্রিপশন আছে", 409);
    if (result.kind === "pending-exists") return jsonError("আপনার একটি অপেক্ষমাণ পেমেন্ট অনুরোধ আছে", 409);
    return jsonError("এই transaction ID আগে জমা হয়েছে", 409);
  } catch { return jsonError("পেমেন্ট অনুরোধ সংরক্ষণ করা যায়নি", 503); }
}
