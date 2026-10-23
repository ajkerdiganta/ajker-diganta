import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const confirmedEmail = process.argv[3] === "--confirm" ? process.argv[4]?.trim().toLowerCase() : undefined;
  if (!email || confirmedEmail !== email) {
    console.error("Usage: pnpm admin:promote existing-account@example.com --confirm existing-account@example.com");
    process.exitCode = 2;
    return;
  }

  const databaseUrl = process.env.NODE_ENV === "production"
    ? process.env.MIGRATION_DATABASE_URL
    : process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(process.env.NODE_ENV === "production"
      ? "MIGRATION_DATABASE_URL is required for production admin promotion."
      : "DATABASE_URL is required for admin promotion.");
    process.exitCode = 2;
    return;
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true, emailVerified: true } });
    if (!user || user.status !== "ACTIVE" || !user.emailVerified) {
      throw new Error("Promotion requires an existing active account with a verified email address.");
    }
    const role = await prisma.role.findUnique({ where: { code: "ADMIN" } });
    if (!role) throw new Error("ADMIN role is missing; run pnpm db:seed first.");
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    console.info(`ADMIN role assigned to existing user ${user.email}.`);
  } catch (error) {
    if (error instanceof Error && error.message === "Promotion requires an existing active account with a verified email address.") {
      console.error(error.message);
    } else if (error instanceof Error && error.message === "ADMIN role is missing; run pnpm db:seed first.") {
      console.error(error.message);
    } else {
      console.error("Promotion failed. Verify database connectivity and account eligibility.");
      console.error(`Failure type: ${error instanceof Error ? error.name : "unknown error"}`);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("Promotion command failed", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
});
