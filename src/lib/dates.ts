/**
 * Calendar dates are handled as plain "YYYY-MM-DD" strings end to end. The
 * pipeline buckets articles by UTC day and Postgres stores a bare DATE, so going
 * through a JS Date in the visitor's local timezone (as the old calendar did)
 * shifted "today" by a day for anyone west of UTC in the evening.
 */
export type ISODate = string;

/** Inauguration day; the archive starts here. */
export const FIRST_DAY: ISODate = "2025-01-20";

export interface YearMonth {
  year: number;
  /** 0-based, like Date#getUTCMonth. */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoFromParts(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseISODate(iso: ISODate): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y!, month: m! - 1, day: d! };
}

export function isValidISODate(value: string): value is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseISODate(value);
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}

export function todayUTC(now: Date = new Date()): ISODate {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(iso);
  return new Date(Date.UTC(year, month, day + days)).toISOString().slice(0, 10);
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** 0 = Sunday. */
export function firstWeekday({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

export function addMonths({ year, month }: YearMonth, n: number): YearMonth {
  const total = year * 12 + month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthOf(iso: ISODate): YearMonth {
  const { year, month } = parseISODate(iso);
  return { year, month };
}

export function clampDate(iso: ISODate, min: ISODate, max: ISODate): ISODate {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

const longFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export function formatLong(iso: ISODate): string {
  const { year, month, day } = parseISODate(iso);
  return longFormat.format(Date.UTC(year, month, day));
}

export function formatMonth({ year, month }: YearMonth): string {
  return monthFormat.format(Date.UTC(year, month, 1));
}
