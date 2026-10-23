import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import sanitizeHtml from "sanitize-html";
import { createEditorExtensions } from "@/lib/editor-extensions";

const MAX_BODY_BYTES = 1_500_000;
const MAX_JSON_NODES = 20_000;
const MAX_JSON_DEPTH = 64;
const ALLOWED_TAGS = ["p", "br", "h2", "h3", "strong", "b", "em", "i", "s", "u", "ul", "ol", "li", "blockquote", "figure", "figcaption", "img", "a", "hr", "pre", "code"];
const ALLOWED_NODES = new Set(["doc", "paragraph", "text", "heading", "blockquote", "bulletList", "orderedList", "listItem", "hardBreak", "horizontalRule", "codeBlock", "image"]);
const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

export type NormalizedBody = { json: JSONContent; html: string; mediaIds: string[] };

function collectImageMediaIds(node: JSONContent, found: Set<string>) {
  if (node.type === "image") {
    const mediaId = node.attrs?.mediaId;
    if (typeof mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(mediaId)) {
      throw new Error("ছবি অবশ্যই যাচাইকৃত মিডিয়া লাইব্রেরি থেকে নির্বাচন করুন");
    }
    found.add(mediaId);
  }
  for (const child of node.content ?? []) collectImageMediaIds(child, found);
}

function assertBoundedJson(value: unknown) {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++nodes > MAX_JSON_NODES) throw new Error("এডিটরের তথ্যের কাঠামো খুব বড়");
    if (current.depth > MAX_JSON_DEPTH) throw new Error("এডিটরের তথ্যের স্তরসীমা অতিক্রম করেছে");
    if (current.value === null || typeof current.value !== "object") continue;
    if (seen.has(current.value)) throw new Error("এডিটরের তথ্যের কাঠামো সঠিক নয়");
    seen.add(current.value);
    const children = Array.isArray(current.value) ? current.value : Object.values(current.value);
    for (const child of children) pending.push({ value: child, depth: current.depth + 1 });
  }
}

function sanitizerOptions() {
  return {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel"],
      figure: ["class"],
      img: ["src", "alt", "title", "data-media-id", "loading"],
      code: ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer" }),
      img: (_tagName: string, attributes: Record<string, string>) => {
        const mediaId = attributes["data-media-id"];
        if (!mediaId || !/^[0-9a-f-]{36}$/i.test(mediaId)) return { tagName: "span", attribs: {} };
        return { tagName: "img", attribs: { ...attributes, src: `/api/media/${mediaId}`, loading: "lazy" } };
      },
    },
    exclusiveFilter: (frame: { tag: string; attribs: Record<string, string> }) => frame.tag === "img" && !/^[0-9a-f-]{36}$/i.test(frame.attribs["data-media-id"] ?? ""),
  };
}

export function sanitizePublicArticleHtml(value: string) {
  return sanitizeHtml(value.slice(0, MAX_BODY_BYTES), sanitizerOptions());
}

export function normalizeArticleBody(body: unknown): NormalizedBody {
  assertBoundedJson(body);
  const serialized = JSON.stringify(body);
  if (!serialized || Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) throw new Error("সংবাদের মূল লেখা অনেক বড়");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("সংবাদের মূল লেখা সঠিক ফরম্যাটে নেই");
  const input = body as JSONContent;
  if (input.type !== "doc" || !Array.isArray(input.content)) throw new Error("সংবাদের মূল লেখা সঠিক ফরম্যাটে নেই");
  const json = structuredClone(input);
  const sanitizeTree = (node: JSONContent) => {
    if (!node.type || !ALLOWED_NODES.has(node.type)) throw new Error("এডিটরে অসমর্থিত content block রয়েছে");
    if (node.type === "heading" && ![2, 3].includes(Number(node.attrs?.level))) throw new Error("শিরোনামের স্তর অনুমোদিত নয়");
    if (node.marks) {
      node.marks = node.marks.filter((mark) => ALLOWED_MARKS.has(mark.type ?? ""));
      for (const mark of node.marks) {
        if (mark.type === "link") {
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
          let safe = false;
          try { safe = ["https:", "http:", "mailto:"].includes(new URL(href).protocol); } catch { safe = false; }
          if (!safe) { node.marks = node.marks.filter((candidate) => candidate !== mark); continue; }
          mark.attrs = { href: new URL(href).toString() };
        }
      }
    }
    if (node.type === "image") {
      const mediaId = node.attrs?.mediaId;
      if (typeof mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(mediaId)) throw new Error("ছবি অবশ্যই যাচাইকৃত মিডিয়া লাইব্রেরি থেকে নির্বাচন করুন");
      node.attrs = { mediaId, src: `/api/media/${mediaId}`, alt: typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 250) : "", title: typeof node.attrs?.title === "string" ? node.attrs.title.slice(0, 250) : null, caption: typeof node.attrs?.caption === "string" ? node.attrs.caption.slice(0, 500) : null };
    } else {
      node.attrs = node.type === "heading" ? { level: Number(node.attrs?.level) } : undefined;
    }
    for (const child of node.content ?? []) sanitizeTree(child);
  };
  sanitizeTree(json);
  const mediaIds = new Set<string>();
  collectImageMediaIds(json, mediaIds);
  const html = generateHTML(json, createEditorExtensions());
  return { json, html: sanitizeHtml(html, sanitizerOptions()), mediaIds: [...mediaIds] };
}
