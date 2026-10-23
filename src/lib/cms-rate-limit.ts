import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function allowCmsMutation(actorId: string, bucket: string, limit = 60, windowMs = 60_000) {
  const now = BigInt(Date.now());
  const start = now - BigInt(windowMs);
  const key = createHash("sha256").update(`${actorId}:${bucket}`).digest("hex");
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (gen_random_uuid(), ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rateLimit"."lastRequest" < ${start} THEN 1 ELSE "rateLimit"."count" + 1 END,
      "lastRequest" = ${now}
    RETURNING "count"
  `);
  return (rows[0]?.count ?? limit + 1) <= limit;
}
