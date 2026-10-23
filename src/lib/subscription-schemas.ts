import { z } from "zod";

export const SUBSCRIPTION_PLANS = {
  MONTHLY: { label: "মাসিক", amountBdt: 60, durationDays: 31, badge: null },
  YEARLY: { label: "বাৎসরিক", amountBdt: 612, durationDays: 365, badge: "১৫% সাশ্রয়" },
} as const;
export const PAYMENT_METHODS = ["NAGAD", "BKASH", "ROCKET"] as const;
export const PACKAGE_CATEGORIES = ["NEWSPAPER", "MAGAZINE", "KNOWLEDGE", "GUIDEBOOK"] as const;
export const ISSUE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const DEFAULT_PAYMENT_GATEWAYS = [
  { method: "NAGAD" as const, displayName: "নগদ", accountNumber: "", transferType: "Send Money", instructions: "অ্যাকাউন্ট নম্বর যোগ হলে নির্দেশনা এখানে দেখানো হবে।", isActive: false },
  { method: "BKASH" as const, displayName: "বিকাশ", accountNumber: "", transferType: "Send Money", instructions: "অ্যাকাউন্ট নম্বর যোগ হলে নির্দেশনা এখানে দেখানো হবে।", isActive: false },
  { method: "ROCKET" as const, displayName: "রকেট", accountNumber: "", transferType: "Cash Out", instructions: "অ্যাকাউন্ট নম্বর যোগ হলে নির্দেশনা এখানে দেখানো হবে।", isActive: false },
];
export const DEFAULT_SUBSCRIPTION_PACKAGES = [
  { code: "NEWSPAPER_1M", category: "NEWSPAPER" as const, title: "দৈনিক সংবাদ · ১ মাস", description: "দৈনিক আজকের দিগন্তের নির্বাচিত সংবাদ ও পাঠক সুবিধার এক মাসের প্যাকেজ।", durationLabel: "১ মাস", durationMonths: 1, durationDays: 31, benefits: "দৈনিক সংবাদ পড়ার সুবিধা\nসংবাদ সংরক্ষণ ও পছন্দের তালিকা\nপাঠক বিজ্ঞপ্তি", terms: "প্যাকেজের মেয়াদ শুরু হবে Admin যাচাইয়ের পর।", priceBdt: 60, isActive: true, sortOrder: 10 },
  { code: "NEWSPAPER_3M", category: "NEWSPAPER" as const, title: "দৈনিক সংবাদ · ৩ মাস", description: "নিরবচ্ছিন্ন পাঠক সুবিধার জন্য তিন মাসের সংবাদ প্যাকেজ।", durationLabel: "৩ মাস", durationMonths: 3, durationDays: 92, benefits: "দৈনিক সংবাদ পড়ার সুবিধা\nসংবাদ সংরক্ষণ ও পছন্দের তালিকা\nপাঠক বিজ্ঞপ্তি", terms: "প্যাকেজের মেয়াদ শুরু হবে Admin যাচাইয়ের পর।", priceBdt: 170, isActive: true, sortOrder: 20 },
  { code: "NEWSPAPER_6M", category: "NEWSPAPER" as const, title: "দৈনিক সংবাদ · ৬ মাস", description: "দৈনিক সংবাদ ও পাঠক সেবার ছয় মাসের প্যাকেজ।", durationLabel: "৬ মাস", durationMonths: 6, durationDays: 183, benefits: "দৈনিক সংবাদ পড়ার সুবিধা\nসংবাদ সংরক্ষণ ও পছন্দের তালিকা\nপাঠক বিজ্ঞপ্তি", terms: "প্যাকেজের মেয়াদ শুরু হবে Admin যাচাইয়ের পর।", priceBdt: 330, isActive: true, sortOrder: 30 },
  { code: "NEWSPAPER_12M", category: "NEWSPAPER" as const, title: "দৈনিক সংবাদ · ১২ মাস", description: "পুরো বছরের জন্য দৈনিক আজকের দিগন্তের পাঠক প্যাকেজ।", durationLabel: "১২ মাস", durationMonths: 12, durationDays: 365, benefits: "দৈনিক সংবাদ পড়ার সুবিধা\nসংবাদ সংরক্ষণ ও পছন্দের তালিকা\nপাঠক বিজ্ঞপ্তি", terms: "প্যাকেজের মেয়াদ শুরু হবে Admin যাচাইয়ের পর।", priceBdt: 612, isActive: true, sortOrder: 40 },
  { code: "MONTHLY_MAGAZINE", category: "MAGAZINE" as const, title: "মাসিক ম্যাগাজিন", description: "নির্বাচিত নিবন্ধ, জ্ঞানভিত্তিক লেখা ও তথ্যসমৃদ্ধ সম্পাদকীয় বিষয়বস্তু।", durationLabel: "মাসিক", durationMonths: 1, durationDays: 31, benefits: "মাসিক সংখ্যার প্রকাশনা তথ্য\nবিষয়ভিত্তিক সম্পাদকীয় কনটেন্ট\nইস্যু-ভিত্তিক পাঠক আপডেট", terms: "প্রকাশনা ও বিতরণের তথ্য Admin দ্বারা কনফিগার করা হবে।", priceBdt: 120, isActive: true, sortOrder: 50 },
  { code: "ASUN_JENE_NEI", category: "KNOWLEDGE" as const, title: "আসুন জেনে নেই", description: "বাংলাদেশ ও বিশ্বের কম-জানা, উল্লেখযোগ্য ও আকর্ষণীয় বিষয় নিয়ে সাপ্তাহিক জ্ঞান ম্যাগাজিন।", durationLabel: "সাপ্তাহিক", durationMonths: null, durationDays: 7, benefits: "সাপ্তাহিক জ্ঞানভিত্তিক সংখ্যা\nনতুন বিষয়ের সংক্ষিপ্ত পরিচিতি\nইস্যু-ভিত্তিক পাঠক আপডেট", terms: "প্রকাশনার সময়সূচি ও বিষয় Admin দ্বারা কনফিগার করা হবে।", priceBdt: 45, isActive: true, sortOrder: 60 },
  { code: "ESO_DOKKHOTA_BARAI", category: "GUIDEBOOK" as const, title: "এসো দক্ষতা বাড়াই", description: "আইটি, সাইবার নিরাপত্তা, ইন্টারনেট, ফ্রিল্যান্সিং ও ব্যবহারিক দক্ষতার মাসিক গাইডবুক সিরিজ।", durationLabel: "মাসিক", durationMonths: 1, durationDays: 31, benefits: "আইটি ও ইন্টারনেট প্রযুক্তি\nসাইবার নিরাপত্তা ও অনলাইন নিরাপত্তা\nফ্রিল্যান্সিং ও পেশাগত উৎপাদনশীলতা", terms: "গাইডবুক সিরিজের প্রকাশনা তথ্য Admin দ্বারা কনফিগার করা হবে।", priceBdt: 150, isActive: true, sortOrder: 70 },
];

const phone = z.string().normalize().trim().min(7).max(40).regex(/^\+?[0-9][0-9 ()-]{6,38}$/, "সঠিক ফোন নম্বর দিন");
const transactionId = z.string().trim().toUpperCase().min(3).max(120).regex(/^[A-Z0-9_-]+$/, "লেনদেন আইডি শুধু ইংরেজি অক্ষর/সংখ্যা, _ বা - হতে পারে");
export const paymentSubmissionSchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]).optional(),
  packageId: z.uuid().optional(),
  method: z.enum(PAYMENT_METHODS),
  customerName: z.string().normalize().trim().min(2).max(120),
  phone,
  address: z.string().normalize().trim().min(5).max(1000),
  transactionId,
}).strict().superRefine((value, ctx) => {
  if (!value.plan && !value.packageId) ctx.addIssue({ code: "custom", path: ["packageId"], message: "একটি প্যাকেজ নির্বাচন করুন" });
});

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

const price = z.number().int().min(0).max(10_000_000);
export const subscriptionPackageSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9_-]+$/),
  category: z.enum(PACKAGE_CATEGORIES),
  title: z.string().normalize().trim().min(2).max(120),
  description: z.string().normalize().trim().min(5).max(5000),
  durationLabel: z.string().normalize().trim().min(1).max(40),
  durationMonths: z.number().int().min(1).max(120).nullable().optional(),
  durationDays: z.number().int().min(1).max(3650),
  benefits: z.string().normalize().trim().min(1).max(5000),
  terms: z.string().normalize().trim().min(1).max(5000),
  priceBdt: price,
  isActive: z.boolean(),
  sortOrder: z.number().int().min(-10000).max(10000),
}).strict();

export const publicationIssueSchema = z.object({
  id: z.uuid().optional(),
  packageId: z.uuid(),
  caption: z.string().normalize().trim().min(2).max(120),
  issueTitle: z.string().normalize().trim().min(2).max(180),
  publicationMonth: z.number().int().min(1).max(12),
  publicationYear: z.number().int().min(2000).max(2200),
  releaseDate: z.string().datetime().nullable().optional(),
  subjectSummary: z.string().normalize().trim().min(2).max(3000),
  editorName: z.string().normalize().trim().max(120).nullable().optional(),
  publisherName: z.string().normalize().trim().max(120).nullable().optional(),
  coverImageUrl: z.string().url().max(1000).nullable().optional(),
  status: z.enum(ISSUE_STATUSES),
  description: z.string().normalize().trim().max(5000).nullable().optional(),
}).strict();

export const paymentDecisionSchema = z.object({ action: z.enum(["approve", "reject"]) }).strict();
export type PaymentSubmissionInput = z.infer<typeof paymentSubmissionSchema>;
export type PaymentGatewaySettingsInput = z.infer<typeof paymentGatewaySettingsSchema>;
export type SubscriptionPackageInput = z.infer<typeof subscriptionPackageSchema>;
export type PublicationIssueInput = z.infer<typeof publicationIssueSchema>;
