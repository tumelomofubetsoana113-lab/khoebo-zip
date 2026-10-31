import { describe, expect, it } from "vitest";
import { TAX, type TaxConfig } from "@/config/tax";
import type { Entry } from "@/lib/state";
import {
  checkTaxConfig,
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
  workOutTax,
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
    expect(estimateTax(1000, { ...TAX, bands: [{ upTo: null, rate: 0.035, fixed: 0 }] })).toBe(35);
  });

  it("builds a full estimate with the placeholder note", () => {
    const entries = [sale(12_000, "2026-08-14"), sale(3_500, "2026-09-02")];
    expect(taxEstimate(entries, "2026-Q3")).toEqual({
      period: "2026-Q3",
      start: "2026-07-01",
      end: "2026-09-30",
      turnover: 15_500,
      rate: 0.02,
      fixed: 0,
      belowThreshold: false,
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

describe("thresholds and bands", () => {
  // Per-period amounts, so the numbers in the tests are the numbers in the table.
  const BANDED: TaxConfig = {
    ...TAX,
    amountsPer: "period",
    threshold: 5_000,
    bands: [
      { upTo: 20_000, rate: 0.01, fixed: 0 },
      { upTo: 50_000, rate: 0.02, fixed: 100 },
      { upTo: null, rate: 0.03, fixed: 0 },
    ],
  };

  it("accepts the placeholder settings", () => {
    expect(checkTaxConfig(TAX)).toEqual([]);
  });

  it("charges nothing at or below the threshold", () => {
    expect(workOutTax(5_000, BANDED)).toEqual({ tax: 0, rate: 0, fixed: 0, belowThreshold: true });
    expect(workOutTax(0, BANDED).belowThreshold).toBe(true);
  });

  it("applies the whole band's rate and fixed amount to all turnover", () => {
    expect(workOutTax(5_000.01, BANDED)).toMatchObject({ tax: 50, rate: 0.01, belowThreshold: false });
    expect(workOutTax(20_000, BANDED).tax).toBe(200); // band limits are inclusive
    expect(workOutTax(30_000, BANDED)).toEqual({ tax: 700, rate: 0.02, fixed: 100, belowThreshold: false });
    expect(workOutTax(60_000, BANDED).tax).toBe(1_800);
  });

  it("taxes each slice at its own rate with the marginal method", () => {
    const marginal: TaxConfig = { ...BANDED, threshold: 0, bandMethod: "marginal" };
    // 20,000 at 1% + 10,000 at 2% + the band's fixed 100
    expect(workOutTax(30_000, marginal).tax).toBe(500);
    // 20,000 at 1% + 30,000 at 2% + 10,000 at 3%
    expect(workOutTax(60_000, marginal).tax).toBe(1_100);
  });

  it("supports a tax-free first slice", () => {
    const freeSlice: TaxConfig = {
      ...TAX,
      amountsPer: "period",
      bandMethod: "marginal",
      bands: [
        { upTo: 10_000, rate: 0, fixed: 0 },
        { upTo: null, rate: 0.02, fixed: 0 },
      ],
    };
    expect(workOutTax(9_000, freeSlice).tax).toBe(0);
    expect(workOutTax(15_000, freeSlice).tax).toBe(100);
  });

  it("shares yearly amounts over the filing periods", () => {
    const yearly: TaxConfig = { ...BANDED, amountsPer: "year", threshold: 40_000 };
    // Quarterly, everything is a quarter of the yearly figure: threshold 10,000,
    // the second band runs to 12,500 and its fixed amount is 25.
    expect(workOutTax(10_000, yearly).belowThreshold).toBe(true);
    expect(workOutTax(10_001, yearly)).toMatchObject({ rate: 0.02, fixed: 25 });
    const monthly: TaxConfig = { ...yearly, filingPeriod: "monthly" };
    expect(workOutTax(3_333, monthly).belowThreshold).toBe(true);
    expect(workOutTax(3_334, monthly).belowThreshold).toBe(false);
  });

  it("refuses broken settings with a clear message", () => {
    const broken: TaxConfig = {
      ...TAX,
      bands: [
        { upTo: 10_000, rate: 0.02, fixed: 0 },
        { upTo: 5_000, rate: 1.5, fixed: 0 },
      ],
    };
    expect(checkTaxConfig(broken)).toEqual([
      "Band 2: the rate must be between 0 and 1.",
      "The last band must have upTo: null.",
      "Band 2: upTo must be higher than the band before.",
    ]);
    expect(() => workOutTax(1_000, broken)).toThrow(/config\/tax\.ts/);
    expect(checkTaxConfig({ ...TAX, bands: [] })).toEqual(["There must be at least one band."]);
  });

  it("passes threshold and fixed amounts through to the estimate", () => {
    const entries = [sale(3_000, "2026-08-14")];
    expect(taxEstimate(entries, "2026-Q3", BANDED)).toMatchObject({ estimate: 0, belowThreshold: true });
  });
});
