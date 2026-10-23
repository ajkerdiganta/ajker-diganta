import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const datasourceUrl = process.env.NODE_ENV === "production"
  ? env("MIGRATION_DATABASE_URL")
  : process.env.MIGRATION_DATABASE_URL ?? env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
