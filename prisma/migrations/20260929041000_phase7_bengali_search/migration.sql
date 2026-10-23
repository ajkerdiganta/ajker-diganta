-- Phase 7: indexed Unicode substring search.
-- PostgreSQL pg_trgm indexes accelerate LIKE/ILIKE substring matching without
-- relying on language dictionaries that do not stem Bengali correctly.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "categories_search_name_trgm_idx" ON "Category" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "categories_search_description_trgm_idx" ON "Category" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "tags_search_name_trgm_idx" ON "Tag" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "authors_search_name_trgm_idx" ON "Author" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "authors_search_title_trgm_idx" ON "Author" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "authors_search_bio_trgm_idx" ON "Author" USING GIN ("bio" gin_trgm_ops);
CREATE INDEX "articles_search_title_trgm_idx" ON "Article" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "articles_search_subtitle_trgm_idx" ON "Article" USING GIN ("subtitle" gin_trgm_ops);
CREATE INDEX "articles_search_excerpt_trgm_idx" ON "Article" USING GIN ("excerpt" gin_trgm_ops);
CREATE INDEX "articles_search_body_html_trgm_idx" ON "Article" USING GIN ("bodyHtml" gin_trgm_ops);
CREATE INDEX "videos_search_title_trgm_idx" ON "Video" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "videos_search_description_trgm_idx" ON "Video" USING GIN ("description" gin_trgm_ops);
