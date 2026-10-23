import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { publicationIssueSchema } from "@/lib/subscription-schemas";
import { upsertPublicationIssue } from "@/lib/subscription-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুমোদিত উৎস নয়", 403);
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("লগইন প্রয়োজন", 401);
  if (!(await hasPermission(principal.id, "payments.manage"))) return jsonError("প্রকাশনা তথ্য পরিচালনার অনুমতি নেই", 403);
  if (!(await allowCmsMutation(principal.id, "publication-issue-update", 60))) return jsonError("খুব দ্রুত পরিবর্তন করা হচ্ছে", 429);
  const parsed = publicationIssueSchema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ error: "ইস্যুর তথ্য সঠিক নয়", issues: parsed.error.issues }, { status: 400 });
  try {
    const issue = await upsertPublicationIssue(parsed.data, principal.id);
    return NextResponse.json({ issue }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError("ইস্যু সংরক্ষণ করা যায়নি", 503);
  }
}
