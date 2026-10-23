"use client";

import { useEffect, useState } from "react";
import { Check, Eye, Share2 } from "lucide-react";

export function ArticleViewTracker({ slug, viewerKey }: { slug: string; viewerKey?: string }) {
  useEffect(() => {
    try {
      const key = `ajker-diganta:view:${viewerKey ?? "anonymous"}:${slug}`;
      const previous = Number(sessionStorage.getItem(key) ?? 0);
      if (previous && Date.now() - previous < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // Private browsing/sessionStorage restrictions must not break article reading.
    }
    void fetch(`/api/public/articles/${encodeURIComponent(slug)}/view`, { method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true }).catch(() => undefined);
  }, [slug, viewerKey]);
  return <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><Eye size={14} aria-hidden="true" /><span className="sr-only">পাঠ চলছে</span></span>;
}

export function VideoViewTracker({ slug, views }: { slug: string; views: bigint }) {
  useEffect(() => {
    try {
      const key = `ajker-diganta:video-view:${slug}`;
      const previous = Number(sessionStorage.getItem(key) ?? 0);
      if (previous && Date.now() - previous < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // Private mode may disallow sessionStorage; public video viewing should still work.
    }
    void fetch(`/api/public/videos/${encodeURIComponent(slug)}/view`, { method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true }).catch(() => undefined);
  }, [slug]);
  return <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><Eye size={14} aria-hidden="true" /><span>{views.toLocaleString("bn-BD")}</span><span className="sr-only">বার দেখা হয়েছে</span></span>;
}

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [state, setState] = useState<"idle" | "shared" | "copied" | "error">("idle");
  async function share() {
    const absolute = new URL(url, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title, url: absolute });
      else {
        await navigator.clipboard.writeText(absolute);
        setState("copied");
        window.setTimeout(() => setState("idle"), 2200);
        return;
      }
      setState("shared");
      window.setTimeout(() => setState("idle"), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState("error");
      window.setTimeout(() => setState("idle"), 2600);
    }
  }
  return <span className="inline-flex items-center gap-2"><button type="button" onClick={() => void share()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-forest transition hover:border-forest" aria-label="সংবাদটি শেয়ার করুন">{state === "copied" || state === "shared" ? <Check size={14} /> : <Share2 size={14} />}<span>{state === "copied" ? "লিংক কপি হয়েছে" : state === "shared" ? "শেয়ার করা হয়েছে" : state === "error" ? "শেয়ার করা যায়নি" : "শেয়ার"}</span></button><span aria-live="polite" className="sr-only">{state === "copied" ? "সংবাদের লিংক কপি হয়েছে" : ""}</span></span>;
}
