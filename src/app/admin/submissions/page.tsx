import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CmsFrame } from "@/components/cms/cms-frame";
import { SubmissionInbox } from "@/components/cms/submission-inbox";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/dainik/ajker/diganta/s/a/boss");
  if (!(await hasPermission(principal.id, "submissions.read"))) notFound();
  const [initialContacts, initialFooter] = await Promise.all([
    prisma.contactSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.footerSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return <CmsFrame><SubmissionInbox initialContacts={initialContacts} initialFooter={initialFooter} /></CmsFrame>;
}
