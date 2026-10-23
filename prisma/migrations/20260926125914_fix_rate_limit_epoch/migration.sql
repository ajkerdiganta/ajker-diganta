-- Preserve existing timestamp values as Unix epoch milliseconds when moving
-- Better Auth's rate-limit column to its required BIGINT representation.
ALTER TABLE "rateLimit"
  ALTER COLUMN "lastRequest" TYPE BIGINT
  USING ((EXTRACT(EPOCH FROM "lastRequest") * 1000)::BIGINT);
