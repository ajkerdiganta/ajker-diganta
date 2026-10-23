import { describe, expect, it } from "vitest";
import { isValidVideoThumbnailUrl, parseHostedVideoUrl, videoEmbedUrl, videoRouteSlug, videoThumbnailUrl } from "@/lib/video-provider";
import { videoInputSchema } from "@/lib/video-schemas";

const videoId = "BaW_jenozKc";

describe("video provider adapter", () => {
  it.each([
    `https://www.youtube.com/watch?v=${videoId}&t=15`,
    `https://youtu.be/${videoId}`,
    `https://www.youtube.com/embed/${videoId}`,
    `https://m.youtube.com/shorts/${videoId}`,
    `https://www.youtube.com/live/${videoId}`,
  ])("accepts and canonicalizes YouTube video URL %s", (url) => {
    expect(parseHostedVideoUrl(url)).toEqual({ provider: "YOUTUBE", externalId: videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` });
  });

  it.each([
    `http://www.youtube.com/watch?v=${videoId}`,
    `https://youtube.com.evil.invalid/watch?v=${videoId}`,
    `https://www.youtube.com.evil.invalid/watch?v=${videoId}`,
    `https://user@www.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/watch?v=${videoId}x`,
    `https://youtu.be/${videoId}/extra`,
    `https://vimeo.com/${videoId}`,
    "javascript:alert(1)",
    "not-a-url",
  ])("rejects unsafe/invalid hosted URL %s", (url) => expect(parseHostedVideoUrl(url)).toBeNull());

  it("creates provider-derived privacy-enhanced embeds and thumbnail URLs only for valid immutable IDs", () => {
    expect(videoEmbedUrl("YOUTUBE", videoId)).toBe(`https://www.youtube-nocookie.com/embed/${videoId}`);
    expect(videoEmbedUrl("CLOUDFLARE_STREAM", videoId)).toBeNull();
    expect(videoEmbedUrl("YOUTUBE", "bad")).toBeNull();
    const thumbnail = videoThumbnailUrl("YOUTUBE", videoId)!;
    expect(thumbnail).toBe(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    expect(isValidVideoThumbnailUrl(thumbnail, "YOUTUBE", videoId)).toBe(true);
    expect(isValidVideoThumbnailUrl(`https://evil.invalid/vi/${videoId}/hqdefault.jpg`, "YOUTUBE", videoId)).toBe(false);
    expect(isValidVideoThumbnailUrl(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?tracking=1`, "YOUTUBE", videoId)).toBe(false);
  });

  it("keeps legacy video route slugs stable despite Bengali title edits", () => {
    expect(videoRouteSlug("ঢাকার সংবাদ সাক্ষাৎকার", videoId)).toBe(`video--yt-${videoId}`);
    expect(videoRouteSlug("পরিবর্তিত বাংলা শিরোনাম", videoId)).toBe(`video--yt-${videoId}`);
  });
});

describe("video CMS input validation", () => {
  const base = {
    title: "বাংলা সংবাদ বিশ্লেষণ",
    description: "বাংলাদেশের বর্তমান বিষয় নিয়ে ভিডিও প্রতিবেদন।",
    provider: "YOUTUBE",
    videoUrl: `https://youtu.be/${videoId}`,
    durationSeconds: 345,
    categoryId: "0c2a6eb8-c12a-4d50-91b1-6f8ba15aa714",
    tagIds: [],
    authorId: "d21fbc68-c80a-4f1e-a9b9-4a68c53843e3",
    relatedArticleIds: [],
    seoTitle: "বাংলা SEO শিরোনাম",
    seoDescription: "বাংলা SEO বিবরণ।",
  };

  it("preserves Bengali Unicode and bounded durations", () => {
    const result = videoInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toContain("বাংলা");
    expect(videoInputSchema.safeParse({ ...base, durationSeconds: -1 }).success).toBe(false);
    expect(videoInputSchema.safeParse({ ...base, durationSeconds: 86_401 }).success).toBe(false);
  });

  it("rejects unexpected owner/status fields and malformed transliterated slugs", () => {
    expect(videoInputSchema.safeParse({ ...base, createdById: "attacker" }).success).toBe(false);
    expect(videoInputSchema.safeParse({ ...base, status: "PUBLISHED" }).success).toBe(false);
    expect(videoInputSchema.safeParse({ ...base, slug: "বাংলা-শিরোনাম" }).success).toBe(false);
    expect(videoInputSchema.safeParse({ ...base, slug: "valid-ascii-video-slug" }).success).toBe(true);
  });
});
