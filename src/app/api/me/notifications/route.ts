import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { getNotificationInbox, markAllNotificationsRead } from "@/lib/notification-service";
import { hasActiveSubscription } from "@/lib/subscription-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasActiveSubscription(principal.id))) return NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", message: "ইনবক্স বিজ্ঞপ্তি দেখতে সক্রিয় সদস্যতা প্রয়োজন" }, { status: 402, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  const params = new URL(request.url).searchParams;
  const rawPage = Number(params.get("page") ?? "1");
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 1000) return jsonError("পৃষ্ঠা নম্বর সঠিক নয়", 400);
  const unread = params.get("unread");
  if (unread !== null && unread !== "true" && unread !== "false") return jsonError("ফিল্টার সঠিক নয়", 400);
  const result = await getNotificationInbox(principal.id, { page: rawPage, unreadOnly: unread === "true" });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function PATCH(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasActiveSubscription(principal.id))) return NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", message: "ইনবক্স বিজ্ঞপ্তির জন্য সক্রিয় সদস্যতা প্রয়োজন" }, { status: 402, headers: { "Cache-Control": "private, no-store" } });
  const body = await parseJson(request);
  const parsed = z.object({ action: z.literal("read-all") }).strict().safeParse(body);
  if (!parsed.success) return jsonError("অনুরোধের তথ্য সঠিক নয়", 400);
  const updated = await markAllNotificationsRead(principal.id);
  return NextResponse.json({ updated }, { headers: { "Cache-Control": "private, no-store" } });
}
