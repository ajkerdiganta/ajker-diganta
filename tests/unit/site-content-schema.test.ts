import { describe, expect, it } from "vitest";
import { contactSubmissionSchema, footerSubmissionSchema, sitePageSchema, siteSettingsSchema } from "@/lib/site-content-schemas";

const page = { slug: "about", title: "আমাদের কথা", body: "দৈনিক আজকের দিগন্ত সম্পর্কে তথ্য।", metaTitle: "আমাদের কথা", metaDescription: "বাংলা সংবাদমাধ্যমের পরিচিতি।" };

describe("editable site content validation", () => {
  it("accepts safe Bengali page content and metadata but rejects unknown fields and overlong data", () => {
    expect(sitePageSchema.safeParse(page).success).toBe(true);
    expect(sitePageSchema.safeParse({ ...page, title: "x", unknown: true }).success).toBe(false);
    expect(sitePageSchema.safeParse({ ...page, body: "x".repeat(50_001) }).success).toBe(false);
    expect(sitePageSchema.safeParse({ ...page, slug: "admin" }).success).toBe(false);
  });

  it.each(["javascript:alert(1)", "http://example.org", "//attacker.invalid", "https://user:pass@example.org", "mailto:news@example.org"]) (
    "rejects untrusted footer link URL %j",
    (href) => expect(siteSettingsSchema.safeParse({ companyLinks: [{ label: "লিংক", href }] }).success).toBe(false),
  );

  it("accepts verified HTTPS links and rejects arbitrary provider-secret fields", () => {
    const parsed = siteSettingsSchema.safeParse({ companyLinks: [{ label: "আমাদের পাতা", href: "https://news.example.org/about" }], socialLinks: [{ label: "Facebook", href: "https://facebook.com/example", enabled: false }] });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.companyLinks?.[0]?.enabled).toBe(true);
      expect(parsed.data.socialLinks?.[0]?.enabled).toBe(false);
    }
    expect(siteSettingsSchema.safeParse({ resendApiKey: "not-a-public-setting" }).success).toBe(false);
  });

  it("requires explicit contact type, valid PII bounds and empty anti-bot honeypot", () => {
    expect(contactSubmissionSchema.safeParse({ type: "CONTACT", name: "রহিম", email: "rahim@example.test", subject: "তথ্য", message: "একটি যথাযথ বার্তা", website: "" }).success).toBe(true);
    expect(contactSubmissionSchema.safeParse({ type: "CONTACT", name: "রহিম", email: "bad", subject: "তথ্য", message: "একটি যথাযথ বার্তা", website: "" }).success).toBe(false);
    expect(contactSubmissionSchema.safeParse({ type: "CONTACT", name: "রহিম", email: "rahim@example.test", subject: "তথ্য", message: "একটি যথাযথ বার্তা", website: "bot" }).success).toBe(false);
  });

  it("accepts only advertisement/newsletter submission types and bounds phone/message fields", () => {
    const valid = { type: "ADVERTISEMENT", name: "প্রতিষ্ঠান", email: "contact@example.test", phone: "+880 1700-000000", subject: "বিজ্ঞাপন", message: "বিজ্ঞাপন প্রস্তাবের বিবরণ।", website: "" };
    expect(footerSubmissionSchema.safeParse(valid).success).toBe(true);
    expect(footerSubmissionSchema.safeParse({ ...valid, type: "PAYMENT" }).success).toBe(false);
    expect(footerSubmissionSchema.safeParse({ ...valid, phone: "call-me" }).success).toBe(false);
    expect(footerSubmissionSchema.safeParse({ ...valid, type: "NEWSLETTER", consent: true }).success).toBe(true);
    expect(footerSubmissionSchema.safeParse({ ...valid, type: "NEWSLETTER" }).success).toBe(false);
  });
});
