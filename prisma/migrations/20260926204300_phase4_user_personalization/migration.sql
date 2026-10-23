-- CreateTable
CREATE TABLE "saved_articles" (
    "userId" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_articles_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "favourite_articles" (
    "userId" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favourite_articles_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "followed_topics" (
    "userId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followed_topics_pkey" PRIMARY KEY ("userId","tagId")
);

-- CreateTable
CREATE TABLE "followed_categories" (
    "userId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followed_categories_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateTable
CREATE TABLE "reading_history" (
    "userId" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "lastReadAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reading_history_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" UUID NOT NULL,
    "fontScale" VARCHAR(16) NOT NULL DEFAULT 'comfortable',
    "lowBandwidthMode" BOOLEAN NOT NULL DEFAULT false,
    "readingHistoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "saved_articles_articleId_userId_idx" ON "saved_articles"("articleId", "userId");

-- CreateIndex
CREATE INDEX "saved_articles_userId_createdAt_idx" ON "saved_articles"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "favourite_articles_articleId_userId_idx" ON "favourite_articles"("articleId", "userId");

-- CreateIndex
CREATE INDEX "favourite_articles_userId_createdAt_idx" ON "favourite_articles"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "followed_topics_tagId_userId_idx" ON "followed_topics"("tagId", "userId");

-- CreateIndex
CREATE INDEX "followed_topics_userId_createdAt_idx" ON "followed_topics"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "followed_categories_categoryId_userId_idx" ON "followed_categories"("categoryId", "userId");

-- CreateIndex
CREATE INDEX "followed_categories_userId_createdAt_idx" ON "followed_categories"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reading_history_userId_lastReadAt_idx" ON "reading_history"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "reading_history_articleId_lastReadAt_idx" ON "reading_history"("articleId", "lastReadAt");

-- AddForeignKey
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourite_articles" ADD CONSTRAINT "favourite_articles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourite_articles" ADD CONSTRAINT "favourite_articles_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_topics" ADD CONSTRAINT "followed_topics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_topics" ADD CONSTRAINT "followed_topics_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_categories" ADD CONSTRAINT "followed_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_categories" ADD CONSTRAINT "followed_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
