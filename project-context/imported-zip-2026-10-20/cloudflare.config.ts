import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

const cache = await createWorkersCacheConfig();

export default defineConfig({
  worker: defineWorker({
    ...cache,
    name: "ajker-diganta",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-18",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ...cache.env,
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      VINEXT_KV_CACHE: bindings.kv(),
      DATABASE_URL: bindings.secret(),
      DATABASE_POOL_MAX: bindings.secret(),
      DATABASE_IDLE_TIMEOUT_MS: bindings.secret(),
      DATABASE_CONNECTION_TIMEOUT_MS: bindings.secret(),
      DATABASE_STATEMENT_TIMEOUT_MS: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      BETTER_AUTH_URL: bindings.secret(),
      ADDITIONAL_TRUSTED_ORIGINS: bindings.secret(),
      RESEND_API_KEY: bindings.secret(),
      EMAIL_FROM: bindings.secret(),
      PUBLIC_SITE_URL: bindings.secret(),
      R2_ENDPOINT: bindings.secret(),
      R2_BUCKET: bindings.secret(),
      R2_ACCESS_KEY_ID: bindings.secret(),
      R2_SECRET_ACCESS_KEY: bindings.secret(),
      R2_PUBLIC_BASE_URL: bindings.secret(),
      MEDIA_MAX_BYTES: bindings.secret(),
      JOB_AUTH_SECRET: bindings.secret(),
      NEXT_PHASE: bindings.secret(),
      NODE_ENV: bindings.secret(),
    },
  }),
});
