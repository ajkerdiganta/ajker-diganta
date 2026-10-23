import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { navigationItemSchema } from "@/lib/cms-schemas";
import { removeNavigationItem, updateNavigationItem } from "@/lib/navigation-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function authorize(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return { error: jsonError("লগইন প্রয়োজন", 401) } as const;
  if (!(await hasPermission(principal.id, "navigation.manage"))) return { error: jsonError("নেভিগেশন পরিচালনার অনুমতি নেই", 403) } as const;
  if (!(await allowCmsMutation(principal.id, "navigation-mutation", 40))) return { error: jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429) } as const;
  return { principal } as const;
}

export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = navigationItemSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const { id } = await context.params;
    const item = await updateNavigationItem(id, parsed.data, auth.principal);
    revalidatePath("/", "layout");
    return NextResponse.json({ item }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    await removeNavigationItem(id, auth.principal);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
