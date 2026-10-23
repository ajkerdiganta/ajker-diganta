import { z } from "zod";
import { validateProductionEnv } from "@/lib/env-validation";

const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.url().optional());
const optionalText = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const boundedInt = (fallback: number, min: number, max: number) => z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(min).max(max).default(fallback));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: boundedInt(5, 1, 100),
  DATABASE_IDLE_TIMEOUT_MS: boundedInt(10_000, 1_000, 300_000),
  DATABASE_CONNECTION_TIMEOUT_MS: boundedInt(5_000, 500, 60_000),
  DATABASE_STATEMENT_TIMEOUT_MS: boundedInt(30_000, 1_000, 300_000),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  ADDITIONAL_TRUSTED_ORIGINS: z.string().default("").transform((value) =>
    value.split(",").map((origin) => origin.trim()).filter(Boolean),
  ),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Dainik Ajker Diganta <accounts@example.com>"),
  PUBLIC_SITE_URL: z.url().optional(),
  R2_ENDPOINT: optionalUrl,
  R2_BUCKET: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_PUBLIC_BASE_URL: optionalUrl,
  MEDIA_MAX_BYTES: z.coerce.number().int().min(1024).max(50 * 1024 * 1024).default(10 * 1024 * 1024),
  JOB_AUTH_SECRET: z.string().min(32).optional(),
  NEXT_PHASE: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsedEnv = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
  DATABASE_IDLE_TIMEOUT_MS: process.env.DATABASE_IDLE_TIMEOUT_MS,
  DATABASE_CONNECTION_TIMEOUT_MS: process.env.DATABASE_CONNECTION_TIMEOUT_MS,
  DATABASE_STATEMENT_TIMEOUT_MS: process.env.DATABASE_STATEMENT_TIMEOUT_MS,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  ADDITIONAL_TRUSTED_ORIGINS: process.env.ADDITIONAL_TRUSTED_ORIGINS,
  RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
  EMAIL_FROM: process.env.EMAIL_FROM,
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  MEDIA_MAX_BYTES: process.env.MEDIA_MAX_BYTES,
  JOB_AUTH_SECRET: process.env.JOB_AUTH_SECRET || undefined,
  NEXT_PHASE: process.env.NEXT_PHASE,
  NODE_ENV: process.env.NODE_ENV,
});

validateProductionEnv(parsedEnv);
export const env = parsedEnv;
