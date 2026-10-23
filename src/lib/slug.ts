import { randomBytes } from "node:crypto";
import { slugify } from "transliteration";

const RESERVED = new Set(["admin", "api", "news", "login", "register", "category", "author"]);

export function asciiSlug(value: string): string {
  const generated = slugify(value.normalize("NFC"), { lowercase: true, separator: "-" })
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = generated || "news";
  return RESERVED.has(base) ? `${base}-news` : base;
}

export async function uniqueSlug(value: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const base = asciiSlug(value).slice(0, 150).replace(/-+$/g, "") || "news";
  if (!(await exists(base))) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${randomBytes(4).toString("hex")}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Slug collision retry limit reached");
}
