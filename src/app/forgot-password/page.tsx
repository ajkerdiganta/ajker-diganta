import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "পাসওয়ার্ড পুনরুদ্ধার" };

export default function ForgotPasswordPage() {
  return <AuthPanel><AuthForm mode="forgot" /></AuthPanel>;
}
