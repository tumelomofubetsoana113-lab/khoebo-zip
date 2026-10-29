import { describe, expect, it } from "vitest";
import { TAX, type TaxConfig } from "@/config/tax";
import type { Entry } from "@/lib/state";
import {
  dueDate,
  estimateTax,
  filingPeriod,
  isValidPeriod,
  periodFor,
  periodRange,
  previousPeriod,
  reminderDate,
  taxEstimate,
  turnover,
} from "@/lib/tax";

const MONTHLY: TaxConfig = { ...TAX, filingPeriod: "monthly" };

function sale(amount: number, date: string, kind: Entry["kind"] = "sale"): Entry {
  return { id: `${kind}-${date}-${amount}`, kind, amount, date, source: "text", createdAt: `${date}T10:00:00.000Z` };
}

describe("periods", () => {
  it("names quarterly periods", () => {
    expect(periodFor("2026-01-01")).toBe("2026-Q1");
    expect(periodFor("2026-03-31")).toBe("2026-Q1");
    expect(periodFor("2026-04-01")).toBe("2026-Q2");
    expect(periodFor("2026-09-30")).toBe("2026-Q3");
    expect(periodFor("2026-10-01")).toBe("2026-Q4");
    expect(periodFor("2026-12-31")).toBe("2026-Q4");
  });

  it("names monthly periods when the config says monthly", () => {
    expect(periodFor("2026-10-29", MONTHLY)).toBe("2026-10");
    expect(periodFor("2026-01-05", MONTHLY)).toBe("2026-01");
  });

  it("checks period names against the filing period in use", () => {
    expect(isValidPeriod("2026-Q3")).toBe(true);
    expect(isValidPeriod("2026-Q5")).toBe(false);
    expect(isValidPeriod("2026-10")).toBe(false);
    expect(isValidPeriod("2026-10", MONTHLY)).toBe(true);
    expect(isValidPeriod("2026-13", MONTHLY)).toBe(false);
  });

  it("gives each period's first and last day", () => {
    expect(periodRange("2026-Q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(periodRange("2026-Q3")).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(periodRange("2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(periodRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("steps back to the previous period, across the year end", () => {
    expect(previousPeriod("2026-Q4")).toBe("2026-Q3");
    expect(previousPeriod("2027-Q1")).toBe("2026-Q4");
    expect(previousPeriod("2027-01", MONTHLY)).toBe("2026-12");
  });
});

describe("due dates", () => {
  it("falls on the 20th of the month after the period ends", () => {
    expect(dueDate("2026-Q3")).toBe("2026-10-20");
    expect(dueDate("2026-Q4")).toBe("2027-01-20");
    expect(dueDate("2026-10", MONTHLY)).toBe("2026-11-20");
  });

  it("uses the last day of the month when the due day doesn't exist", () => {
    const day31: TaxConfig = { ...MONTHLY, dueDayAfterPeriodEnd: 31 };
    expect(dueDate("2026-01", day31)).toBe("2026-02-28");
    expect(dueDate("2026-03", day31)).toBe("2026-04-30");
  });

  it("sends the reminder 3 days before", () => {
    expect(reminderDate("2026-Q3")).toBe("2026-10-17");
    expect(reminderDate("2026-Q4")).toBe("2027-01-17");
  });

  it("files the period that has ended until its due date, then the current one", () => {
    expect(filingPeriod("2026-10-01")).toBe("2026-Q3");
    expect(filingPeriod("2026-10-20")).toBe("2026-Q3");
    expect(filingPeriod("2026-10-21")).toBe("2026-Q4");
    expect(filingPeriod("2026-10-29")).toBe("2026-Q4");
    expect(filingPeriod("2027-01-05")).toBe("2026-Q4");
  });
});

describe("estimates", () => {
  it("counts sales in the period only, not purchases", () => {
    const entries = [
      sale(1000, "2026-09-30"), // Q3
      sale(350, "2026-10-01"),
      sale(420.25, "2026-12-31"),
      sale(900, "2026-11-15", "purchase"),
      sale(500, "2027-01-01"), // next year
    ];
    expect(turnover(entries, "2026-Q4")).toBe(770.25);
    expect(turnover(entries, "2026-Q3")).toBe(1000);
    expect(turnover([], "2026-Q4")).toBe(0);
  });

  it("applies the rate and rounds to cents", () => {
    expect(estimateTax(10_000)).toBe(200);
    expect(estimateTax(770.25)).toBe(15.41); // 15.405 rounds up
    expect(estimateTax(0)).toBe(0);
    expect(estimateTax(1000, { ...TAX, rateOnTurnover: 0.035 })).toBe(35);
  });

  it("builds a full estimate with the placeholder note", () => {
    const entries = [sale(12_000, "2026-08-14"), sale(3_500, "2026-09-02")];
    expect(taxEstimate(entries, "2026-Q3")).toEqual({
      period: "2026-Q3",
      start: "2026-07-01",
      end: "2026-09-30",
      turnover: 15_500,
      rate: 0.02,
      estimate: 310,
      dueDate: "2026-10-20",
      placeholder: true,
      note: TAX.note,
    });
  });

  it("drops the note once rates are confirmed", () => {
    const confirmed: TaxConfig = { ...TAX, placeholder: false };
    expect(taxEstimate([], "2026-Q3", confirmed)).toMatchObject({ placeholder: false, note: null });
  });
});
