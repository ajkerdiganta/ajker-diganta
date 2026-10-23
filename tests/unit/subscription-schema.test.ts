import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_GATEWAYS, SUBSCRIPTION_PLANS, paymentGatewaySettingsSchema, paymentSubmissionSchema } from "@/lib/subscription-schemas";
import { decryptPaymentField, encryptPaymentField, paymentTransactionHash } from "@/lib/payment-pii";

describe("manual subscription validation", () => {
  it("preserves the archive's monthly/yearly pricing and term lengths", () => {
    expect(SUBSCRIPTION_PLANS.MONTHLY).toMatchObject({ amountBdt: 60, durationDays: 31 });
    expect(SUBSCRIPTION_PLANS.YEARLY).toMatchObject({ amountBdt: 612, durationDays: 365, badge: "১৫% সাশ্রয়" });
  });

  it("ships all supported transfer types disabled and without placeholder account numbers", () => {
    expect(DEFAULT_PAYMENT_GATEWAYS.map(({ method }) => method).sort()).toEqual(["BKASH", "NAGAD", "ROCKET"]);
    for (const gateway of DEFAULT_PAYMENT_GATEWAYS) expect(gateway).toMatchObject({ accountNumber: "", isActive: false });
  });

  it("accepts bounded, explicit user transfer details and normalizes transaction IDs", () => {
    const parsed = paymentSubmissionSchema.parse({ plan: "YEARLY", method: "BKASH", customerName: "রহিম উদ্দিন", phone: "+8801712345678", address: "ঢাকা, বাংলাদেশ", transactionId: "tx-a9_B1" });
    expect(parsed).toMatchObject({ plan: "YEARLY", method: "BKASH", transactionId: "TX-A9_B1" });
    expect(paymentSubmissionSchema.safeParse({ ...parsed, hidden: "unexpected" }).success).toBe(false);
    expect(paymentSubmissionSchema.safeParse({ ...parsed, transactionId: "txn 123" }).success).toBe(false);
    expect(paymentSubmissionSchema.safeParse({ ...parsed, phone: "abc" }).success).toBe(false);
  });

  it("rejects activating an unconfigured gateway and normalizes a valid account number", () => {
    const base = { method: "NAGAD", displayName: "নগদ", transferType: "Send Money", instructions: "নিরাপদ নির্দেশনা দিন", isActive: true };
    expect(paymentGatewaySettingsSchema.safeParse({ ...base, accountNumber: "" }).success).toBe(false);
    expect(paymentGatewaySettingsSchema.parse({ ...base, accountNumber: "01712-345 678" }).accountNumber).toBe("01712345678");
    expect(paymentGatewaySettingsSchema.safeParse({ ...base, accountNumber: "01700000000", unknown: true }).success).toBe(false);
  });

  it("encrypts payer values at rest and produces method-scoped duplicate-detection hashes", () => {
    const ciphertext = encryptPaymentField("transaction-123");
    expect(ciphertext).not.toContain("transaction-123");
    expect(decryptPaymentField(ciphertext)).toBe("transaction-123");
    expect(paymentTransactionHash("NAGAD", "tx-abc")).toBe(paymentTransactionHash("NAGAD", "TX-ABC"));
    expect(paymentTransactionHash("NAGAD", "TX-ABC")).not.toBe(paymentTransactionHash("BKASH", "TX-ABC"));
  });
});
