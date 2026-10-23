const fullDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" });
const localTime = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", hour12: true });
const shortDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" });

export function formatBangladeshDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : fullDate.format(date).replaceAll(",", "");
}

export function formatBangladeshDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hourCycle: "h23" }).format(date));
  const period = hour < 5 || hour >= 20 ? "রাত" : hour < 12 ? "সকাল" : hour < 16 ? "দুপুর" : "বিকেল";
  return `${formatBangladeshDate(date)} · ${period} ${localTime.format(date).replace(/\s*(AM|PM)$/i, "")}`;
}

export function formatBangladeshShortDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : shortDate.format(date);
}

export function localTimeLine(now = new Date()) {
  return `${formatBangladeshDate(now)} · ঢাকা`;
}
