# Cloudflare Compatibility Audit

## Sources

- [1] [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/): Cloudflare lists App Router, Route Handlers, React Server Components, SSR, ISR, Server Actions, middleware and streaming as supported by the OpenNext adapter; Node.js middleware is not yet supported. The guide requires `nodejs_compat`, a Wrangler configuration, `open-next.config.ts`, and OpenNext build/preview/deploy scripts.
- [2] [OpenNext Cloudflare](https://opennext.js.org/cloudflare): `@opennextjs/cloudflare` supports all minor and patch versions of Next.js 16 and uses the Next.js Node.js runtime; it documents Workers size limits and Cloudflare deployment behavior.
- [3] [Cloudflare Next.js / vinext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/): Cloudflare currently recommends vinext for new or migrated Next.js 16 applications, but describes vinext as beta and instructs existing applications to run `vinext check` before adoption.
- [4] [Cloudflare Hyperdrive Prisma ORM](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/): Prisma with PostgreSQL on Workers is supported through `@prisma/adapter-pg` and a Hyperdrive connection string; `pg` must be compatible with Hyperdrive and the Worker must use Node.js compatibility.
- [5] [Cloudflare Hyperdrive node-postgres](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/): `pg` 8.16.3+ is the recommended PostgreSQL driver for Hyperdrive and uses a per-request client over Hyperdrive's pooled connection.
- [6] [Cloudflare Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/): Workers provides supported or partial Node.js APIs under the compatibility model, but native modules and non-functional stubs remain runtime-specific risks.
- [7] [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/): production secrets should be stored as Worker secrets or dashboard secrets, not in Wrangler variables or committed files; `.env` and `.dev.vars` must remain untracked.

## Initial repository findings

- Existing stack: Next.js 16.3.6 App Router, React 19, TypeScript, Prisma 7.10.0, PostgreSQL through `@prisma/adapter-pg` and `pg`, Better Auth, native `@node-rs/argon2`, `sharp`, AWS S3 SDK for S3-compatible media/R2 storage, and Resend HTTP email.
- Existing repository has no `wrangler`, OpenNext, vinext, or Cloudflare deployment configuration. The current managed `origin` is a Manus artifact repository; no GitHub remote is configured yet.
- The application explicitly uses Node.js runtime on multiple API routes and server-side auth/database code. It is not a static Pages export.
- PostgreSQL is an explicit project requirement and must not be migrated. Cloudflare's compatible path is Workers plus external PostgreSQL through Hyperdrive or another supported connection strategy.
- Confirmed likely compatibility: Next.js 16 App Router, SSR, Route Handlers, Server Actions, Better Auth's fetch-based email provider, and Prisma's existing `@prisma/adapter-pg` dependency are aligned with the OpenNext/Hyperdrive model.
- Potential or blocking compatibility items to verify: native Argon2 and Sharp binaries in the Workers runtime; current `Pool` construction in `src/lib/prisma.ts` versus the Hyperdrive adapter pattern; S3-compatible media upload behavior and R2 endpoint configuration; scheduled publication endpoint execution; Worker bundle size; and any Node-only transitive dependency.

No production deployment, database migration, DNS change, or secret publication has been performed by this audit.

## Verification performed

`pnpm dlx vinext check` completed with 98% compatibility: 20 supported items, one partial image-optimization item, and zero reported source-level issues. The existing Next.js build also completed inside the OpenNext command, including compilation, TypeScript, static generation, and route collection.

The OpenNext Workers bundle did not complete. It failed while bundling the native `@node-rs/argon2` `.node` binary, before a Worker preview could start. This is a real runtime-adapter blocker, not a lint or type error. The image-finalization route also imports native `sharp`, so replacing Argon2 alone would require a second Workers-runtime validation.

The ordinary Node Preview remains healthy after regenerating the ignored Prisma client: `/api/health` returned database `ok`, `/manus-routes.json` returned the route manifest, and `/api/subscription-packages` returned the public catalog without price fields. Cloudflare Preview was not claimed as working because the OpenNext bundle failed.

The Cloudflare adapter files now present are `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`, and the package scripts `preview:cloudflare`, `upload:cloudflare`, `deploy:cloudflare`, and `cf-typegen`. No Hyperdrive ID, Cloudflare secret, R2 binding, production database, DNS record, or deployment was created or changed. A real Hyperdrive binding and runtime secret setup are still required for a production Workers path.

## Decision gate

Do not deploy this commit to Workers yet. Keep the current Node.js origin for production unless the project owner approves a focused follow-up to replace or isolate native password hashing and image conversion, adapt the Prisma connection to a real Hyperdrive binding, and run full auth, upload, scheduled publication, cache, and database smoke tests in a disposable Cloudflare environment.
