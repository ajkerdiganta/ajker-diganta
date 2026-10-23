import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CmsFrame } from "@/components/cms/cms-frame";
import { SubscriptionManager } from "@/components/cms/subscription-manager";
import { SubscriptionCatalogManager } from "@/components/cms/subscription-catalog-manager";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { getAdminPaymentDashboard, getAdminSubscriptionCatalog } from "@/lib/subscription-service";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "payments.read"))) notFound();
  const canManage = await hasPermission(principal.id, "payments.manage");
  const [data, catalog] = await Promise.all([getAdminPaymentDashboard(), getAdminSubscriptionCatalog()]);
  return <CmsFrame><div className="space-y-8"><SubscriptionCatalogManager initialPackages={catalog} canManage={canManage} /><SubscriptionManager initialGateways={data.gateways} initialSubmissions={data.submissions} canManage={canManage} /></div></CmsFrame>;
}
