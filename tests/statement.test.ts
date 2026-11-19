import { describe, expect, it } from "vitest";
import { TAX } from "@/config/tax";
import { emptyState, type Entry, type TraderState } from "@/lib/state";
import {
  buildStatement,
  csvCell,
  monthTitle,
  resolveStatementPeriod,
  statementCsv,
  statementFileName,
  statementMonths,
  statementPath,
  statementRange,
} from "@/lib/statement";

const TODAY = "2026-11-19";

function entry(kind: Entry["kind"], amount: number, date: string, id: string, extra: Partial<Entry> = {}): Entry {
  return { id, kind, amount, date, source: "text", createdAt: `${date}T09:00:00.000Z`, ...extra };
}

const trader: TraderState = {
  ...emptyState(),
  onboardingDone: true,
  profile: { name: "Palesa", businessType: "Fruit and veg", district: "Maseru", registered: "yes", language: "en" },
  entries: [
    entry("sale", 420, "2026-10-03", "a", { note: "tomatoes" }),
    entry("purchase", 900, "2026-10-05", "b", {
      note: "Wholesaler, stock",
      source: "receipt",
      receipt: { invoiceNumber: "INV-1", lekuka: "verified" },
    }),
    entry("sale", 350.5, "2026-10-31", "c"),
    entry("client_money", 2000, "2026-11-02", "d", { currency: "rand" }),
    entry("sale", 200, "2026-11-02", "e", { note: "runner fee" }),
    entry("sale", 1000, "2026-09-28", "f"),
  ],
  returns: [
    { period: "2026-Q3", turnover: 1000, taxEstimate: 20, confirmedAt: "2026-10-10T08:00:00.000Z", reference: "MOCK-Q3", paid: true },
  ],
};

describe("resolveStatementPeriod", () => {
  it("turns words into a month or all", () => {
    expect(resolveStatementPeriod("this_month", TODAY)).toEqual({ ok: true, key: "2026-11" });
    expect(resolveStatementPeriod("last_month", TODAY)).toEqual({ ok: true, key: "2026-10" });
    expect(resolveStatementPeriod("last_month", "2027-01-05")).toEqual({ ok: true, key: "2026-12" });
    expect(resolveStatementPeriod("2026-09", TODAY)).toEqual({ ok: true, key: "2026-09" });
    expect(resolveStatementPeriod("ALL", TODAY)).toEqual({ ok: true, key: "all" });
  });

  it("refuses bad and future months", () => {
    expect(resolveStatementPeriod("2026-13", TODAY)).toEqual({ ok: false, error: "invalid_period" });
    expect(resolveStatementPeriod("October", TODAY)).toEqual({ ok: false, error: "invalid_period" });
    expect(resolveStatementPeriod("2026-Q3", TODAY)).toEqual({ ok: false, error: "invalid_period" });
    expect(resolveStatementPeriod("2026-12", TODAY)).toEqual({ ok: false, error: "future_period" });
  });
});

describe("statement ranges and months", () => {
  it("covers a whole month, or the first entry to today", () => {
    expect(statementRange("2026-02", [], TODAY)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(statementRange("all", trader.entries, TODAY)).toEqual({ start: "2026-09-28", end: TODAY });
    expect(statementRange("all", [], TODAY)).toEqual({ start: TODAY, end: TODAY });
  });

  it("lists months from the first entry to now, newest first", () => {
    expect(statementMonths(trader.entries, TODAY)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(statementMonths([], TODAY)).toEqual(["2026-11"]);
    expect(statementMonths([entry("sale", 1, "2025-12-31", "x")], "2026-01-02")).toEqual(["2026-01", "2025-12"]);
  });

  it("names a month", () => {
    expect(monthTitle("2026-10")).toBe("October 2026");
  });
});

describe("buildStatement", () => {
  it("totals one month from the ledger, oldest entry first", () => {
    const st = buildStatement(trader, "2026-10", TODAY);
    expect(st.title).toBe("October 2026");
    expect(st.isMonth).toBe(true);
    expect(st.entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(st.summary).toMatchObject({ moneyIn: 770.5, moneyOut: 900, profit: -129.5, clientMoney: 0, entryCount: 3 });
    expect(st.months).toHaveLength(1);
  });

  it("keeps client money apart from income", () => {
    const st = buildStatement(trader, "2026-11", TODAY);
    expect(st.summary).toMatchObject({ moneyIn: 200, moneyOut: 0, clientMoney: 2000, profit: 200 });
  });

  it("lists returns whose period overlaps, with the placeholder note", () => {
    const sept = buildStatement(trader, "2026-09", TODAY);
    expect(sept.returns.map((r) => r.period)).toEqual(["2026-Q3"]);
    expect(sept.returns[0]).toMatchObject({ start: "2026-07-01", end: "2026-09-30" });
    expect(sept.taxNote).toBe(TAX.placeholder ? TAX.note : null);

    const oct = buildStatement(trader, "2026-10", TODAY);
    expect(oct.returns).toEqual([]);
    expect(oct.taxNote).toBeNull();
  });

  it("gives all records with a row per month", () => {
    const st = buildStatement(trader, "all", TODAY);
    expect(st.title).toBe("All records");
    expect(st.entries).toHaveLength(6);
    expect(st.months.map((m) => [m.month, m.moneyIn])).toEqual([
      ["2026-09", 1000],
      ["2026-10", 770.5],
      ["2026-11", 200],
    ]);
    expect(st.summary.moneyIn).toBe(1970.5);
  });

  it("works with no records", () => {
    const st = buildStatement(emptyState(), "2026-11", TODAY);
    expect(st.entries).toEqual([]);
    expect(st.summary.entryCount).toBe(0);
  });
});

describe("statementCsv", () => {
  it("quotes cells and stops formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(-5)).toBe("-5");
  });

  it("has the label, details, totals and one row per entry", () => {
    const csv = statementCsv(buildStatement(trader, "2026-10", TODAY));
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("Khoebo business records");
    expect(lines[1]).toContain("Prototype for the RSL Taxathon 2026");
    expect(csv).toContain("Trader,Palesa");
    expect(csv).toContain("Money in (sales),770.50");
    expect(csv).toContain("Profit (estimate),-129.50");
    expect(csv).toContain("Date,Type,Details,Amount (M),Given in rand,Recorded from,Lekuka check");
    expect(csv).toContain("2026-10-03,Sale,tomatoes,420.00,,Message,");
    expect(csv).toContain('2026-10-05,Purchase,"Wholesaler, stock",900.00,,Receipt,Lekuka check passed (simulated)');
    expect(csv).not.toContain("Client money");
  });

  it("shows client money, rand and the month table when they apply", () => {
    const csv = statementCsv(buildStatement(trader, "all", TODAY));
    expect(csv).toContain("Client money handled,2000.00");
    expect(csv).toContain("2026-11-02,Client money,,2000.00,Yes,Message,");
    expect(csv).toContain("Month by month");
    expect(csv).toContain("October 2026,770.50,900.00,-129.50,0.00,3");
    expect(csv).toContain("2026-Q3,2026-07-01,2026-09-30,1000.00,20.00,MOCK-Q3,Yes");
  });

  it("says so when there are no records", () => {
    expect(statementCsv(buildStatement(emptyState(), "2026-11", TODAY))).toContain("No records in this period yet.");
  });
});

describe("file names and paths", () => {
  it("names the file by month, or by date for all records", () => {
    expect(statementFileName(buildStatement(trader, "2026-10", TODAY))).toBe("khoebo-statement-2026-10.csv");
    expect(statementFileName(buildStatement(trader, "all", TODAY))).toBe("khoebo-records-2026-11-19.csv");
    expect(statementPath("2026-10")).toBe("/trader/statement?period=2026-10");
  });
});
