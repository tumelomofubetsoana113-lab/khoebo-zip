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

// Problems with a tax config, as plain sentences. Empty when it is usable.
export function checkTaxConfig(config: TaxConfig): string[] {
  const problems: string[] = [];
  const { bands } = config;
  if (!(config.threshold >= 0)) problems.push("The threshold can't be negative.");
  if (bands.length === 0) problems.push("There must be at least one band.");
  bands.forEach((band, i) => {
    const last = i === bands.length - 1;
    if (!(band.rate >= 0 && band.rate <= 1)) problems.push(`Band ${i + 1}: the rate must be between 0 and 1.`);
    if (!(band.fixed >= 0)) problems.push(`Band ${i + 1}: the fixed amount can't be negative.`);
    if (last && band.upTo !== null) problems.push("The last band must have upTo: null.");
    if (!last && band.upTo === null) problems.push(`Band ${i + 1}: only the last band can have upTo: null.`);
    const previous = i > 0 ? bands[i - 1].upTo : 0;
    if (band.upTo !== null && previous !== null && !(band.upTo > previous)) {
      problems.push(`Band ${i + 1}: upTo must be higher than the band before.`);
    }
  });
  return problems;
}

// Share of a yearly amount that falls in one filing period.
function periodShare(config: TaxConfig): number {
  if (config.amountsPer === "period") return 1;
  return config.filingPeriod === "monthly" ? 1 / 12 : 1 / 4;
}

export type TaxWorking = {
  tax: number;
  rate: number; // rate of the band the turnover falls in
  fixed: number; // fixed amount added, already shared out for the period
  belowThreshold: boolean;
};

// Tax for one filing period's turnover, following the threshold and bands.
export function workOutTax(turnoverAmount: number, config: TaxConfig = TAX): TaxWorking {
  const problems = checkTaxConfig(config);
  if (problems.length > 0) throw new Error(`Tax settings in config/tax.ts: ${problems.join(" ")}`);

  const share = periodShare(config);
  const scaled = config.bands.map((band) => ({
    top: band.upTo === null ? Infinity : band.upTo * share,
    rate: band.rate,
    fixed: band.fixed * share,
  }));

  if (turnoverAmount <= config.threshold * share) {
    return { tax: 0, rate: 0, fixed: 0, belowThreshold: true };
  }

  const index = scaled.findIndex((band) => turnoverAmount <= band.top);
  const band = scaled[index];
  let fromRate: number;
  if (config.bandMethod === "whole") {
    fromRate = turnoverAmount * band.rate;
  } else {
    fromRate = 0;
    let bottom = 0;
    for (const b of scaled.slice(0, index + 1)) {
      fromRate += (Math.min(turnoverAmount, b.top) - bottom) * b.rate;
      bottom = b.top;
    }
  }
  return {
    tax: roundMoney(fromRate + band.fixed),
    rate: band.rate,
    fixed: roundMoney(band.fixed),
    belowThreshold: false,
  };
}

export function estimateTax(turnoverAmount: number, config: TaxConfig = TAX): number {
  return workOutTax(turnoverAmount, config).tax;
}

export type TaxEstimate = {
  period: string;
  start: string;
  end: string;
  turnover: number;
  rate: number; // rate of the band the turnover falls in
  fixed: number; // fixed amount included in the estimate
  belowThreshold: boolean;
  estimate: number;
  dueDate: string;
  placeholder: boolean;
  note: string | null; // the placeholder note, while rates are unconfirmed
};

export function taxEstimate(entries: Entry[], period: string, config: TaxConfig = TAX): TaxEstimate {
  const t = turnover(entries, period);
  const working = workOutTax(t, config);
  return {
    period,
    ...periodRange(period),
    turnover: t,
    rate: working.rate,
    fixed: working.fixed,
    belowThreshold: working.belowThreshold,
    estimate: working.tax,
    dueDate: dueDate(period, config),
    placeholder: config.placeholder,
    note: config.placeholder ? config.note : null,
  };
}
