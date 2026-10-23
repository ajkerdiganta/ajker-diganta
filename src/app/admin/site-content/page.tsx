import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CmsFrame } from "@/components/cms/cms-frame";
import { SiteContentManager } from "@/components/cms/site-content-manager";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { listSitePages, getFooterSettings } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function SiteContentPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "sitecontent.manage"))) notFound();
  const [pages, settings] = await Promise.all([listSitePages(), getFooterSettings()]);
  return <CmsFrame><SiteContentManager initialPages={pages} initialSettings={settings} /></CmsFrame>;
}
