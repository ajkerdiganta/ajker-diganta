import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { env } from "@/lib/env";
import { CmsFrame } from "@/components/cms/cms-frame";
import { MediaLibraryPage } from "@/components/cms/media-library-page";

export const metadata: Metadata = { title: "মিডিয়া লাইব্রেরি | নিউজরুম" };
export const dynamic = "force-dynamic";
export default async function MediaPage() {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/d/a/d/my/staff");
  const canRead = await hasPermission(principal.id, "media.read") || await hasPermission(principal.id, "media.read.own");
  if (!canRead) notFound();
  const configured = Boolean(env.R2_ENDPOINT && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
  return <CmsFrame><MediaLibraryPage configured={configured} /></CmsFrame>;
}
