-- Phase 8: efficient time-bounded admin analytics for save/favourite activity.
-- Additive indexes only; existing rows are preserved.
CREATE INDEX "saved_articles_createdAt_idx" ON "saved_articles"("createdAt");
CREATE INDEX "favourite_articles_createdAt_idx" ON "favourite_articles"("createdAt");
