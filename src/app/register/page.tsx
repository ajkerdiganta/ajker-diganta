import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "নিবন্ধন" };

export default function RegisterPage() {
  return <AuthPanel><AuthForm mode="register" /></AuthPanel>;
}
