import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { listSitePages, getFooterSettings, saveSitePage, saveSiteSettings } from "@/lib/site-content";
import { sitePageSchema, siteSettingsSchema } from "@/lib/site-content-schemas";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "sitecontent.manage"))) return jsonError("সাইট কনটেন্ট পরিচালনার অনুমতি নেই", 403);
  try {
    const [pages, settings] = await Promise.all([listSitePages(), getFooterSettings()]);
    return NextResponse.json({ pages, settings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}

const patchSchema = z.union([
  z.object({ page: sitePageSchema }).strict(),
  z.object({ settings: siteSettingsSchema }).strict(),
]);

export async function PATCH(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "sitecontent.manage"))) return jsonError("সাইট কনটেন্ট পরিচালনার অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "site-content-mutation", 30))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  try {
    if ("page" in parsed.data) {
      const page = await saveSitePage(parsed.data.page, principal.id);
      revalidatePath(`/${page.slug}`);
      return NextResponse.json({ page }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const settings = await saveSiteSettings(parsed.data.settings, principal.id);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, updatedAt: settings.updatedAt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
