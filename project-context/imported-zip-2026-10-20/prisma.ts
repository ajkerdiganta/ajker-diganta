import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaAdapter?: PrismaPg };

function createAdapter() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
    statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
    keepAlive: true,
  });
  pool.on("error", (error: Error & { code?: string }) => {
    console.error(JSON.stringify({ level: "error", event: "postgres.pool.error", code: error.code ?? "unknown" }));
  });
  return new PrismaPg(pool, { disposeExternalPool: true });
}
const adapter = globalForPrisma.prismaAdapter ?? createAdapter();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter, log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAdapter = adapter;
}
