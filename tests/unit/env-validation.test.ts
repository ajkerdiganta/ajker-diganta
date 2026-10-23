import { describe, expect, it } from "vitest";
import { validateProductionEnv } from "@/lib/env-validation";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://app:secret@db.example.com:5432/news?sslmode=require",
  BETTER_AUTH_SECRET: "rA7P2Wm9xK4vN8qL3cD6bF1hJ5sT0uE7",
  BETTER_AUTH_URL: "https://news.example.com",
  PUBLIC_SITE_URL: "https://news.example.com",
  R2_ENDPOINT: "https://account.r2.example.com",
  R2_BUCKET: "news-media",
  R2_ACCESS_KEY_ID: "r2-access-key-01",
  R2_SECRET_ACCESS_KEY: "r2-secret-key-0123456789",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
  RESEND_API_KEY: "re_test_valid_api_key_123456",
  EMAIL_FROM: "দৈনিক আজকের দিগন্ত <accounts@news-verified.org>",
  JOB_AUTH_SECRET: "unique-test-job-token-with-at-least-32-bytes",
};

describe("production environment security validation", () => {
  it("accepts generated-length production secrets with HTTPS origins", () => {
    expect(() => validateProductionEnv(valid)).not.toThrow();
  });

  it.each([
    "replace-with-at-least-32-random-bytes",
    "your-secret-should-be-at-least-32-characters-long",
    "a".repeat(64),
  ])("rejects obvious placeholder or repeated secrets in production", (secret) => {
    expect(() => validateProductionEnv({ ...valid, BETTER_AUTH_SECRET: secret })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it.each(["http://news.example.com", "javascript:alert(1)", "not a URL"]) (
    "rejects non-HTTPS or malformed production URL %s", (url) => {
      expect(() => validateProductionEnv({ ...valid, R2_ENDPOINT: url })).toThrow(/HTTPS/);
    },
  );

  it("leaves local/test URL and placeholder choices to development setup", () => {
    expect(() => validateProductionEnv({ ...valid, NODE_ENV: "development", BETTER_AUTH_SECRET: "replace-with-at-least-32-random-bytes", BETTER_AUTH_URL: "http://localhost:3000" })).not.toThrow();
  });

  it("requires TLS for the production database, canonical URL, email provider, and complete storage", () => {
    expect(() => validateProductionEnv({ ...valid, DATABASE_URL: "postgresql://app:secret@db.example.com/news" })).toThrow(/DATABASE_URL/);
    expect(() => validateProductionEnv({ ...valid, PUBLIC_SITE_URL: "" })).toThrow(/HTTPS/);
    expect(() => validateProductionEnv({ ...valid, RESEND_API_KEY: undefined })).toThrow(/email/);
    expect(() => validateProductionEnv({ ...valid, R2_BUCKET: undefined })).toThrow(/R2/);
    expect(() => validateProductionEnv({ ...valid, JOB_AUTH_SECRET: undefined })).toThrow(/JOB_AUTH_SECRET/);
    expect(() => validateProductionEnv({ ...valid, EMAIL_FROM: "news@example.com" })).toThrow(/EMAIL_FROM/);
  });

  it("allows a production build to omit live provider secrets while still validating the auth secret", () => {
    expect(() => validateProductionEnv({ ...valid, NEXT_PHASE: "phase-production-build", DATABASE_URL: "postgresql://local/news", PUBLIC_SITE_URL: undefined, RESEND_API_KEY: undefined, EMAIL_FROM: "", R2_ENDPOINT: undefined, R2_BUCKET: undefined, R2_ACCESS_KEY_ID: undefined, R2_SECRET_ACCESS_KEY: undefined, R2_PUBLIC_BASE_URL: undefined })).not.toThrow();
  });
});
