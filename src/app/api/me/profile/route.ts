import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrincipal } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { updateUserProfile } from "@/lib/personalization";

export const runtime = "nodejs";
const profileSchema = z.object({ name: z.string().normalize().trim().min(2).max(80) }).strict();
export async function PATCH(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  const body = await parseJson(request);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return jsonError("নামের তথ্য সঠিক নয়", 400);
  try {
    const user = await updateUserProfile(principal.id, parsed.data.name);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError("প্রোফাইল হালনাগাদ করা যায়নি", 503);
  }
}
