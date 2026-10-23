import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { categorySchema } from "@/lib/cms-schemas";
import { removeCategory, updateCategory } from "@/lib/taxonomy-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function authorized(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return { error: jsonError("লগইন প্রয়োজন", 401) } as const;
  if (!(await hasPermission(principal.id, "category.manage"))) return { error: jsonError("শুধু অ্যাডমিন বিভাগ ও উপবিভাগ পরিচালনা করতে পারেন", 403) } as const;
  if (!(await allowCmsMutation(principal.id, "category-mutation", 60))) return { error: jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429) } as const;
  return { principal } as const;
}
export async function PATCH(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const permission = await authorized(request); if ("error" in permission) return permission.error;
  const raw = await parseJson(request); if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = categorySchema.safeParse(raw); if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    const { id } = await context.params;
    const category = await updateCategory(id, parsed.data, permission.principal);
    revalidatePath("/", "layout");
    return NextResponse.json({ category }, { headers: { "Cache-Control": "private, no-store" } });
  }
  catch (error) { return cmsErrorResponse(error); }
}
export async function DELETE(request: Request, context: Context) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const permission = await authorized(request); if ("error" in permission) return permission.error;
  try {
    const { id } = await context.params;
    await removeCategory(id, permission.principal);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  }
  catch (error) { return cmsErrorResponse(error); }
}
