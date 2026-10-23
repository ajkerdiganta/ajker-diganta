import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return NextResponse.json({ error: "অনুমোদিত নয়" }, { status: 401 });
  if (!(await hasPermission(principal.id, "admin.access"))) {
    return NextResponse.json({ error: "এই কাজের অনুমতি নেই" }, { status: 403 });
  }

  const totalUsers = await prisma.user.count({ where: { status: "ACTIVE" } });
  return NextResponse.json({ totalUsers, roles: principal.roles });
}
