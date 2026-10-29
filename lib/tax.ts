// Filing periods, tax estimates and due dates. Pure functions. Every setting
// comes from config/tax.ts, so confirming RSL's real rules only changes that file.

import { TAX, type TaxConfig } from "@/config/tax";
import { addDays, daysInMonth, inRange, ymd, type DateRange } from "./dates";
import { roundMoney } from "./ledger";
import type { Entry } from "./state";

// "2026-Q3" for quarterly filing, "2026-10" for monthly.
export function periodFor(date: string, config: TaxConfig = TAX): string {
  const [y, m] = date.split("-").map(Number);
  if (config.filingPeriod === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function isValidPeriod(period: string, config: TaxConfig = TAX): boolean {
  const pattern = config.filingPeriod === "monthly" ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-Q[1-4]$/;
  return pattern.test(period);
}

// First and last month (1 to 12) of a period.
function periodMonths(period: string): { year: number; first: number; last: number } {
  const year = Number(period.slice(0, 4));
  const quarter = period.match(/-Q([1-4])$/);
  if (quarter) {
    const q = Number(quarter[1]);
    return { year, first: q * 3 - 2, last: q * 3 };
  }
  const month = Number(period.slice(5, 7));
  return { year, first: month, last: month };
}

export function periodRange(period: string): DateRange {
  const { year, first, last } = periodMonths(period);
  return { start: ymd(year, first, 1), end: ymd(year, last, daysInMonth(year, last)) };
}

// Due on a set day of the month after the period ends. A day past the end of
// that month falls on its last day.
export function dueDate(period: string, config: TaxConfig = TAX): string {
  const { year, last } = periodMonths(period);
  const dueYear = last === 12 ? year + 1 : year;
  const dueMonth = last === 12 ? 1 : last + 1;
  const day = Math.min(config.dueDayAfterPeriodEnd, daysInMonth(dueYear, dueMonth));
  return ymd(dueYear, dueMonth, day);
}

export function reminderDate(period: string, config: TaxConfig = TAX): string {
  return addDays(dueDate(period, config), -config.reminderDaysBefore);
}

export function previousPeriod(period: string, config: TaxConfig = TAX): string {
  return periodFor(addDays(periodRange(period).start, -1), config);
}

// The period a trader should file next: the one that has ended but isn't due
// yet, or else the one running now.
export function filingPeriod(today: string, config: TaxConfig = TAX): string {
  const previous = previousPeriod(periodFor(today, config), config);
  return today <= dueDate(previous, config) ? previous : periodFor(today, config);
}

export function turnover(entries: Entry[], period: string): number {
  const range = periodRange(period);
  return roundMoney(
    entries.filter((e) => e.kind === "sale" && inRange(e.date, range)).reduce((s, e) => s + e.amount, 0),
  );
}

export function estimateTax(turnoverAmount: number, config: TaxConfig = TAX): number {
  return roundMoney(turnoverAmount * config.rateOnTurnover);
}

export type TaxEstimate = {
  period: string;
  start: string;
  end: string;
  turnover: number;
  rate: number;
  estimate: number;
  dueDate: string;
  placeholder: boolean;
  note: string | null; // the placeholder note, while rates are unconfirmed
};

export function taxEstimate(entries: Entry[], period: string, config: TaxConfig = TAX): TaxEstimate {
  const t = turnover(entries, period);
  return {
    period,
    ...periodRange(period),
    turnover: t,
    rate: config.rateOnTurnover,
    estimate: estimateTax(t, config),
    dueDate: dueDate(period, config),
    placeholder: config.placeholder,
    note: config.placeholder ? config.note : null,
  };
}
