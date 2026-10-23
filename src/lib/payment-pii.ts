import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

function paymentKey() {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update("ajker-diganta:payment-pii:v1").digest();
}

export function encryptPaymentField(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", paymentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptPaymentField(value: string) {
  const [version, rawIv, rawTag, rawCiphertext, extra] = value.split(":");
  if (version !== "v1" || !rawIv || !rawTag || rawCiphertext === undefined || extra !== undefined) throw new Error("Unsupported encrypted payment field format");
  const decipher = createDecipheriv("aes-256-gcm", paymentKey(), Buffer.from(rawIv, "base64url"));
  decipher.setAuthTag(Buffer.from(rawTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(rawCiphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function paymentTransactionHash(method: string, transactionId: string) {
  return createHmac("sha256", paymentKey()).update(`transaction:${method}:${transactionId.trim().toUpperCase()}`).digest("hex");
}
