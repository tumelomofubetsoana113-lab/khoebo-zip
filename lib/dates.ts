// Calendar dates as "YYYY-MM-DD" strings, in Lesotho time. All maths is done
// in UTC on those strings, so the server's own time zone never matters.

export const TIME_ZONE = "Africa/Maseru";

const DAY_MS = 24 * 60 * 60 * 1000;

// Today's date in Lesotho.
export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = toUTC(date);
  return !Number.isNaN(d.getTime()) && fromUTC(d) === date;
}

export function addDays(date: string, days: number): string {
  return fromUTC(new Date(toUTC(date).getTime() + days * DAY_MS));
}

// Whole days from a to b (positive when b is later).
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / DAY_MS);
}

export function daysInMonth(year: number, month: number): number {
  // month is 1 to 12; day 0 of the next month is the last day of this one
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function ymd(year: number, month: number, day: number): string {
  return fromUTC(new Date(Date.UTC(year, month - 1, day)));
}

// Weeks run Monday to Sunday, so the weekly summary lands on Sunday.
export function weekStart(date: string): string {
  const weekday = toUTC(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export type DateRange = { start: string; end: string }; // both inclusive

export function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}
