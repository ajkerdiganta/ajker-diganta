import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { setNotificationRead } from "@/lib/notification-service";
import { hasActiveSubscription } from "@/lib/subscription-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasActiveSubscription(principal.id))) return NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", message: "ইনবক্স বিজ্ঞপ্তির জন্য সক্রিয় সদস্যতা প্রয়োজন" }, { status: 402, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("বিজ্ঞপ্তি পাওয়া যায়নি", 404);
  const body = await parseJson(request);
  const parsed = z.object({ read: z.boolean() }).strict().safeParse(body);
  if (!parsed.success) return jsonError("অনুরোধের তথ্য সঠিক নয়", 400);
  const updated = await setNotificationRead(principal.id, id, parsed.data.read);
  if (!updated) return jsonError("বিজ্ঞপ্তি পাওয়া যায়নি", 404);
  return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "private, no-store" } });
}
