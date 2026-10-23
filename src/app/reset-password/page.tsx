import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "পাসওয়ার্ড পরিবর্তন" };

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  return <AuthPanel><AuthForm mode="reset" resetToken={typeof token === "string" ? token : undefined} /></AuthPanel>;
}
