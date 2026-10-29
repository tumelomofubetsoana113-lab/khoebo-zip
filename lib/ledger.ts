// Entries, totals and summaries. Pure functions: every amount the assistant
// shows comes from here or from lib/tax.ts, never from the model.

import { addDays, daysBetween, daysInMonth, inRange, isValidDate, weekStart, ymd, type DateRange } from "./dates";
import type { Entry } from "./state";

export const LARGE_AMOUNT = 20_000; // above this, the assistant asks before recording
export const MAX_DAYS_BACK = 60;

// Maloti, rounded to 2 decimals. EPSILON stops 1.005 from rounding down.
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// "M1,840", or "M12.50" when there are cents.
export function formatMoney(n: number): string {
  const rounded = roundMoney(n);
  const cents = Number.isInteger(rounded) ? 0 : 2;
  const text = Math.abs(rounded).toLocaleString("en-US", {
    minimumFractionDigits: cents,
    maximumFractionDigits: cents,
  });
  return `${rounded < 0 ? "-" : ""}M${text}`;
}

export type AmountInput = { amount?: number; quantity?: number; unitPrice?: number };

export type EntryCheck =
  | { ok: true; amount: number; date: string }
  | {
      ok: false;
      error:
        | "missing_amount"
        | "invalid_amount"
        | "invalid_date"
        | "date_in_future"
        | "date_too_old"
        | "needs_confirmation";
      amount?: number;
    };

// Works out and checks a new entry's amount and date. Quantity times unit
// price is done here, never by the model.
export function checkEntry(
  input: AmountInput & { date?: string; confirmed?: boolean },
  today: string,
): EntryCheck {
  let amount: number;
  if (input.amount !== undefined) {
    amount = input.amount;
  } else if (input.quantity !== undefined && input.unitPrice !== undefined) {
    amount = input.quantity * input.unitPrice;
  } else {
    return { ok: false, error: "missing_amount" };
  }
  if (!Number.isFinite(amount)) return { ok: false, error: "invalid_amount" };
  amount = roundMoney(amount);
  if (amount <= 0) return { ok: false, error: "invalid_amount", amount };

  const date = input.date ?? today;
  if (!isValidDate(date)) return { ok: false, error: "invalid_date" };
  if (date > today) return { ok: false, error: "date_in_future" };
  if (daysBetween(date, today) > MAX_DAYS_BACK) return { ok: false, error: "date_too_old" };

  if (amount > LARGE_AMOUNT && !input.confirmed) {
    return { ok: false, error: "needs_confirmation", amount };
  }
  return { ok: true, amount, date };
}

// The most recently recorded entry (by when it was recorded, not its date).
export function lastEntry(entries: Entry[]): Entry | undefined {
  return entries.reduce<Entry | undefined>(
    (latest, e) => (!latest || e.createdAt >= latest.createdAt ? e : latest),
    undefined,
  );
}

export type Correction =
  | { ok: true; entries: Entry[]; before: Entry; after: Entry | null }
  | { ok: false; error: "not_found" | "nothing_to_change" | "invalid_amount" };

// Changes the amount of one entry, or removes it.
export function correctEntry(
  entries: Entry[],
  target: string, // an entry id, or "last"
  change: { newAmount?: number; delete?: boolean },
): Correction {
  const before = target === "last" ? lastEntry(entries) : entries.find((e) => e.id === target);
  if (!before) return { ok: false, error: "not_found" };

  if (change.delete) {
    return { ok: true, entries: entries.filter((e) => e.id !== before.id), before, after: null };
  }
  if (change.newAmount === undefined) return { ok: false, error: "nothing_to_change" };
  if (!Number.isFinite(change.newAmount)) return { ok: false, error: "invalid_amount" };
  const amount = roundMoney(change.newAmount);
  if (amount <= 0) return { ok: false, error: "invalid_amount" };

  const after = { ...before, amount };
  return { ok: true, entries: entries.map((e) => (e.id === before.id ? after : e)), before, after };
}

export type SummaryPeriod = "this_week" | "last_week" | "this_month";

export function summaryRange(period: SummaryPeriod, today: string): DateRange {
  if (period === "this_month") {
    const [y, m] = today.split("-").map(Number);
    return { start: ymd(y, m, 1), end: ymd(y, m, daysInMonth(y, m)) };
  }
  const start = addDays(weekStart(today), period === "last_week" ? -7 : 0);
  return { start, end: addDays(start, 6) };
}

export type Summary = DateRange & {
  moneyIn: number;
  moneyOut: number;
  profit: number; // an estimate: money in minus money out
  entryCount: number;
  daysWithNoEntries: number; // counted only up to today
};

export function summarize(entries: Entry[], range: DateRange, today: string): Summary {
  const inPeriod = entries.filter((e) => inRange(e.date, range));
  const moneyIn = roundMoney(inPeriod.filter((e) => e.kind === "sale").reduce((s, e) => s + e.amount, 0));
  const moneyOut = roundMoney(
    inPeriod.filter((e) => e.kind === "purchase").reduce((s, e) => s + e.amount, 0),
  );

  const lastDay = range.end < today ? range.end : today;
  const daysSoFar = lastDay < range.start ? 0 : daysBetween(range.start, lastDay) + 1;
  const daysWithEntries = new Set(inPeriod.filter((e) => e.date <= lastDay).map((e) => e.date)).size;

  return {
    ...range,
    moneyIn,
    moneyOut,
    profit: roundMoney(moneyIn - moneyOut),
    entryCount: inPeriod.length,
    daysWithNoEntries: daysSoFar - daysWithEntries,
  };
}
