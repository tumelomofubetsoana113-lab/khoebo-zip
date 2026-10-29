import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isValidDate, todayISO, weekStart } from "@/lib/dates";
import {
  checkEntry,
  correctEntry,
  formatMoney,
  lastEntry,
  roundMoney,
  summarize,
  summaryRange,
} from "@/lib/ledger";
import type { Entry } from "@/lib/state";

const TODAY = "2026-10-29"; // a Thursday

let n = 0;
function entry(kind: Entry["kind"], amount: number, date: string, createdAt?: string): Entry {
  n += 1;
  return {
    id: `e${n}`,
    kind,
    amount,
    date,
    source: "text",
    createdAt: createdAt ?? `${date}T10:00:${String(n % 60).padStart(2, "0")}.000Z`,
  };
}

describe("dates", () => {
  it("gives today's date in Lesotho time (UTC+2)", () => {
    expect(todayISO(new Date("2026-10-29T21:59:00Z"))).toBe("2026-10-29");
    expect(todayISO(new Date("2026-10-29T22:01:00Z"))).toBe("2026-10-30");
  });

  it("checks dates", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("29-10-2026")).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-08-30", "2026-10-29")).toBe(60);
  });

  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-29")).toBe("2026-10-26"); // Thursday
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
  });
});

describe("money", () => {
  it("rounds to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(350)).toBe(350);
  });

  it("formats as maloti", () => {
    expect(formatMoney(1840)).toBe("M1,840");
    expect(formatMoney(74430)).toBe("M74,430");
    expect(formatMoney(12.5)).toBe("M12.50");
    expect(formatMoney(0)).toBe("M0");
    expect(formatMoney(-720)).toBe("-M720");
  });
});

describe("checkEntry", () => {
  it("accepts a plain amount, dated today by default", () => {
    expect(checkEntry({ amount: 350 }, TODAY)).toEqual({ ok: true, amount: 350, date: TODAY });
  });

  it("works out quantity times unit price", () => {
    expect(checkEntry({ quantity: 3, unitPrice: 120 }, TODAY)).toMatchObject({ ok: true, amount: 360 });
    expect(checkEntry({ quantity: 3, unitPrice: 0.1 }, TODAY)).toMatchObject({ ok: true, amount: 0.3 });
  });

  it("rounds amounts to cents", () => {
    expect(checkEntry({ amount: 10.456 }, TODAY)).toMatchObject({ ok: true, amount: 10.46 });
  });

  it("rejects missing, zero and negative amounts", () => {
    expect(checkEntry({}, TODAY)).toMatchObject({ ok: false, error: "missing_amount" });
    expect(checkEntry({ quantity: 3 }, TODAY)).toMatchObject({ ok: false, error: "missing_amount" });
    expect(checkEntry({ amount: 0 }, TODAY)).toMatchObject({ ok: false, error: "invalid_amount" });
    expect(checkEntry({ amount: -50 }, TODAY)).toMatchObject({ ok: false, error: "invalid_amount" });
    expect(checkEntry({ amount: 0.001 }, TODAY)).toMatchObject({ ok: false, error: "invalid_amount" });
    expect(checkEntry({ amount: Number.NaN }, TODAY)).toMatchObject({ ok: false, error: "invalid_amount" });
  });

  it("asks before recording amounts over M20,000", () => {
    expect(checkEntry({ amount: 20_000 }, TODAY)).toMatchObject({ ok: true });
    expect(checkEntry({ amount: 45_000 }, TODAY)).toEqual({
      ok: false,
      error: "needs_confirmation",
      amount: 45_000,
    });
    expect(checkEntry({ amount: 45_000, confirmed: true }, TODAY)).toMatchObject({ ok: true, amount: 45_000 });
  });

  it("allows dates up to 60 days back, never in the future", () => {
    expect(checkEntry({ amount: 1, date: "2026-10-28" }, TODAY)).toMatchObject({ ok: true, date: "2026-10-28" });
    expect(checkEntry({ amount: 1, date: "2026-08-30" }, TODAY)).toMatchObject({ ok: true });
    expect(checkEntry({ amount: 1, date: "2026-08-29" }, TODAY)).toMatchObject({ error: "date_too_old" });
    expect(checkEntry({ amount: 1, date: "2026-10-30" }, TODAY)).toMatchObject({ error: "date_in_future" });
    expect(checkEntry({ amount: 1, date: "2026-02-30" }, TODAY)).toMatchObject({ error: "invalid_date" });
  });
});

describe("correctEntry", () => {
  const first = entry("sale", 200, "2026-10-28", "2026-10-28T08:00:00.000Z");
  // Recorded last, though dated earlier: "last" means last recorded.
  const latest = entry("sale", 350, "2026-10-27", "2026-10-29T09:00:00.000Z");
  const entries = [latest, first];

  it("finds the last recorded entry", () => {
    expect(lastEntry(entries)).toBe(latest);
    expect(lastEntry([])).toBeUndefined();
  });

  it("changes the amount of the last entry", () => {
    const result = correctEntry(entries, "last", { newAmount: 300 });
    expect(result).toMatchObject({ ok: true, before: { amount: 350 }, after: { id: latest.id, amount: 300 } });
    if (result.ok) expect(result.entries.map((e) => e.amount)).toEqual([300, 200]);
  });

  it("changes an entry by id and leaves the original list alone", () => {
    const result = correctEntry(entries, first.id, { newAmount: 250.004 });
    expect(result).toMatchObject({ ok: true, after: { amount: 250 } });
    expect(first.amount).toBe(200);
  });

  it("deletes an entry", () => {
    const result = correctEntry(entries, first.id, { delete: true });
    expect(result).toMatchObject({ ok: true, after: null });
    if (result.ok) expect(result.entries).toEqual([latest]);
  });

  it("reports what it can't do", () => {
    expect(correctEntry(entries, "nope", { newAmount: 1 })).toEqual({ ok: false, error: "not_found" });
    expect(correctEntry([], "last", { newAmount: 1 })).toEqual({ ok: false, error: "not_found" });
    expect(correctEntry(entries, "last", {})).toEqual({ ok: false, error: "nothing_to_change" });
    expect(correctEntry(entries, "last", { newAmount: 0 })).toEqual({ ok: false, error: "invalid_amount" });
  });
});

describe("summaries", () => {
  it("works out week and month ranges", () => {
    expect(summaryRange("this_week", TODAY)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(summaryRange("last_week", TODAY)).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(summaryRange("this_month", TODAY)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(summaryRange("this_month", "2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("totals money in, money out and profit for the period only", () => {
    const entries = [
      entry("sale", 350, "2026-10-26"),
      entry("sale", 420.5, "2026-10-26"),
      entry("purchase", 900, "2026-10-27"),
      entry("sale", 1069.5, "2026-10-29"),
      entry("sale", 999, "2026-10-25"), // last week
      entry("purchase", 999, "2026-11-02"), // next week
    ];
    expect(summarize(entries, summaryRange("this_week", TODAY), TODAY)).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
      moneyIn: 1840,
      moneyOut: 900,
      profit: 940,
      entryCount: 4,
      daysWithNoEntries: 1, // Mon, Tue and Thu have entries; Wed doesn't; Fri to Sun haven't happened
    });
  });

  it("can show a loss", () => {
    const entries = [entry("sale", 100, TODAY), entry("purchase", 900, TODAY)];
    expect(summarize(entries, summaryRange("this_week", TODAY), TODAY)).toMatchObject({ profit: -800 });
  });

  it("counts every day of a past period with no entries", () => {
    expect(summarize([], summaryRange("last_week", TODAY), TODAY)).toMatchObject({
      moneyIn: 0,
      moneyOut: 0,
      profit: 0,
      entryCount: 0,
      daysWithNoEntries: 7,
    });
  });
});
