import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CmsFrame } from "@/components/cms/cms-frame";
import { SubscriptionManager } from "@/components/cms/subscription-manager";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { getAdminPaymentDashboard } from "@/lib/subscription-service";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "payments.read"))) notFound();
  const canManage = await hasPermission(principal.id, "payments.manage");
  const data = await getAdminPaymentDashboard();
  return <CmsFrame><SubscriptionManager initialGateways={data.gateways} initialSubmissions={data.submissions} canManage={canManage} /></CmsFrame>;
}
