import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL is required for integration tests.");
  const databaseName = new URL(testUrl).pathname.replace(/^\//, "").split("?")[0];
  if (!databaseName.endsWith("_test")) {
    throw new Error("Refusing to run integration tests: TEST_DATABASE_URL database name must end in _test.");
  }

  const testEnv: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: testUrl, MIGRATION_DATABASE_URL: testUrl, NODE_ENV: "test" };
  for (const args of [
    ["exec", "prisma", "migrate", "deploy"],
    ["exec", "tsx", "prisma/seed.ts"],
  ]) {
    const result = spawnSync("pnpm", args, { stdio: "inherit", env: testEnv });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  // The `_test` database name guard makes this safe: production databases are never accepted.
  const adapter = new PrismaPg({ connectionString: testUrl });
  const prisma = new PrismaClient({ adapter });
  try {
    await prisma.rateLimit.deleteMany();
  } finally {
    await prisma.$disconnect();
  }

  const result = spawnSync("pnpm", ["exec", "vitest", "--config", "vitest.integration.config.mts", "run"], { stdio: "inherit", env: testEnv });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error("Integration test runner failed", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
});
