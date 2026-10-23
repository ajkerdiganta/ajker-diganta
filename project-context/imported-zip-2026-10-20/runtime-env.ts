import { env as cloudflareEnv } from "cloudflare:workers";

type RuntimeEnv = Record<string, string | undefined>;

export function getRuntimeEnv(): RuntimeEnv {
  const workerBindings = (cloudflareEnv ?? {}) as Record<string, unknown>;
  const nodeEnv = typeof process !== "undefined" ? process.env : {};
  const merged: RuntimeEnv = {};
  for (const [key, value] of Object.entries(workerBindings)) {
    if (typeof value === "string") merged[key] = value;
  }
  for (const [key, value] of Object.entries(nodeEnv)) {
    if (typeof value === "string") merged[key] = value;
  }
  return merged;
}
