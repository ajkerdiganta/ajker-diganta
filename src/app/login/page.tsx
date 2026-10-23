import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "লগইন" };

export default function LoginPage() {
  return <AuthPanel><AuthForm mode="login" /></AuthPanel>;
}
