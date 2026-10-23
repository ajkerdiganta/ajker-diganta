type ProductionEnvInput = {
  NODE_ENV: string;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  PUBLIC_SITE_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
  JOB_AUTH_SECRET?: string;
  R2_ENDPOINT?: string;
  R2_BUCKET?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_PUBLIC_BASE_URL?: string;
  NEXT_PHASE?: string;
};

function isHttps(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Fail closed on common deployment mistakes; does not claim to measure secret entropy. */
export function validateProductionEnv(input: ProductionEnvInput) {
  if (input.NODE_ENV !== "production") return;
  const secret = input.BETTER_AUTH_SECRET;
  const looksLikePlaceholder = /(?:replace[-_ ]?with|change[-_ ]?me|your[-_ ]?secret|placeholder|example|development[-_ ]?secret)/iu.test(secret);
  const repeatedCharacter = /^(.)\1{31,}$/u.test(secret);
  if (Buffer.byteLength(secret, "utf8") < 32 || looksLikePlaceholder || repeatedCharacter) {
    throw new Error("Production configuration is invalid: use a unique randomly generated BETTER_AUTH_SECRET of at least 32 bytes.");
  }
  if (!isHttps(input.BETTER_AUTH_URL)) throw new Error("Production configuration is invalid: BETTER_AUTH_URL must use HTTPS.");

  // Next.js imports server modules while building routes. Validate external production
  // integrations when the server starts, not during a reproducible asset build.
  if (input.NEXT_PHASE === "phase-production-build") return;

  if (!isHttps(input.PUBLIC_SITE_URL) || !isHttps(input.R2_ENDPOINT) || !isHttps(input.R2_PUBLIC_BASE_URL)) {
    throw new Error("Production configuration is invalid: canonical public-site and object-storage URLs must use HTTPS.");
  }
  try {
    const database = new URL(input.DATABASE_URL);
    const tlsMode = database.searchParams.get("sslmode")?.toLowerCase();
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(database.hostname);
    if (!("postgres:" === database.protocol || "postgresql:" === database.protocol) || (!loopback && (!tlsMode || ["disable", "allow", "prefer"].includes(tlsMode)))) {
      throw new Error();
    }
  } catch {
    throw new Error("Production configuration is invalid: remote DATABASE_URL must be a PostgreSQL URL with TLS enabled (sslmode=require or stronger).");
  }
  if (!input.RESEND_API_KEY || input.RESEND_API_KEY.length < 16) {
    throw new Error("Production configuration is invalid: configure a provider API key for password-reset email delivery.");
  }
  if (!input.JOB_AUTH_SECRET || Buffer.byteLength(input.JOB_AUTH_SECRET, "utf8") < 32 || /(?:replace[-_ ]?with|change[-_ ]?me|placeholder|example)/iu.test(input.JOB_AUTH_SECRET)) {
    throw new Error("Production configuration is invalid: configure a unique JOB_AUTH_SECRET of at least 32 bytes.");
  }
  const senderAddress = input.EMAIL_FROM.match(/<([^<>]+)>/u)?.[1] ?? input.EMAIL_FROM.trim();
  const senderDomain = senderAddress.split("@").at(-1) ?? "";
  if (!/^[^\s@<>]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$/u.test(senderAddress)
    || /(?:^|\.)(?:example|invalid|test|localhost|local)(?:\.|$)/iu.test(senderDomain)) {
    throw new Error("Production configuration is invalid: EMAIL_FROM must use a valid, non-placeholder, provider-verified email domain.");
  }
  if (!input.R2_ENDPOINT || !input.R2_BUCKET || !input.R2_ACCESS_KEY_ID || !input.R2_SECRET_ACCESS_KEY || !input.R2_PUBLIC_BASE_URL) {
    throw new Error("Production configuration is invalid: configure the complete R2 endpoint, bucket, credentials, and public media URL.");
  }
}
