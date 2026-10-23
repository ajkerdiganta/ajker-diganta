-- CreateTable
CREATE TABLE "ArticleDailyMetric" (
    "articleId" UUID NOT NULL,
    "metricDate" DATE NOT NULL,
    "views" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleDailyMetric_pkey" PRIMARY KEY ("articleId","metricDate")
);

-- CreateIndex
CREATE INDEX "ArticleDailyMetric_metricDate_views_idx" ON "ArticleDailyMetric"("metricDate", "views");

-- AddForeignKey
ALTER TABLE "ArticleDailyMetric" ADD CONSTRAINT "ArticleDailyMetric_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

