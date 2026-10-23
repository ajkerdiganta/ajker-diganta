import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/layout/site-shell";
import { SubscriptionPrompt } from "@/components/public/subscription-prompt";

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper-50 text-ink">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <SubscriptionPrompt />
    </div>
  );
}
