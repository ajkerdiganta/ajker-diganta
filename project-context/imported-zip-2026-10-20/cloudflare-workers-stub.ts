export const env: Record<string, string | undefined> =
  typeof process === "undefined" ? {} : process.env;
