import { z } from "zod";

export const SUBSCRIPTION_PLANS = {
  MONTHLY: { label: "মাসিক", amountBdt: 60, durationDays: 31, badge: null },
  YEARLY: { label: "বাৎসরিক", amountBdt: 612, durationDays: 365, badge: "১৫% সাশ্রয়" },
} as const;
export const PAYMENT_METHODS = ["NAGAD", "BKASH", "ROCKET"] as const;
export const DEFAULT_PAYMENT_GATEWAYS = [
  { method: "NAGAD" as const, displayName: "নগদ", accountNumber: "", transferType: "Send Money", instructions: "অ্যাকাউন্ট নম্বর যোগ হলে নির্দেশনা এখানে দেখানো হবে।", isActive: false },
  { method: "BKASH" as const, displayName: "বিকাশ", accountNumber: "", transferType: "Send Money", instructions: "অ্যাকাউন্ট নম্বর যোগ হলে নির্দেশনা এখানে দেখানো হবে।", isActive: false },
  { method: "ROCKET" as const, displayName: "রকেট", accountNumber: "", transferType: "Cash Out", instructions: "অ্যাকাউন্ট নম্বর যোগ হলে নির্দেশনা এখানে দেখানো হবে।", isActive: false },
];

const phone = z.string().normalize().trim().min(7).max(40).regex(/^\+?[0-9][0-9 ()-]{6,38}$/, "সঠিক ফোন নম্বর দিন");
const transactionId = z.string().trim().toUpperCase().min(3).max(120).regex(/^[A-Z0-9_-]+$/, "লেনদেন আইডি শুধু ইংরেজি অক্ষর/সংখ্যা, _ বা - হতে পারে");
export const paymentSubmissionSchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
  method: z.enum(PAYMENT_METHODS),
  customerName: z.string().normalize().trim().min(2).max(120),
  phone,
  address: z.string().normalize().trim().min(5).max(1000),
  transactionId,
}).strict();

const accountNumber = z.string().trim().max(40).transform((value) => value.replace(/[\s-]/g, "")).refine((value) => value === "" || /^(?:\+?8801[3-9]\d{8}|01[3-9]\d{8})$/.test(value), "সঠিক মোবাইল ব্যাংকিং নম্বর দিন");
export const paymentGatewaySettingsSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  displayName: z.string().normalize().trim().min(2).max(40),
  accountNumber,
  transferType: z.string().normalize().trim().min(2).max(40),
  instructions: z.string().normalize().trim().min(5).max(2000),
  isActive: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (value.isActive && !value.accountNumber) ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "সক্রিয় করতে বৈধ account number দিন" });
});

export const paymentDecisionSchema = z.object({ action: z.enum(["approve", "reject"]) }).strict();
export type PaymentSubmissionInput = z.infer<typeof paymentSubmissionSchema>;
export type PaymentGatewaySettingsInput = z.infer<typeof paymentGatewaySettingsSchema>;
