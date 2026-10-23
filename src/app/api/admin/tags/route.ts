import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { tagSchema } from "@/lib/cms-schemas";
import { createTag, listTags } from "@/lib/taxonomy-service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "taxonomy.read"))) return jsonError("এই কাজের অনুমতি নেই", 403);
  try { return NextResponse.json({ tags: await listTags(new URL(request.url).searchParams.get("q") ?? undefined) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "taxonomy.manage"))) return jsonError("ট্যাগ পরিচালনার অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "tag-mutation", 60))) return jsonError("খুব দ্রুত অনুরোধ করা হয়েছে", 429);
  const raw = await parseJson(request); if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = tagSchema.safeParse(raw); if (!parsed.success) return cmsErrorResponse(parsed.error);
  try { return NextResponse.json({ tag: await createTag(parsed.data, principal) }, { status: 201, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return cmsErrorResponse(error); }
}
