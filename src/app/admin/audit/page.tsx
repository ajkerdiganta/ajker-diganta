import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CmsFrame } from "@/components/cms/cms-frame";

export const metadata: Metadata = { title: "নিরাপত্তা লগ | দৈনিক আজকের দিগন্ত" };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "audit.read"))) redirect("/forbidden");
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
  return <CmsFrame><div className="space-y-5">
    <header><p className="text-xs font-bold text-forest">নিরাপত্তা ও পরিবর্তনের রেকর্ড</p><h1 className="mt-1 font-serif text-3xl font-bold">পরিবর্তন ও নিরাপত্তা লগ</h1><p className="mt-2 text-sm text-ink-muted">সর্বশেষ ১০০টি event; এখানে raw metadata, payer তথ্য, request ID বা session secret দেখানো হয় না।</p></header>
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-paper-100 text-xs text-ink-muted"><tr><th className="p-3">সময়</th><th className="p-3">কর্মী</th><th className="p-3">কাজ</th><th className="p-3">রিসোর্স</th><th className="p-3">রেকর্ড</th></tr></thead>
        <tbody className="divide-y divide-line">{entries.map((entry) => <tr key={entry.id}>
          <td className="whitespace-nowrap p-3 text-xs">{entry.createdAt.toLocaleString("bn-BD")}</td>
          <td className="p-3"><p>{entry.actor?.name ?? "অজানা/অপসারিত ব্যবহারকারী"}</p>{entry.actor?.email && <p className="text-xs text-ink-muted">{entry.actor.email}</p>}</td>
          <td className="p-3 font-mono text-xs">{entry.action}</td>
          <td className="p-3">{entry.resourceType}</td>
          <td className="max-w-48 truncate p-3 font-mono text-xs" title={entry.resourceId ?? ""}>{entry.resourceId ?? "—"}</td>
        </tr>)}{entries.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-ink-muted">এখনও কোনো audit event নেই।</td></tr>}</tbody>
      </table>
    </div>
  </div></CmsFrame>;
}
