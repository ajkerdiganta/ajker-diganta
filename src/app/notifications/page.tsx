import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicFrame } from "@/components/layout/page-frame";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { getPrincipal } from "@/lib/authorization";
import { getNotificationInbox } from "@/lib/notification-service";
import { hasActiveSubscription } from "@/lib/subscription-service";

export const metadata: Metadata = { title: "বিজ্ঞপ্তি", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ unread?: string }> };

export default async function NotificationPage({ searchParams }: Props) {
  const principal = await getPrincipal(new Headers(await headers()));
  if (!principal) redirect("/login?next=%2Fnotifications");
  if (!(await hasActiveSubscription(principal.id))) redirect("/subscribe?required=notifications");
  const params = await searchParams;
  const unreadOnly = params.unread === "true";
  const data = await getNotificationInbox(principal.id, { page: 1, unreadOnly });
  return <PublicFrame><NotificationInbox initialData={data} initialUnreadOnly={unreadOnly} /></PublicFrame>;
}
