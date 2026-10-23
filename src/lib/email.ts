import { env } from "@/lib/env";

export type PasswordResetMessage = {
  to: string;
  url: string;
};

const testMessages: PasswordResetMessage[] = [];

export async function sendPasswordResetEmail(message: PasswordResetMessage): Promise<void> {
  if (env.NODE_ENV === "test") {
    testMessages.push(message);
    return;
  }

  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "development") {
      console.info(`[dev-only password reset] ${message.to}: ${message.url}`);
      return;
    }
    throw new Error("Password reset email provider is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: "পাসওয়ার্ড পুনরায় সেট করুন",
      text: `পাসওয়ার্ড পরিবর্তনের অনুরোধ করা হয়েছে। লিংকটি একবার ব্যবহার করুন: ${message.url}\n\nআপনি অনুরোধ না করলে এই ইমেইল উপেক্ষা করুন।`,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Password reset email provider returned ${response.status}`);
  }
}

export function takeTestResetMessages(): PasswordResetMessage[] {
  return testMessages.splice(0, testMessages.length);
}
