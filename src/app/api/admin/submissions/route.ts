import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { jsonError } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return jsonError("લૉગિન જરૂરી છે", 401);
  if (!(await hasPermission(principal.id, "submissions.read"))) return jsonError("અનુમતિ નથી", 403);
  try {
    const [contacts, footer] = await Promise.all([
      prisma.contactSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.footerSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return NextResponse.json({ contacts, footer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
