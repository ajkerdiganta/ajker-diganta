export const ANALYTICS_PERIODS = ["today", "7d", "30d", "custom"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export type AnalyticsRange = {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  /** UTC-midnight Date values for PostgreSQL DATE columns. */
  fromDate: Date;
  toDate: Date;
  /** Asia/Dhaka midnight instants for timestamptz events; end is exclusive. */
  startAt: Date;
  endExclusive: Date;
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/u;
const DHAKA_OFFSET = "+06:00";

function dateText(value: string | undefined) {
  if (!value || !dayPattern.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function dhakaDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "1970";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateSpanDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

function dhakaMidnight(value: string) {
  return new Date(`${value}T00:00:00.000${DHAKA_OFFSET}`);
}

export function resolveAnalyticsRange(input: { period?: string; from?: string; to?: string }, now = new Date()): AnalyticsRange {
  const today = dhakaDate(now);
  const requested = ANALYTICS_PERIODS.includes(input.period as AnalyticsPeriod) ? input.period as AnalyticsPeriod : "7d";
  let period: AnalyticsPeriod = requested;
  let from: string;
  let to = today;

  if (requested === "today") {
    from = today;
  } else if (requested === "30d") {
    from = shiftDate(today, -29);
  } else if (requested === "custom") {
    const customFrom = dateText(input.from);
    const customTo = dateText(input.to);
    if (!customFrom || !customTo) {
      period = "7d";
      from = shiftDate(today, -6);
    } else {
      from = customFrom;
      to = customTo;
      if (from > to) [from, to] = [to, from];
      // Keep unrestricted aggregate scans to a manageable maximum of 366 days.
      if (dateSpanDays(from, to) > 365) from = shiftDate(to, -365);
    }
  } else {
    from = shiftDate(today, -6);
  }

  return {
    period,
    from,
    to,
    fromDate: new Date(`${from}T00:00:00.000Z`),
    toDate: new Date(`${to}T00:00:00.000Z`),
    startAt: dhakaMidnight(from),
    endExclusive: dhakaMidnight(shiftDate(to, 1)),
  };
}
