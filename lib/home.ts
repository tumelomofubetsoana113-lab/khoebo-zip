// The trader's home page (added 19 November 2026): what a trader sees after
// logging in, before the chat. Pure functions: every figure comes from
// lib/ledger.ts, lib/tax.ts and the trader's own saved records, never from the
// model. Built in the browser, so the records never leave the phone.

import { addDays, weekdayName } from "./dates";
import { roundMoney, summarize, summaryRange, type Summary } from "./ledger";
import type { BusinessTotals } from "./blocks";
import { businessList, entriesFor, findBusinessReturn, hasSeveralBusinesses } from "./businesses";
import { returnsToFile, type ReturnToFile } from "./statement";
import type { TraderState } from "./state";
import { filingPeriod, taxEstimate } from "./tax";

// The chat, one tap from the home page.
export const CHAT_PATH = "/trader/chat";

export type HomePeriod = "this_week" | "this_month";

export type DaySales = {
  date: string;
  day: string; // "Mon"
  moneyIn: number;
  future: boolean; // later this week: nothing to show yet
};

export type NextReturn = {
  businessId: string;
  businessName?: string; // only for a trader with several businesses
  period: string;
  dueDate: string;
  filed: boolean;
  reference?: string;
  estimate: number; // the tax filed, or the estimate so far
};

export type Home = {
  hasRecords: boolean;
  totals: Record<HomePeriod, Summary>;
  byBusiness?: Record<HomePeriod, BusinessTotals[]>;
  week: DaySales[]; // Monday to Sunday of this week
  bestDay?: string; // date of this week's highest sales, when there were any
  late: ReturnToFile[]; // returns for periods that have ended and aren't filed
  next: NextReturn[];
};

function shortDay(date: string): string {
  return weekdayName(date).slice(0, 3);
}

export function buildHome(state: TraderState, today: string): Home {
  const periods: HomePeriod[] = ["this_week", "this_month"];
  const ranges = Object.fromEntries(periods.map((p) => [p, summaryRange(p, today)])) as Record<
    HomePeriod,
    ReturnType<typeof summaryRange>
  >;
  const totals = Object.fromEntries(
    periods.map((p) => [p, summarize(state.entries, ranges[p], today)]),
  ) as Record<HomePeriod, Summary>;

  const several = hasSeveralBusinesses(state);
  const businesses = businessList(state);
  const byBusiness = several
    ? (Object.fromEntries(
        periods.map((p) => [
          p,
          businesses.map((b) => {
            const s = summarize(entriesFor(state.entries, b.id), ranges[p], today);
            return { name: b.name, moneyIn: s.moneyIn, moneyOut: s.moneyOut, profit: s.profit };
          }),
        ]),
      ) as Record<HomePeriod, BusinessTotals[]>)
    : undefined;

  const week: DaySales[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(ranges.this_week.start, i);
    const moneyIn = roundMoney(
      state.entries.filter((e) => e.kind === "sale" && e.date === date).reduce((sum, e) => sum + e.amount, 0),
    );
    return { date, day: shortDay(date), moneyIn, future: date > today };
  });
  const best = week.reduce<DaySales | undefined>((top, d) => (d.moneyIn > (top?.moneyIn ?? 0) ? d : top), undefined);

  const period = filingPeriod(today);
  const late = returnsToFile(state, "all", today).filter((r) => r.period !== period);
  const next: NextReturn[] = businesses.map((b) => {
    const filed = findBusinessReturn(state, period, b.id);
    const estimate = taxEstimate(entriesFor(state.entries, b.id), period);
    return {
      businessId: b.id,
      ...(several ? { businessName: b.name } : {}),
      period,
      dueDate: estimate.dueDate,
      filed: Boolean(filed),
      ...(filed ? { reference: filed.reference } : {}),
      estimate: filed?.taxEstimate ?? estimate.estimate,
    };
  });

  return {
    hasRecords: state.entries.length > 0,
    totals,
    ...(byBusiness ? { byBusiness } : {}),
    week,
    ...(best ? { bestDay: best.date } : {}),
    late,
    next,
  };
}
