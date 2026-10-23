export type VideoProviderCode = "YOUTUBE" | "CLOUDFLARE_STREAM";

export type ParsedHostedVideo = {
  provider: "YOUTUBE";
  externalId: string;
  canonicalUrl: string;
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseHostedVideoUrl(input: string): ParsedHostedVideo | null {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  let id = "";
  if (url.hostname.toLowerCase() === "youtu.be") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    id = parts[0] ?? "";
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v") ?? "";
  } else {
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/);
    id = match?.[1] ?? "";
  }
  if (!VIDEO_ID.test(id)) return null;
  return { provider: "YOUTUBE", externalId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
}

export function isValidHostedVideoUrl(input: string) {
  return parseHostedVideoUrl(input) !== null;
}

export function videoEmbedUrl(provider: VideoProviderCode, externalId: string): string | null {
  if (provider === "YOUTUBE" && VIDEO_ID.test(externalId)) return `https://www.youtube-nocookie.com/embed/${externalId}`;
  return null;
}

export function videoThumbnailUrl(provider: VideoProviderCode, externalId: string): string | null {
  if (provider === "YOUTUBE" && VIDEO_ID.test(externalId)) return `https://i.ytimg.com/vi/${externalId}/hqdefault.jpg`;
  return null;
}

export function isValidVideoThumbnailUrl(input: string, provider: VideoProviderCode, externalId: string) {
  const expectedPrefix = videoThumbnailUrl(provider, externalId);
  if (!expectedPrefix) return false;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com" && url.pathname.startsWith(`/vi/${externalId}/`) && /^\/vi\/[A-Za-z0-9_-]{11}\/(?:default|mqdefault|hqdefault|sddefault|maxresdefault)\.jpg$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function videoRouteSlug(_title: string, externalId: string) {
  return `video--yt-${externalId}`;
}
