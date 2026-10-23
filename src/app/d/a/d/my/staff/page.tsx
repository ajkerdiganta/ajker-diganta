import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "রিপোর্টার / এডিটর লগইন | দৈনিক আজকের দিগন্ত", robots: { index: false, follow: false } };

export default function StaffLoginPage() {
  return <AuthPanel><AuthForm mode="login" loginSurface="staff" /></AuthPanel>;
}
