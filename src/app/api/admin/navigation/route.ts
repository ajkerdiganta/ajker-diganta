import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { navigationItemSchema } from "@/lib/cms-schemas";
import { createNavigationItem, listNavigationMenus } from "@/lib/navigation-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "navigation.read"))) return jsonError("এই কাজের অনুমতি নেই", 403);
  try {
    return NextResponse.json({ menus: await listNavigationMenus() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "navigation.manage"))) return jsonError("নেভিগেশন পরিচালনার অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "navigation-mutation", 40))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = navigationItemSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const item = await createNavigationItem(parsed.data, principal);
    revalidatePath("/", "layout");
    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
