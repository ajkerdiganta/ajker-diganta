/** NFC preserves Bengali text; whitespace and Bengali/Unicode punctuation are token separators. */
export function normalizeSearchQuery(input: string) {
  return input.normalize("NFC")
    .replace(/[\u0964\u0965]/gu, " ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/[\p{White_Space}\u200B\uFEFF]+/gu, " ")
    .trim()
    .slice(0, 100)
    .trim();
}
