"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
      router.replace(redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return <button type="button" onClick={signOut} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-red-brand/30 hover:text-red-brand disabled:opacity-60">
    {pending ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} />} লগআউট
  </button>;
}
